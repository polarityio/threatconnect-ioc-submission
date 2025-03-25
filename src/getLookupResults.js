const fp = require('lodash/fp');

const { splitOutIgnoredIps } = require('./dataTransformations');
const { INDICATOR_TYPES, POLARITY_TYPE_TO_THREATCONNECT } = require('./constants');
const createLookupResults = require('./createLookupResults');
const { getLogger } = require('./logger');

const getLookupResults = async (entities, options, requestWithDefaults, Logger) => {
  const { entitiesPartition, ignoredIpLookupResults } = splitOutIgnoredIps(entities);

  const myOwner = await _getMyOwners(options, requestWithDefaults);

  const allOwners = await getOwners(options, requestWithDefaults);

  const foundEntities = await _getEntitiesFoundInTC(
    myOwner,
    entitiesPartition,
    options,
    requestWithDefaults
  );

  Logger.trace({ foundEntities }, 'Found Entities');

  const groups = await getGroups(options, requestWithDefaults);

  const updatedEntities = foundEntities.map((entity) => {
    const primaryOwner = entity.owners.find((owner) => owner.id === entity.myOwner?.id);
    const ownershipStatus = primaryOwner ? 'inMyOwner' : 'notInMyOwner';

    return {
      ...entity,
      ownershipStatus: ownershipStatus,
      indicatorId: primaryOwner ? primaryOwner.itemId : entity.indicatorId,
      ...(ownershipStatus === 'notInMyOwner' && { isExpanded: false })
    };
  });

  const lookupResults = createLookupResults(
    options,
    entitiesPartition,
    groups,
    updatedEntities,
    myOwner,
    allOwners,
    Logger
  );

  Logger.trace({ lookupResults, updatedEntities }, 'Lookup Results');

  return lookupResults.concat(ignoredIpLookupResults);
};

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
        )}/owners?includes=additional`,
        method: 'GET',
        options
      })
    );
  };

  const entitiesFoundInTC = fp.compact(
    await Promise.all(
      fp.map(async (entity) => {
        getLogger().trace({ entity }, 'Entity');
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

const getGroups = async (options, requestWithDefaults) => {
  if (options.allowAssociation === true) {
    return fp.getOr(
      [],
      'body.data.group',
      await requestWithDefaults({
        path: `groups`,
        method: 'GET',
        options
      })
    );
  }
  return [];
};

const getOwners = async (options, requestWithDefaults) => {
  const myOwners = fp.get(
    'body.data.owner',
    await requestWithDefaults({
      path: `owners`,
      method: 'GET',
      options
    })
  );

  return myOwners;
};

module.exports = {
  getLookupResults
};
