'use strict';

const validateOptions = require('./src/validateOptions');
const createRequestWithDefaults = require('./src/createRequestWithDefaults');
const submitItems = require('./src/submitItems');
const searchTags = require('./src/searchTags');
const deleteItem = require('./src/deleteItem');

const { handleError } = require('./src/handleError');
const { getLookupResults } = require('./src/getLookupResults');

let Logger;
let requestWithDefaults;
const startup = (logger) => {
  Logger = logger;
  requestWithDefaults = createRequestWithDefaults(Logger);
};


const doLookup = async (entities, { url, ..._options }, cb) => {
  Logger.debug({ entities }, 'Entities');
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

const onMessage = ({ data: { action, ...actionParams} }, options, callback) => {
  if (action === 'deleteItem') {
    deleteItem(actionParams, requestWithDefaults, options, Logger, callback);
  } else if (action === 'submitItems') {
    submitItems(actionParams, requestWithDefaults, options, Logger, callback);
  } else if (action === 'searchTags') {
    searchTags(actionParams, requestWithDefaults, options, Logger, callback);
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
