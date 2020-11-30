const fp = require('lodash/fp');

const { partitionFlatMap, splitOutIgnoredIps } = require('./dataTransformations');
const { INDICATOR_TYPES, POLARITY_TYPE_TO_THREATCONNECT } = require('./constants');
const createLookupResults = require('./createLookupResults');

const getLookupResults = (entities, options, requestWithDefaults, Logger) =>
  partitionFlatMap(
    async (_entitiesPartition) => {
      const { entitiesPartition, ignoredIpLookupResults } = splitOutIgnoredIps(
        _entitiesPartition
      );

      const myOwner = await _getMyOwners(options, requestWithDefaults);

      const foundEntities = await _getEntitiesFoundInTC(
        myOwner,
        entitiesPartition,
        options,
        requestWithDefaults
      );

      const lookupResults = createLookupResults(
        options,
        entitiesPartition,
        foundEntities,
        myOwner,
        Logger
      );

      Logger.trace({ lookupResults, foundEntities }, 'Lookup Results');

      return lookupResults.concat(ignoredIpLookupResults);
    },
    20,
    entities
  );

const _getMyOwners = async (options, requestWithDefaults) => {
  const myOwners = fp.get(
    'body.data.owner',
    await requestWithDefaults({
      path: `owners/mine`,
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
        path: `indicators/${encodeURIComponent(indicatorType)}/${encodeURIComponent(
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

module.exports = {
  getLookupResults
};
