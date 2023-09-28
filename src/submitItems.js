const fp = require('lodash/fp');
const { TYPES } = require('./constants');
const {
  POLARITY_TYPE_TO_THREATCONNECT,
  SUBMISSION_LABELS,
  INDICATOR_TYPES,
  ENTITY_TYPES
} = require('./constants');

const submitItems = async (
  {
    newIocsToSubmit,
    rating,
    confidence,
    submitTags,
    title,
    description,
    foundEntities,
    groupType,
    groupID
  },
  requestWithDefaults,
  options,
  Logger,
  callback
) => {
  try {
    const createdIndicators = await createIndicators(
      newIocsToSubmit,
      rating,
      confidence,
      options,
      requestWithDefaults,
      Logger
    );

    const iocIds = createdIndicators.map((ioc) => ioc.id);

    await Promise.all([
      ...(description
        ? await createDescription(
            iocIds,
            description,
            options,
            requestWithDefaults,
            Logger
          )
        : []),
      ...(title
        ? await createTitle(iocIds, title, options, requestWithDefaults, Logger)
        : []),
      ...(groupID
        ? await createAssociations(
            iocIds,
            groupType,
            groupID,
            options,
            requestWithDefaults,
            Logger
          )
        : []),
      ...(submitTags.length
        ? await createTags(iocIds, submitTags, options, requestWithDefaults, Logger)
        : [])
    ]);

    return callback(null, {
      foundEntities: [...createdIndicators, ...foundEntities]
    });
  } catch (error) {
    Logger.error(
      error,
      { detail: 'Failed to Create IOC in ThreatConnect' },
      'IOC Creation Failed'
    );
    return callback({
      errors: [
        {
          err: error,
          detail: error.message,
          ...(error.entityValue && { title: error.entityValue })
        }
      ]
    });
  }
};

const createIndicators = async (
  newIocsToSubmit,
  rating,
  confidence,
  options,
  requestWithDefaults,
  Logger
) => {
  const responseArray = await Promise.all(
    newIocsToSubmit.map(async (entity) => {
      try {
        const response = await requestWithDefaults({
          path: `v3/indicators`,
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body: {
            type: TYPES[entity.type],
            [SUBMISSION_LABELS[entity.type === 'hash' ? entity.subtype : entity.type]]:
              entity.value,
            rating: fp.toSafeInteger(rating),
            confidence: fp.toSafeInteger(confidence)
          },
          options
        });

        return {
          response,
          entity
        };
      } catch (error) {
        if (error.message.includes('exclusion list')) {
          error.entityValue = entity.value;
        }
        throw error;
      }
    })
  );

  return responseArray.map(({ response, entity }) => ({
    ...entity,
    linkType: INDICATOR_TYPES[POLARITY_TYPE_TO_THREATCONNECT[entity.type]],
    canDelete: true,
    resultsFound: true,
    displayedType: ENTITY_TYPES[entity.type],
    uriEncodedValue: encodeURIComponent(entity.value),
    id: response.body.data.id
  }));
};

const createTags = (newIocsToSubmit, submitTags, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (entity) =>
        fp.map(
          (tag) =>
            requestWithDefaults({
              path: `v3/indicators/${
                POLARITY_TYPE_TO_THREATCONNECT[entity.type]
              }/${encodeURIComponent(entity.value)}/tags/${fp.flow(
                fp.get('name'),
                fp.split(' '),
                fp.join('%20')
              )(tag)}`,
              method: 'POST',
              options
            }),
          submitTags
        ),
      newIocsToSubmit
    )
  );

const createDescription = (iocIds, description, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (id) =>
        requestWithDefaults({
          path: `v3/indicatorAttributes`,
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body: {
            indicatorId: id,
            type: 'Description',
            value: description,
            pinned: true
            // displayed: true
          },
          options
        }),
      iocIds
    )
  );

const createTitle = (iocIds, title, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (id) =>
        requestWithDefaults({
          path: `v3/indicatorAttributes`,
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body: {
            indicatorId: id,
            type: 'Title',
            value: title,
            pinned: true
          },
          options
        }),
      iocIds
    )
  );

const createAssociations = (iocIds, groupType, groupID, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (id) =>
        requestWithDefaults({
          path: `v3/indicators`,
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body: {
            indicatorId: id,
            pinned: true,
            associatedGroups: {
              data: {
                id: groupID
              }
            }
          },
          options
        }),
      iocIds
    )
  );

module.exports = submitItems;
