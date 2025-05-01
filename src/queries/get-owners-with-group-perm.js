const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const SUCCESS_CODES = [200];

/**
 * Returns array of all owners who have at least READ access to groups
 *
 * ```
 * id
 * name
 * type
 * ownerRole
 * ```
 *
 * @param options
 * @param permissionObject
 * @returns {Promise<*>}
 */
async function getOwnersWithGroupPerm(options, permissionObject = []) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.url}/v3/security/owners`,
    qs: {
      sorting: 'ownerName ASC',
      tql: 'permGroup IN ("FULL", "READ")'
    },
    method: 'GET',
    useQuerystring: true
  };

  Logger.trace({ requestOptions }, 'Fetch all owners');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'API Response when fetching all owners');

  if (
    !SUCCESS_CODES.includes(apiResponse.statusCode) ||
    (apiResponse.body && apiResponse.body.status && apiResponse.body.status !== 'Success')
  ) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when fetching owners with full indicator permission via ThreatConnect API`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions: apiResponse.requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  return apiResponse.body.data.map((owner) => {
    return {
      id: owner.id,
      name: owner.name,
      type: owner.type,
      ownerRole: owner.ownerRole
    };
  });
}

module.exports = {
  getOwnersWithGroupPerm
};
