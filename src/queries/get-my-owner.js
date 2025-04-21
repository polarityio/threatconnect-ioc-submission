const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const SUCCESS_CODES = [200];

async function getMyOwner(options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.url}/v2/owners/mine`,
    method: 'GET',
    useQuerystring: true
  };

  Logger.trace({ requestOptions }, 'Fetch my owner');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'API Response when fetching my owner');

  if (
    !SUCCESS_CODES.includes(apiResponse.statusCode) ||
    (apiResponse.body && apiResponse.body.status && apiResponse.body.status !== 'Success')
  ) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when fetching my owner via ThreatConnect API`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions: apiResponse.requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  return apiResponse.body.data.owner;
}

module.exports = {
  getMyOwner
};
