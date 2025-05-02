'use strict';

const async = require('async');
const validateOptions = require('./src/validateOptions');
const { searchTags } = require('./src/queries/search-tags');
const { searchGroups } = require('./src/queries/search-groups');
const { createIndicator } = require('./src/queries/create-indicator');
const { updateIndicator } = require('./src/queries/update-indicator');
const { deleteIndicator } = require('./src/queries/delete-indicator');
const { setLogger } = require('./src/logger');
const {
  getLookupResults,
  createFormattedSearchResult
} = require('./src/get-lookup-results');
const { getMyOwnerCached } = require('./src/get-my-owner-cached');
const { parseErrorToReadableJSON } = require('./src/errors');

let Logger;
const startup = (logger) => {
  Logger = logger;
  setLogger(logger);
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
      if (!options.allowDelete) {
        return cb({
          detail: 'Invalid operation'
        });
      }
      try {
        await deleteIndicator(actionParams.indicatorToDelete.id, options);
        await doLookup([actionParams.entity], options, (err, lookupResults) => {
          let results = lookupResults[0].data.details.results;
          let result = null;
          if (Array.isArray(results) && results.length > 0) {
            result = results[0];
          }
          cb(null, {
            result
          });
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
            let newOrUpdatedIndicator;

            const indicatorToUpdate = searchResultObject.indicators.find(
              (indicator) => indicator.ownerId === actionParams.owner.id
            );

            if (indicatorToUpdate) {
              // This indicator already exists in the owner so instead of creating a new indicator
              // we run the update logic
              newOrUpdatedIndicator = await updateIndicator(
                indicatorToUpdate,
                searchResultObject.entity,
                actionParams,
                options
              );
            } else {
              newOrUpdatedIndicator = await createIndicator(
                searchResultObject.entity,
                actionParams,
                options
              );
            }

            // We allow users to submit an indicator that already exists in the owner.  As a result, if we just
            // concat our existing indicators with the newly created indicator we might have a duplicate (i.e.,
            // the newly created indicator is really an update to an existing indicator).  As a result, we first
            // need to check for a duplicate and remove the old indicator before replacing with the newly updated
            // indicator
            const duplicateIndex = searchResultObject.indicators.findIndex(
              (existingIndicator) => existingIndicator.id === newOrUpdatedIndicator.id
            );
            if (duplicateIndex >= 0) {
              // we have a duplicate so remove it from our existing indicators
              searchResultObject.indicators.splice(duplicateIndex, 1);
            }

            const myOwner = await getMyOwnerCached(options);
            const formattedSearchResult = createFormattedSearchResult(
              searchResultObject.entity,
              searchResultObject.indicators.concat(newOrUpdatedIndicator),
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
              Logger.error(
                {
                  createError,
                  parsedError: parseErrorToReadableJSON(createError)
                },
                'Create Indicator Error'
              );
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
      if (!options.allowAssociation) {
        return cb({
          detail: 'Invalid operation'
        });
      }
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
