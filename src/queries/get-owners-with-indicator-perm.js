const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const SUCCESS_CODES = [200];

/**
 * Returns array of owners that the requesting user has FULL indicator permission on.  Each returned owner
 * object has the following properties per owner:
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
async function getOwnersWithIndicatorPerm(options, permissionObject = []) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.url}/v3/security/owners`,
    qs: {
      tql: `permIndicator eq "FULL"`,
      sorting: 'ownerName ASC'
    },
    method: 'GET',
    useQuerystring: true
  };

  Logger.trace({ requestOptions }, 'Fetch owners with full indicator permission');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'API Response when fetching owners with full indicator permission');

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

  return apiResponse.body.data.map(owner => {
    return {
      id: owner.id,
      name: owner.name,
      type: owner.type,
      ownerRole: owner.ownerRole
    };
  })
}

module.exports = {
  getOwnersWithIndicatorPerm
};
