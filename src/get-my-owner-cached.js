const crypto = require('crypto');
const { getLogger } = require('./logger');
const { getMyOwner } = require('./queries/get-my-owner');
const NodeCache = require('node-cache');
const myOwnerCache = new NodeCache({
  //Cache owner information for 24 hours
  stdTTL: 24 * 60 * 60
});

async function getMyOwnerCached(options) {
  const Logger = getLogger();

  const cacheKey = createOwnerCacheLookupKey(options);

  if (myOwnerCache.has(cacheKey)) {
    return myOwnerCache.get(cacheKey);
  }

  // Owner is not in the cache so fetch it via the REST API
  const myOwner = await getMyOwner(options);

  myOwnerCache.set(cacheKey, myOwner);

  return myOwner;
}

function createOwnerCacheLookupKey(options) {
  return computeMd5(options.accessId + options.apiKey);
}

function computeMd5(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

module.exports = {
  getMyOwnerCached
};
