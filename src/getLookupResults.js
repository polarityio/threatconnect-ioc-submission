const fp = require('lodash/fp');

const { splitOutIgnoredIps } = require('./dataTransformations');
const { INDICATOR_TYPES, POLARITY_TYPE_TO_THREATCONNECT } = require('./constants');
const createLookupResults = require('./createLookupResults');
const { getLogger } = require('./logger');
const { getMyOwner } = require('./queries/get-my-owner');
const {
  getOwnersWithIndicatorPerm
} = require('./queries/get-owners-with-indicator-perm');

const getLookupResults = async (entities, options, requestWithDefaults, Logger) => {
  const { entitiesPartition, ignoredIpLookupResults } = splitOutIgnoredIps(entities);

  if (!entitiesPartition) {
    // If there are no entities to process, return the ignored IPs
    // This can happen if the user only looks up ignored IPs
    return ignoredIpLookupResults;
  }

  const myOwner = await getMyOwner(options);

  let allOwners = await getOwnersWithIndicatorPerm(options);

  allOwners = moveOwnerToFront(allOwners, myOwner.id);

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

function moveOwnerToFront(allOwners, targetOwnerId) {
  const index = allOwners.findIndex((owner) => owner.id === targetOwnerId);
  if (index > -1) {
    const [owner] = allOwners.splice(index, 1);
    allOwners.unshift(owner);
  }
  return allOwners;
}

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

        if (!indicatorType) {
          getLogger().error({ entity }, 'Invalid entity type');
        }

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

module.exports = {
  getLookupResults
};
