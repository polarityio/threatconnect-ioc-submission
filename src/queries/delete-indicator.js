const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const SUCCESS_CODES = [200];

async function deleteIndicator(indicatorId, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.url}/v3/indicators/${indicatorId}`,
    method: 'DELETE',
    useQuerystring: true
  };

  Logger.trace({ requestOptions }, 'Delete Indicator Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'Delete indicator API Response');

  if (
    !SUCCESS_CODES.includes(apiResponse.statusCode) ||
    (apiResponse.body && apiResponse.body.status && apiResponse.body.status !== 'Success')
  ) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when deleting indicator via ThreatConnect API`,
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
  deleteIndicator
};
