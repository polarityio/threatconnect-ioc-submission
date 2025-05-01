const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const SUCCESS_CODES = [200];

async function searchTags(searchTerm, ownerId, options) {
  const Logger = getLogger();

  let tql = '';

  const requestOptions = {
    uri: `${options.url}/v3/tags`,
    method: 'GET',
    useQuerystring: true
  };

  if (typeof searchTerm === 'string' && searchTerm.length > 0) {
    tql += `name STARTSWITH "${searchTerm}"`;
  }

  if (ownerId) {
    if (tql.length > 0) {
      tql += ' AND ';
    }
    tql += `owner EQ ${ownerId}`;
  }

  if (tql.length > 0) {
    requestOptions.qs = {
      tql
    };
  }

  Logger.trace({ requestOptions }, 'Search Tags Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'Search API Response when Searching Tags');

  if (
    !SUCCESS_CODES.includes(apiResponse.statusCode) ||
    (apiResponse.body && apiResponse.body.status && apiResponse.body.status !== 'Success')
  ) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when searching tags via ThreatConnect API`,
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
  searchTags
};
