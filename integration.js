'use strict';

const validateOptions = require('./src/validateOptions');
const createRequestWithDefaults = require('./src/createRequestWithDefaults');
const submitItems = require('./src/submitItems');
//const searchTags = require('./src/searchTags');
const { searchTags } = require('./src/queries/search-tags');
const deleteItem = require('./src/deleteItem');
const { setLogger } = require('./src/logger');
const { handleError } = require('./src/handleError');
const { getLookupResults } = require('./src/getLookupResults');

let Logger;
let requestWithDefaults;
const startup = (logger) => {
  Logger = logger;
  setLogger(logger);
  requestWithDefaults = createRequestWithDefaults(Logger);
};

/**
 * Iterates over the provided entity objects and checks if the `type` property
 * is set to "string".  If it is, modifies the "type" property to be the first valid
 * specific type found in the `types` property.  Valid specific types are
 * "hash", "IPv4", "IPv6", "email", "domain", "url".  This method mutates the provided
 * entities array.
 * 
 * Note: This method is a temporary fix for PL-1017 and can be removed once that fix
 * is deployed.
 * @param entities - array of entity objects
 */
function fixEntityType(entities){
  const validTypes = ['hash', 'IPv4', 'IPv6', 'email', 'domain', 'url'];

  entities.forEach((entity) => {
    if (typeof entity.type === 'string') {
      const specificType = entity.types.find((type) => validTypes.includes(type));
      if (specificType) {
        entity.type = specificType;
      }
    }
  });  
}

const doLookup = async (entities, { url, ..._options }, cb) => {
  fixEntityType(entities);

  Logger.debug({ entities }, 'Fixed Entities');
  
  const options = {
    ..._options,
    url: url.endsWith('/') ? url.slice(0, -1) : url
  };

  let lookupResults;
  try {
    lookupResults = await getLookupResults(
      entities,
      options,
      requestWithDefaults,
      Logger
    );
  } catch (error) {
    Logger.error(error, 'Get Lookup Results Failed');
    return cb(handleError(error));
  }

  Logger.trace({ lookupResults }, 'Lookup Results');
  cb(null, lookupResults);
};

const onMessage = async ({ data: { action, ...actionParams } }, options, callback) => {
  if (action === 'deleteItem') {
    deleteItem(actionParams, requestWithDefaults, options, Logger, callback);
  } else if (action === 'submitItems') {
    submitItems(actionParams, requestWithDefaults, options, Logger, callback);
  } else if (action === 'searchTags') {
    const tags = await searchTags(actionParams.term, actionParams.owner, options);
    callback(null, {
      tags
    });
  } else {
    callback(null, {});
  }
};

module.exports = {
  doLookup,
  startup,
  validateOptions,
  onMessage
};
