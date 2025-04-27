'use strict';

const async = require('async');
const validateOptions = require('./src/validateOptions');
const createRequestWithDefaults = require('./src/createRequestWithDefaults');
const { searchTags } = require('./src/queries/search-tags');
const { searchGroups } = require('./src/queries/search-groups');
const { createIndicator } = require('./src/queries/create-indicator');
const { deleteIndicator } = require('./src/queries/delete-indicator');
const { setLogger } = require('./src/logger');
const {
  getLookupResults,
  createFormattedSearchResult
} = require('./src/getLookupResults');
const { getMyOwnerCached } = require('./src/get-my-owner-cached');

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
function fixEntityType(entities) {
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

  try {
    const lookupResults = await getLookupResults(entities, options);
    Logger.trace({ lookupResults }, 'Lookup Results');
    cb(null, lookupResults);
  } catch (error) {
    Logger.error({ error }, 'Get Lookup Results Failed');
    return cb(error);
  }
};

const onMessage = async ({ data: { action, ...actionParams } }, options, cb) => {
  switch (action) {
    case 'deleteItem':
      try {
        await deleteIndicator(actionParams.indicatorId, options);
        cb(null, {
          success: true
        });
      } catch (deleteError) {
        Logger.error(deleteError, 'Delete Indicator Error');
        return cb(deleteError);
      }
      break;
    case 'submitItems':
      Logger.trace({ actionParams }, 'onMessage createIndicator action');
      const searchResultObjectsToSubmit = actionParams.newIocsToSubmit;
      const results = [];
      const errors = [];
      const exclusionListEntities = [];
      await async.eachLimit(
        searchResultObjectsToSubmit,
        5,
        async (searchResultObject) => {
          try {
            const indicator = await createIndicator(
              searchResultObject.entity,
              actionParams,
              options
            );
            const myOwner = await getMyOwnerCached(options);
            const formattedSearchResult = createFormattedSearchResult(
              searchResultObject.entity,
              indicator,
              myOwner
            );
            results.push(formattedSearchResult);
          } catch (createError) {
            if (
              createError.meta &&
              createError.meta.responseBody &&
              createError.meta.responseBody.message &&
              createError.meta.responseBody.message.includes('exclusion list')
            ) {
              exclusionListEntities.push(searchResultObject.entity);
            } else {
              Logger.error({ createError }, 'Create Indicator Error');
              errors.push({
                entity: searchResultObject.entity,
                error: createError
              });
            }
          }
        }
      );
      Logger.trace(
        { results, errors, exclusionListEntities },
        'Submit indicator results'
      );
      cb(null, {
        results,
        errors,
        exclusionListEntities
      });
      break;
    case 'searchTags':
      try {
        const tags = await searchTags(actionParams.term, actionParams.ownerId, options);
        cb(null, {
          tags
        });
      } catch (searchTagsError) {
        cb(searchTagsError);
      }
      break;
    case 'searchGroups':
      const groups = await searchGroups(
        actionParams.term,
        actionParams.groupTypes,
        actionParams.ownerIds,
        options
      );
      cb(null, {
        groups
      });
      break;
    default:
      cb(null, {});
  }
};

module.exports = {
  doLookup,
  startup,
  validateOptions,
  onMessage
};
