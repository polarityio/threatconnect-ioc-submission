const _ = require("lodash");

const { IGNORED_IPS } = require('./constants');

const getKeys = (keys, items) =>
  Array.isArray(items)
    ? items.map((item) => _.pickBy(item, (v, key) => keys.includes(key)))
    : _.pickBy(items, (v, key) => keys.includes(key));

const groupEntities = (entities) =>
  _.chain(entities)
    .groupBy(({ isIP, isDomain, type }) =>
      isIP ? "ip" : 
      isDomain ? "domain" : 
      type === "MAC" ? "mac" : 
      type === "MD5" ? "md5" : 
      type === "SHA1" ? "sha1" : 
      type === "SHA256" ? "sha256" : 
      "unknown"
    )
    .omit("unknown")
    .value();


const splitOutIgnoredIps = (_entitiesPartition) => {
  const { ignoredIPs, entitiesPartition } = _.groupBy(
    _entitiesPartition,
    ({ isIP, value }) =>
      !isIP || (isIP && !IGNORED_IPS.has(value)) ? 'entitiesPartition' : 'ignoredIPs'
  );

  return {
    entitiesPartition,
    ignoredIpLookupResults: _.map(ignoredIPs, (entity) => ({
      entity,
      data: null
    }))
  };
};



module.exports = {
  getKeys,
  groupEntities,
  splitOutIgnoredIps
};
