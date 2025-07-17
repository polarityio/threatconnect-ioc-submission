const crypto = require('crypto');
const { getLogger } = require('./logger');
const { getAttributesForType } = require('./queries/get-attributes-for-type');
const NodeCache = require('node-cache');
const attributeTypesCache = new NodeCache({
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
async function getAttributesForTypeCached(attributeType, options) {
  const Logger = getLogger();

  const cacheKey = createOwnerEntityTypeCacheLookupKey(attributeType, options);

  if (attributeTypesCache.has(cacheKey)) {
    return attributeTypesCache.get(cacheKey);
  }

  // Owner is not in the cache so fetch it via the REST API
  const attributes = await getAttributesForType(attributeType, options);

  attributeTypesCache.set(cacheKey, attributes);

  return attributes;
}

function createOwnerEntityTypeCacheLookupKey(attributeType, options) {
  return computeMd5(options.accessId + options.apiKey + attributeType);
}

function computeMd5(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

module.exports = {
  getAttributesForTypeCached
};
