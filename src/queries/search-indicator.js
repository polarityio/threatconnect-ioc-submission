const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const { convertPolarityTypeToThreatConnectSingular } = require('../tc-request-utils');
const SUCCESS_CODES = [200];

async function searchIndicator(entity, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.url}/v3/indicators`,
    qs: {
      tql: createTqlQuery(entity, options)
    },
    method: 'GET',
    useQuerystring: true
  };

  Logger.trace({ requestOptions }, 'Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'Search API Response');

  if (
    !SUCCESS_CODES.includes(apiResponse.statusCode) ||
    (apiResponse.body && apiResponse.body.status && apiResponse.body.status !== 'Success')
  ) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when making search request to the ThreatConnect API`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions: apiResponse.requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  return apiResponse.body.data;
}

function createTqlQuery(entity, options) {
  const indicatorType = convertPolarityTypeToThreatConnectSingular(entity.type);

  let query = `(summary="${entity.value}"`;

  if (entity.types.includes('MD5')) {
    query += ` or value1="${entity.value}"`;
  }

  if (entity.types.includes('SHA1')) {
    query += ` or value2="${entity.value}"`;
  }

  if (entity.types.includes('SHA256')) {
    query += ` or value3="${entity.value}"`;
  }

  query += `) and typeName="${indicatorType}"`;
  
  return query;
}

module.exports = {
  searchIndicator
};
