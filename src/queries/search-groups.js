const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const SUCCESS_CODES = [200];

async function searchGroups(searchTerm, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.url}/v3/groups`,
    qs: {
      tql: `name STARTSWITH ${searchTerm}`
    },
    method: 'GET',
    useQuerystring: true
  };

  Logger.trace({ requestOptions }, 'Search Tags Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'Search API Response when Searching Groups');

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

  return apiResponse.body;
}

module.exports = {
  searchGroups
};
