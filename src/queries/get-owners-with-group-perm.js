const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const SUCCESS_CODES = [200];

/**
 * Returns an array of all owners who have at least READ access to groups.
 *
 * Each result contains the following fields:
 * - `id`
 * - `name`
 * - `type`
 * - `ownerRole`
 *
 * @param options - API request options
 * @param permissionObject - Optional permission object
 * @returns {Promise<*>} - Array of owner objects
 */
async function getOwnersWithGroupPerm(options) {
  const Logger = getLogger();
  const resultLimit = 100;
  let resultStart = 0;
  let allOwners = [];
  let hasNext = true;

  while (hasNext) {
    const requestOptions = {
      uri: `${options.url}/v3/security/owners`,
      qs: {
        sorting: 'ownerName ASC',
        tql: 'permGroup IN ("FULL", "READ")',
        resultLimit,
        resultStart
      },
      method: 'GET',
      useQuerystring: true
    };

    Logger.trace({ requestOptions }, 'Request options to fetch owners with group permissions');

    const apiResponse = await polarityRequest.request(requestOptions, options);

    Logger.trace({ apiResponse }, 'API Response when fetching owners with group permissions');

    if (
      !SUCCESS_CODES.includes(apiResponse.statusCode) ||
      (apiResponse.body &&
        apiResponse.body.status &&
        apiResponse.body.status !== 'Success')
    ) {
      throw new ApiRequestError(
        `Unexpected status code ${apiResponse.statusCode} received when fetching owners with full or read group permission via ThreatConnect API`,
        {
          statusCode: apiResponse.statusCode,
          requestOptions: apiResponse.requestOptions,
          responseBody: apiResponse.body
        }
      );
    }

    const owners = apiResponse.body.data.map((owner) => ({
      id: owner.id,
      name: owner.name,
      type: owner.type,
      ownerRole: owner.ownerRole
    }));

    allOwners = allOwners.concat(owners);

    // Continue fetching if the response contains a `next` property
    hasNext = apiResponse.body.next !== undefined;
    resultStart += resultLimit;
  }

  return allOwners;
}

module.exports = {
  getOwnersWithGroupPerm
};
