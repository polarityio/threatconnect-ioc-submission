const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const { convertPolarityTypeToThreatConnectSingular } = require('../tc-request-utils');

const SUCCESS_CODES = [200];
const MAX_ATTRIBUTES_RETURNED = 10000;

/**
 *
 * @param attributeType - ThreatConnect attribute type (e.g., address)
 * @param options
 * @returns {Promise<*>}
 */
async function getAttributesForType(attributeType, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.url}/v3/attributeTypes`,
    qs: {
      tql: `associatedType IN ("${attributeType}")`,
      resultLimit: MAX_ATTRIBUTES_RETURNED
    },
    method: 'GET',
    useQuerystring: true
  };

  Logger.trace({ requestOptions }, `Request options to get attribute types`);

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'API Response when fetching attribute types');

  if (
    !SUCCESS_CODES.includes(apiResponse.statusCode) ||
    (apiResponse.body && apiResponse.body.status && apiResponse.body.status !== 'Success')
  ) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when fetching attribute types via ThreatConnect API`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions: apiResponse.requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  const enrichedAttributes = apiResponse.body.data.map((attribute) => {
    // attribute `text` is a semicolon delimited list of valid values
    if (
      attribute.validationRule &&
      attribute.validationRule.text &&
      (attribute.validationRule.type === 'SelectRadio' ||
        attribute.validationRule.type === 'SelectOne')
    ) {
      attribute.validationRule.__values = attribute.validationRule.text.split(';');
    }

    // If numer, get min and max from `text field
    if (
      attribute.validationRule &&
      attribute.validationRule.text &&
      attribute.validationRule.type === 'Integer'
    ) {
      const tokens = attribute.validationRule.text.split(':');
      if (
        tokens.length === 2 &&
        Number.isInteger(Number(tokens[0])) &&
        Number.isInteger(Number(tokens[1]))
      ) {
        attribute.validationRule.__min = tokens[0];
        attribute.validationRule.__max = tokens[1];
      }
    }
    return attribute;
  });

  Logger.trace({ enrichedAttributes }, 'Enriched Attributes');

  return enrichedAttributes;
}

module.exports = {
  getAttributesForType
};
