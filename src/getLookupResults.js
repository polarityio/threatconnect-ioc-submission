const fp = require('lodash/fp');

const { splitOutIgnoredIps } = require('./dataTransformations');
const { INDICATOR_TYPES, POLARITY_TYPE_TO_THREATCONNECT } = require('./constants');
const createLookupResults = require('./createLookupResults');

const getLookupResults = async (entities, options, requestWithDefaults, Logger) => {
  const { entitiesPartition, ignoredIpLookupResults } = splitOutIgnoredIps(entities);
  const groups = await getGroups(options, requestWithDefaults);

  Logger.trace({ groups }, 'Groups');

  const myOwner = await _getMyOwners(options, requestWithDefaults);

  const foundEntities = await _getEntitiesFoundInTC(
    myOwner,
    entitiesPartition,
    options,
    requestWithDefaults
  );

  Logger.trace({ foundEntities }, 'Found Entities');

  const lookupResults = createLookupResults(
    options,
    entitiesPartition,
    groups,
    foundEntities,
    myOwner,
    Logger
  );

  Logger.trace({ lookupResults, foundEntities }, 'Lookup Results');

  return lookupResults.concat(ignoredIpLookupResults);
};

const _getMyOwners = async (options, requestWithDefaults) => {
  const myOwners = fp.get(
    'body.data.owner',
    await requestWithDefaults({
      path: `v2/owners/mine`,
      method: 'GET',
      options
    })
  );

  return myOwners;
};

const _getEntitiesFoundInTC = async (
  myOwner,
  entitiesPartition,
  options,
  requestWithDefaults
) => {
  const _searchForOwnersOfThisEntity = async (indicatorValue, indicatorType) => {
    return fp.getOr(
      [],
      'body.data.owner',
      await requestWithDefaults({
        path: `v2/indicators/${encodeURIComponent(indicatorType)}/${encodeURIComponent(
          indicatorValue
        )}/owners`,
        method: 'GET',
        options
      })
    );
  };

  const entitiesFoundInTC = fp.compact(
    await Promise.all(
      fp.map(async (entity) => {
        const indicatorType = POLARITY_TYPE_TO_THREATCONNECT[entity.type];
        const linkType = INDICATOR_TYPES[indicatorType];
        const indicatorValue = entity.value;
        const ownersSearchResults = await _searchForOwnersOfThisEntity(
          indicatorValue,
          indicatorType
        );

        return (
          ownersSearchResults &&
          ownersSearchResults.length && {
            ...entity,
            uriEncodedValue: encodeURIComponent(entity.value),
            linkType,
            owners: ownersSearchResults,
            ownersLengthMinus2: ownersSearchResults.length - 2,
            myOwner,
            canDelete: fp.some((owner) => owner.id === myOwner.id, ownersSearchResults),
            resultsFound: true
          }
        );
      }, entitiesPartition)
    )
  );

  return entitiesFoundInTC;
};

const getGroups = async (options, requestWithDefaults) =>
  fp.getOr(
    [],
    'body.data',
    await requestWithDefaults({
      path: `v3/groups`,
      method: 'GET',
      options
    })
  );

module.exports = {
  getLookupResults
};
