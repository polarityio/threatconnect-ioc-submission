const fp = require('lodash/fp');
const { } = require('./constants');
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
    source,
    whoisActive,
    dnsActive,
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
      whoisActive,
      dnsActive,
      options,
      requestWithDefaults,
      Logger
    );

    await Promise.all([
      ...(description
        ? await createDescription(
          newIocsToSubmit,
          description,
          options,
          requestWithDefaults,
          Logger
        )
        : []),
      ...(title
        ? await createTitle(newIocsToSubmit, title, options, requestWithDefaults, Logger)
        : []),
      ...(source
        ? await createSource(newIocsToSubmit, source, options, requestWithDefaults, Logger)
        : []),
      ...(groupID
        ? await createAssociations(
          newIocsToSubmit,
          groupType,
          groupID,
          options,
          requestWithDefaults,
          Logger
        )
        : []),
      ...(submitTags.length
        ? await createTags(
          newIocsToSubmit,
          submitTags,
          options,
          requestWithDefaults,
          Logger
        )
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
  whoisActive,
  dnsActive,
  options,
  requestWithDefaults,
  Logger
) => {

  const responses = await Promise.all(
    fp.map(
      (entity) => {
        const body = {
          [SUBMISSION_LABELS[entity.type === 'hash' ? entity.subtype : entity.type]]: entity.value,
          rating: fp.toSafeInteger(rating),
          confidence: fp.toSafeInteger(confidence)
        };

        if (POLARITY_TYPE_TO_THREATCONNECT[entity.type] === 'hosts') {
          body.whoisActive = whoisActive;
          body.dnsActive = dnsActive;
        }

        return requestWithDefaults({
          path: `indicators/${POLARITY_TYPE_TO_THREATCONNECT[entity.type]}`,
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body,
          options
        }).catch((error) => {
          if (error.message.includes('exclusion list')) error.entityValue = entity.value;
          throw error;
        });
      },
      newIocsToSubmit
    )
  );

  const createdIds = responses.map((response) => {
    if (response.statusCode === 201 && response.body && response.body.data) {
      const data = response.body.data;
      const indicatorKey = Object.keys(data).find((key) => data[key] && data[key].id);
      if (indicatorKey) {
        return data[indicatorKey].id;
      }
    }
    Logger.error(`Unexpected response format: ${JSON.stringify(response)}`);
    return null;
  });

  const enrichedEntities = newIocsToSubmit.map((createdEntity, index) => ({
    ...createdEntity,
    linkType: INDICATOR_TYPES[POLARITY_TYPE_TO_THREATCONNECT[createdEntity.type]],
    canDelete: true,
    resultsFound: true,
    displayedType: ENTITY_TYPES[createdEntity.type],
    uriEncodedValue: encodeURIComponent(createdEntity.value),
    createdId: createdIds[index]
  }));

  return enrichedEntities;

};

const createTags = (newIocsToSubmit, submitTags, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (entity) =>
        fp.map(
          (tag) =>
            requestWithDefaults({
              path: `indicators/${POLARITY_TYPE_TO_THREATCONNECT[entity.type]
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

const createDescription = (newIocsToSubmit, description, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (entity) =>
        requestWithDefaults({
          path: `indicators/${POLARITY_TYPE_TO_THREATCONNECT[entity.type]
            }/${encodeURIComponent(entity.value)}/attributes`,
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body: {
            type: 'Description',
            value: description,
            displayed: true
          },
          options
        }),
      newIocsToSubmit
    )
  );

const createTitle = (newIocsToSubmit, title, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (entity) =>
        requestWithDefaults({
          path: `indicators/${POLARITY_TYPE_TO_THREATCONNECT[entity.type]
            }/${encodeURIComponent(entity.value)}/attributes`,
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body: {
            type: 'Title',
            value: title,
            displayed: true
          },
          options
        }),
      newIocsToSubmit
    )
  );

const createSource = (newIocsToSubmit, source, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (entity) =>
        requestWithDefaults({
          path: `indicators/${POLARITY_TYPE_TO_THREATCONNECT[entity.type]
            }/${encodeURIComponent(entity.value)}/attributes`,
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body: {
            type: 'Source',
            value: source,
            displayed: true
          },
          options
        }),
      newIocsToSubmit
    )
  );

const createAssociations = (
  newIocsToSubmit,
  groupType,
  groupID,
  options,
  requestWithDefaults
) =>
  Promise.all(
    fp.flatMap(
      async (entity) =>
        requestWithDefaults({
          path: `indicators/${POLARITY_TYPE_TO_THREATCONNECT[entity.type]
            }/${encodeURIComponent(entity.value)}/groups/${groupType}/${groupID}`,
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          options
        }),
      newIocsToSubmit
    )
  );

module.exports = submitItems;
