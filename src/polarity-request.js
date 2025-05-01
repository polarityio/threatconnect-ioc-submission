const fs = require('fs');
const crypto = require('crypto');
const url = require('url');
const querystring = require('querystring');

const request = require('postman-request');
const { getLogger } = require('./logger');
const { NetworkError } = require('./errors');

const {
  request: { ca, cert, key, passphrase, rejectUnauthorized, proxy }
} = require('../config/config.js');

const _configFieldIsValid = (field) => typeof field === 'string' && field.length > 0;

const defaults = {
  ...(_configFieldIsValid(ca) && { ca: fs.readFileSync(ca) }),
  ...(_configFieldIsValid(cert) && { cert: fs.readFileSync(cert) }),
  ...(_configFieldIsValid(key) && { key: fs.readFileSync }),
  ...(_configFieldIsValid(passphrase) && { passphrase }),
  ...(_configFieldIsValid(proxy) && { proxy }),
  ...(typeof rejectUnauthorized === 'boolean' && { rejectUnauthorized }),
  json: true
};

function unixEpochTimeInSeconds() {
  return Math.floor(Date.now() / 1000);
}

/**
 *
 */
class PolarityRequest {
  constructor() {
    this.requestWithDefaults = request.defaults(defaults);
  }

  async request(requestOptions, userOptions) {
    return new Promise(async (resolve, reject) => {
      const { time, authorization } = getAuthHeaders(requestOptions, userOptions);

      if (!requestOptions.headers) {
        requestOptions.headers = {};
      }

      requestOptions.headers.Authorization = authorization;
      requestOptions.headers.Timestamp = time;
      requestOptions.json = true;

      this.requestWithDefaults(requestOptions, (err, response) => {
        if (err) {
          return reject(
            new NetworkError('Unable to complete network request', {
              cause: err,
              requestOptions
            })
          );
        }
        resolve(response);
      });
    });
  }
}

function getAuthHeaders(requestOptions, userOptions) {
  const urlParts = url.parse(requestOptions.uri);
  const path = urlParts.pathname;
  const time = unixEpochTimeInSeconds();
  const accessId = userOptions.accessId;
  const key = userOptions.apiKey;
  let qs = '';
  if (requestOptions.qs) {
    // Use our custom encodeURIComponent to make sure the way we encode the query string for the signature
    // matches the way postman encodes the component.
    qs = querystring.stringify(requestOptions.qs, null, null, {
      encodeURIComponent: fixedEncodeURIComponent
    });
  }

  const toSign = `${path}${qs ? '?' + qs : ''}:${requestOptions.method.toUpperCase()}:${time}`;

  const hmacSignatureInBase64 = crypto.createHmac('sha256', key).update(toSign).digest('base64');
  const authorization = `TC ${accessId}:${hmacSignatureInBase64}`;

  getLogger().trace({ toSign, path, time, accessId, key, authorization, urlParts }, 'Auth Header');

  return { time, authorization };
}

/**
 * This method is used to encode the URI query params which is required by TC for authentication.  The URI Path
 * must match how the Postman Request library encodes the URL or authentication will fail.  The built-in encodeURIComponent
 * does not encode the following characters `!'()*` which prevents authentication from working as the signature
 * will have its query params encoded differently then the actual path used in the request.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
 * @param str
 * @returns {string}
 * @private
 */
function fixedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
}

module.exports = new PolarityRequest();
