const polarityRequest = require('../polarity-request');
const { ApiRequestError } = require('../errors');
const { getLogger } = require('../logger');
const SUCCESS_CODES = [200];

const POLARITY_TYPE_TO_THREATCONNECT_TYPE = {
  IPv4: 'Address',
  IPv6: 'Address',
  hash: 'File',
  MD5: 'File',
  SHA1: 'File',
  SHA256: 'File',
  email: 'EmailAddress',
  domain: 'Host',
  url: 'Url'
};

// Note that we cannot use the `hash` type here
// https://docs.threatconnect.com/en/latest/rest_api/v3/indicators/indicators.html#indicator-specific-fields
const POLARITY_TYPE_TO_INDICATOR_VALUE_FIELD = {
  IPv4: 'ip',
  IPv6: 'ip',
  MD5: 'md5',
  SHA1: 'sha1',
  SHA256: 'sha256',
  email: 'address',
  domain: 'hostName',
  url: 'text'
};

/**
 *
 * @param entity
 * @param fields
 * ```
 * ownerId,
 * title,
 * description,
 * source,
 * tags,
 * groups,
 * rating,
 * confidence
 * ```
 * @param options
 * @returns {Promise<*>}
 */
async function updateIndicator(indicatorToUpdate, entity, fields, options) {
  const Logger = getLogger();

  // throw new ApiRequestError(
  //   `Unexpected status code 400 received when creating indicator via ThreatConnect API`,
  //   {
  //     responseBody: {
  //       message: 'exclusion list'
  //     }
  //   }
  // );

  // throw new ApiRequestError(
  //   `Unexpected status code 400 received when creating indicator via ThreatConnect API`
  // );

  const body = {};

  // Update `body` to include all the relevant indicator fields
  addAttributes(body, fields);
  addAssociatedGroups(body, fields);
  addAssociatedTags(body, fields);
  addDomainSpecificFields(body, entity, fields);
  addOther(body, fields);

  const requestOptions = {
    uri: `${options.url}/v3/indicators/${indicatorToUpdate.id}`,
    method: 'PUT',
    qs: {
      fields: 'threatAssess'
    },
    useQuerystring: true,
    body
  };

  Logger.trace({ requestOptions }, 'Update Indicator Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'Update indicator API Response');

  if (
    !SUCCESS_CODES.includes(apiResponse.statusCode) ||
    (apiResponse.body && apiResponse.body.status && apiResponse.body.status !== 'Success')
  ) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when updating indicator via ThreatConnect API`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions: apiResponse.requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  return apiResponse.body.data;
}

function addOther(body, fields) {
  if (typeof fields.confidence !== 'undefined') {
    body.confidence = fields.confidence;
  }

  if (typeof fields.rating !== 'undefined') {
    body.rating = fields.rating;
  }
}

function addDomainSpecificFields(body, entity, fields) {
  if (!entity.isDomain) {
    return;
  }

  if (typeof fields.whoisActive === 'boolean') {
    body.whoisActive = fields.whoisActive;
  }

  if (typeof fields.dnsActive === 'boolean') {
    body.dnsActive = fields.dnsActive;
  }
}

function addAssociatedTags(body, fields) {
  if (Array.isArray(fields.tags) && fields.tags.length > 0) {
    body.tags = {
      data: fields.tags.map((tag) => {
        if (tag.id) {
          return {
            id: tag.id
          };
        } else {
          return {
            name: tag.name
          };
        }
      }),
      mode: 'append'
    };
  }
}

function addAssociatedGroups(body, fields) {
  if (Array.isArray(fields.groups) && fields.groups.length > 0) {
    body.associatedGroups = {
      data: fields.groups.map((group) => {
        return {
          id: group.id
        };
      }),
      mode: 'append'
    };
  }
}

/**
 * Adds attributes data to the body the create payload which include
 * "title", "description", and "source"
 * Mutates, the provided `body` property
 * @param fields
 */
function addAttributes(body, fields) {
  const data = [];
  if (typeof fields.source === 'string' && fields.source.length > 0) {
    data.push({
      type: 'Source',
      value: fields.source
      //default: true
    });
  }

  if (typeof fields.title === 'string' && fields.title.length > 0) {
    data.push({
      type: 'Title',
      value: fields.title
      //default: true
    });
  }

  if (typeof fields.description === 'string' && fields.description.length > 0) {
    data.push({
      type: 'Description',
      value: fields.description
      //default: true
    });
  }

  if (data.length > 0) {
    body.attributes = {
      data,
      mode: 'replace'
    };
  }
}

module.exports = {
  updateIndicator
};
