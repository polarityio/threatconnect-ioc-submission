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
  Logger.trace(
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
    'LOOK_HERE'
  );
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
            groupID,
            groupType,
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

const createTags = (iocIds, submitTags, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (id) =>
        fp.map(
          (tag) =>
            requestWithDefaults({
              path: `v3/tags`,
              method: 'POST',
              body: {
                name: tag,
                description: tag,
                associatedIndicators: {
                  data: [{ id: id }]
                }
              },
              options
            }),
          submitTags
        ),
      iocIds
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

const createAssociations = (iocIds, groupID, groupType, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (id) =>
        requestWithDefaults({
          path: `v3/groups`,
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body: {
            name: groupID,
            type: groupType,
            associatedIndicators: {
              data: [{ id: id }]
            }
          },
          options
        }),
      iocIds
    )
  );

module.exports = submitItems;
