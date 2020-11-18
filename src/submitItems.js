const fp = require('lodash/fp');
const {} = require('./constants')
const {
  POLARITY_TYPE_TO_THREATCONNECT,
  SUBMISSION_LABELS,
  INDICATOR_TYPES,
  ENTITY_TYPES
} = require('./constants');

const submitItems = async (
  { newIocsToSubmit, rating, confidence, submitTags, entitiesThatExistInTC },
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

    await createTags(newIocsToSubmit, submitTags, options, requestWithDefaults, Logger);

    return callback(null, {
      entitiesThatExistInTC: [...createdIndicators, ...entitiesThatExistInTC]
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
          detail: error.message
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
  await Promise.all(
    fp.map(
      (entity) =>
        requestWithDefaults({
          path: `indicators/${POLARITY_TYPE_TO_THREATCONNECT[entity.type]}`,
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify({
            [SUBMISSION_LABELS[entity.type === 'hash' ? entity.subtype : entity.type]]:
              entity.value,
            rating: fp.toSafeInteger(rating),
            confidence: fp.toSafeInteger(confidence)
          }),
          options
        }),
      newIocsToSubmit
    )
  );
  return fp.map((createdEntity) => ({
    ...createdEntity,
    linkType: INDICATOR_TYPES[POLARITY_TYPE_TO_THREATCONNECT[createdEntity.type]],
    canDelete: true,
    resultsFound: true,
    displayedType: ENTITY_TYPES[createdEntity.type]
  }))(newIocsToSubmit);
};

const createTags = (newIocsToSubmit, submitTags, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (entity) =>
        fp.map(
          (tag) =>
            requestWithDefaults({
              path: `indicators/${POLARITY_TYPE_TO_THREATCONNECT[entity.type]}/${
                entity.value
              }/tags/${fp.flow(fp.get('name'), fp.split(' '), fp.join('%20'))(tag)}`,
              method: 'POST',
              options
            }),
          submitTags
        ),
      newIocsToSubmit
    )
  );

module.exports = submitItems;