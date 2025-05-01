const fp = require('lodash/fp');
const async = require('async');
const { splitOutIgnoredIps } = require('./dataTransformations');
const { getLogger } = require('./logger');
const { getMyOwnerCached } = require('./get-my-owner-cached');
const {
  getOwnersWithIndicatorPermissionCached
} = require('./get-owners-with-indicator-perm-cached');
const {
  getOwnersWithGroupPermissionCached
} = require('./get-owners-with-group-perm-cached');
const { searchIndicator } = require('./queries/search-indicator');
const { getThreatConnectDisplayTypeFromEntityType } = require('./tc-request-utils');

const getLookupResults = async (entities, options) => {
  const Logger = getLogger();
  const { entitiesPartition, ignoredIpLookupResults } = splitOutIgnoredIps(entities);

  if (!entitiesPartition) {
    // If there are no entities to process, return the ignored IPs
    // This can happen if the user only looks up ignored IPs
    return ignoredIpLookupResults;
  }

  // Get the requesting users owner from the cache or fetches it via REST API if it's not cached yet
  const myOwner = await getMyOwnerCached(options);

  // Get owners that the requesting user has permission to add indicators to
  let ownersWithCreatePermission = await getOwnersWithIndicatorPermissionCached(options);
  ownersWithCreatePermission = moveOwnerToFront(ownersWithCreatePermission, myOwner.id);

  let ownersWithGroupPermission = await getOwnersWithGroupPermissionCached(options);
  ownersWithGroupPermission = moveOwnerToFront(ownersWithGroupPermission, myOwner.id);

  const results = [];
  let newEntities = false;
  let entitiesFound = false;

  await async.eachLimit(entitiesPartition, 5, async (entity) => {
    const indicators = await searchIndicator(entity, options);

    if (indicators.length > 0) {
      entitiesFound = true;
    } else {
      newEntities = true;
    }

    const formattedResult = createFormattedSearchResult(entity, indicators, myOwner);
    results.push(formattedResult);
  });

  Logger.trace({ results }, 'Search Results');

  const lookupResults = [
    {
      entity: {
        ...entities[0],
        value: 'ThreatConnect IOC Submission'
      },
      displayValue: 'ThreatConnect IOC Submission',
      isVolatile: true,
      data: {
        summary: [
          ...(entitiesFound ? ['Entities Found'] : []),
          ...(newEntities ? ['New Entities'] : [])
        ],
        details: {
          uiUrl: getUiUrl(options.url),
          myOwner,
          // Groups gets initialized via onMessage
          groups: [],
          results: sortResultsByOwner(results, myOwner),
          ownersWithCreatePermission,
          ownersWithGroupPermission
        }
      }
    }
  ];

  return lookupResults.concat(ignoredIpLookupResults);
};

/**
 * Sort indicators so that indicators in the requesting users organization come first.  Then do a secondary sort by indicator type.
 * @param results
 * @param myOwner
 * @returns {*}
 */
function sortResultsByOwner(results, myOwner) {
  getLogger().info({ results, myOwner }, 'Results');
  results.sort((a, b) => {
    // Primary rule: results where isInMyOwner is true comes before false items
    if (a.isInMyOwner !== b.isInMyOwner) {
      return a.isInMyOwner ? -1 : 1;
    }

    // Sort alphabetical by displayType when both results are in my owner or both results are not
    return a.displayType.localeCompare(b.displayType, 'en', { sensitivity: 'base' });
  });

  return results;
}

function createFormattedSearchResult(entity, indicators, myOwner) {
  return {
    entity,
    displayType: getThreatConnectDisplayTypeFromEntityType(entity),
    indicators,
    foundInThreatConnect: indicators.length > 0 ? true : false,
    isInMyOwner: indicators.some((indicator) => indicator.ownerId === myOwner.id),
    canDelete: indicators.some((indicator) => indicator.ownerId === myOwner.id)
  };
}

const getUiUrl = fp.flow(
  fp.thru((x) => /^((http[s]?|ftp):\/)\/?([^:\/\s]+)/g.exec(x)),
  fp.first
);

/**
 * Finds the given targetOwnerId within the provided ownersList and moves that entry to the
 * front of the ownersList array.
 *
 * @param ownersList
 * @param targetOwnerId
 * @returns {*}
 */
function moveOwnerToFront(ownersList, targetOwnerId) {
  const index = ownersList.findIndex((owner) => owner.id === targetOwnerId);
  if (index > -1) {
    const [owner] = ownersList.splice(index, 1);
    ownersList.unshift(owner);
  }
  return ownersList;
}

module.exports = {
  getLookupResults,
  createFormattedSearchResult
};
