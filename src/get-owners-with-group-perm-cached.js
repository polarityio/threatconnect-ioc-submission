const crypto = require('crypto');
const { getLogger } = require('./logger');
const { getOwnersWithGroupPerm } = require('./queries/get-owners-with-group-perm');
const NodeCache = require('node-cache');
const ownersCache = new NodeCache({
  //Cache owner information for 24 hours
  stdTTL: 24 * 60 * 60
});

/**
 * Returns an array of owner objects where the requesting user (based on API key) has FULL or READ group permission.
 * This method will return the owners from the cache, or fetch the data if it is not in the cache.
 *
 * @param options
 * @returns {Promise<*>}
 */
async function getOwnersWithGroupPermissionCached(options) {
  const Logger = getLogger();

  const cacheKey = createOwnerCacheLookupKey(options);

  if (ownersCache.has(cacheKey)) {
    return ownersCache.get(cacheKey);
  }

  // Owner is not in the cache so fetch it via the REST API
  const myOwner = await getOwnersWithGroupPerm(options);

  ownersCache.set(cacheKey, myOwner);

  return myOwner;
}

function createOwnerCacheLookupKey(options) {
  return computeMd5(options.accessId + options.apiKey);
}

function computeMd5(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

module.exports = {
  getOwnersWithGroupPermissionCached
};
