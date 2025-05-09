const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const SUCCESS_CODES = [200];

async function getGroupsByTypeName(typeName, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.url}/v3/groups`,
    qs: {
      tql: `typeName eq "${typeName}"`
    },
    method: 'GET',
    useQuerystring: true
  };

  Logger.trace({ requestOptions }, 'Fetch groups by type name request options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'Search API Response when fetching groups by type name');

  if (
    !SUCCESS_CODES.includes(apiResponse.statusCode) ||
    (apiResponse.body && apiResponse.body.status && apiResponse.body.status !== 'Success')
  ) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when fetching groups by type name via ThreatConnect API`,
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
  getGroupsByTypeName
};
