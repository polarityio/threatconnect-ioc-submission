const fp = require('lodash/fp');
const {} = require('./constants');
const {
  POLARITY_TYPE_TO_THREATCONNECT,
  SUBMISSION_LABELS,
  INDICATOR_TYPES,
  ENTITY_TYPES
} = require('./constants');

const parseErrorToReadableJson = (error) =>
  JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));

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
    const { enrichedEntities: createdIndicators, exclusionListEntities } =
      await createIndicators(
        newIocsToSubmit,
        rating,
        confidence,
        whoisActive,
        dnsActive,
        options,
        requestWithDefaults,
        Logger
      );

    const validEntities = newIocsToSubmit.filter(
      (entity) => !exclusionListEntities.includes(entity.value)
    );

    try {
      await Promise.all([
        ...(description
          ? await createDescription(
              validEntities,
              description,
              options,
              requestWithDefaults,
              Logger
            )
          : []),
        ...(title
          ? await createTitle(validEntities, title, options, requestWithDefaults, Logger)
          : []),
        ...(source
          ? await createSource(
              validEntities,
              source,
              options,
              requestWithDefaults,
              Logger
            )
          : []),
        ...(groupID
          ? await createAssociations(
              validEntities,
              groupType,
              groupID,
              options,
              requestWithDefaults,
              Logger
            )
          : []),
        ...(submitTags.length
          ? await createTags(
              validEntities,
              submitTags,
              options,
              requestWithDefaults,
              Logger
            )
          : [])
      ]);
    } catch (error) {
      return callback({
        meta: parseErrorToReadableJson(error),
        title: error.message,
        status: error.status,
        detail: 'warning'
      });
    }
    const combinedEntities = [...createdIndicators];
    Logger.info({ combinedEntities }, 'Found Entities Before Return');

    return callback(null, {
      foundEntities: [...createdIndicators, ...foundEntities],
      exclusionListEntities
    });
  } catch (error) {
    Logger.error(
      error,
      { detail: 'Failed to Create IOC in ThreatConnect' },
      'IOC Creation Failed'
    );
    return callback({
      meta: parseErrorToReadableJson(error),
      title: error.message,
      status: error.status
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
  const exclusionListEntities = [];

  const responses = await Promise.all(
    fp.map((entity) => {
      const body = {
        [SUBMISSION_LABELS[entity.type === 'hash' ? entity.subtype : entity.type]]:
          entity.value,
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
        if (error.message.includes('exclusion list')) {
          exclusionListEntities.push(entity.value);
          error.entityValue = entity.value;
          Logger.warn(
            `This Indicator is contained on a system-wide exclusion list: ${entity.value}`
          );
        } else {
          throw error;
        }
      });
    }, newIocsToSubmit)
  );
  Logger.info(`Responses: ${JSON.stringify(responses, null, 2)}`);
  const createdIndicatorsIds = responses.map((response) => {
    if (
      response &&
      response.statusCode &&
      response.statusCode === 201 &&
      response.body &&
      response.body.data
    ) {
      const data = response.body.data;
      const indicatorKey = Object.keys(data).find((key) => data[key] && data[key].id);
      if (indicatorKey) {
        return data[indicatorKey].id;
      }
    }
    Logger.warn(`Unexpected response format: ${JSON.stringify(response)}`);
    return null;
  });

  const createdIndicatorsOwners = responses.map((response) => {
    if (
      response &&
      response.statusCode &&
      response.statusCode === 201 &&
      response.body &&
      response.body.data
    ) {
      const data = response.body.data;
      const indicatorKey = Object.keys(data).find((key) => data[key] && data[key].owner);
      if (indicatorKey) {
        return data[indicatorKey].owner;
      }
    }
    Logger.warn(`Unexpected response format: ${JSON.stringify(response)}`);
    return null;
  });

  const enrichedEntities = newIocsToSubmit.map((createdEntity, index) => ({
    ...createdEntity,
    linkType: INDICATOR_TYPES[POLARITY_TYPE_TO_THREATCONNECT[createdEntity.type]],
    canDelete: true,
    resultsFound: true,
    displayedType: ENTITY_TYPES[createdEntity.type],
    uriEncodedValue: encodeURIComponent(createdEntity.value),
    createdIndicatorsId: createdIndicatorsIds[index],
    createdIndicatorsOwner: createdIndicatorsOwners[index],
    ownershipStatus: 'inMyOwner' //To be removed or set accordingly when creating IOCs in other owners will be supported
  }));

  Logger.info(`Enriched Entities: ${JSON.stringify(enrichedEntities, null, 2)}`);

  return { enrichedEntities, exclusionListEntities };
};

const createTags = (newIocsToSubmit, submitTags, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (entity) =>
        fp.map(
          (tag) =>
            requestWithDefaults({
              path: `indicators/${
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

const createDescription = (newIocsToSubmit, description, options, requestWithDefaults) =>
  Promise.all(
    fp.flatMap(
      async (entity) =>
        requestWithDefaults({
          path: `indicators/${
            POLARITY_TYPE_TO_THREATCONNECT[entity.type]
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
          path: `indicators/${
            POLARITY_TYPE_TO_THREATCONNECT[entity.type]
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
          path: `indicators/${
            POLARITY_TYPE_TO_THREATCONNECT[entity.type]
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
          path: `indicators/${
            POLARITY_TYPE_TO_THREATCONNECT[entity.type]
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
