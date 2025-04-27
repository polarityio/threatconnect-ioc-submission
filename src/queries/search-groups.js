const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const SUCCESS_CODES = [200];

async function searchGroups(searchTerm, groupTypes, ownerIds, options) {
  const Logger = getLogger();
  let tql = '';

  const requestOptions = {
    uri: `${options.url}/v3/groups`,
    method: 'GET',
    useQuerystring: true
  };

  if (searchTerm) {
    tql += `summary CONTAINS "${searchTerm}"`;
  }

  if (groupTypes && groupTypes.length > 0) {
    if (tql.length > 0) {
      tql += ' AND ';
    }
    tql += `typeName IN (${groupTypes.map((type) => `"${type}"`).join(', ')})`;
  }

  if (ownerIds && ownerIds.length > 0) {
    if (tql.length > 0) {
      tql += ' AND ';
    }
    tql += `owner IN (${ownerIds.map((ownerId) => `${ownerId}`).join(', ')})`;
  }

  if (tql.length > 0) {
    requestOptions.qs = {
      tql
    };
  }

  Logger.trace({ requestOptions }, 'Search groups request options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'Search groups API Response');

  if (
    !SUCCESS_CODES.includes(apiResponse.statusCode) ||
    (apiResponse.body && apiResponse.body.status && apiResponse.body.status !== 'Success')
  ) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when searching groups via ThreatConnect API`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions: apiResponse.requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  return apiResponse.body.data;
}

module.exports = {
  searchGroups
};
