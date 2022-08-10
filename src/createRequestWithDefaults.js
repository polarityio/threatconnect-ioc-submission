const fs = require('fs');
const request = require('request');
const config = require('../config/config');
const crypto = require('crypto');

const { checkForInternalServiceError } = require('./handleError');

const _configFieldIsValid = (field) => typeof field === 'string' && field.length > 0;

const createRequestWithDefaults = (Logger) => {
  const {
    request: { ca, cert, key, passphrase, rejectUnauthorized, proxy }
  } = config;

  const defaults = {
    ...(_configFieldIsValid(ca) && { ca: fs.readFileSync(ca) }),
    ...(_configFieldIsValid(cert) && { cert: fs.readFileSync(cert) }),
    ...(_configFieldIsValid(key) && { key: fs.readFileSync(key) }),
    ...(_configFieldIsValid(passphrase) && { passphrase }),
    ...(_configFieldIsValid(proxy) && { proxy }),
    ...(typeof rejectUnauthorized === 'boolean' && { rejectUnauthorized }),
    json: true
  };

  const requestWithDefaults = (
    preRequestFunction = async () => ({}),
    postRequestSuccessFunction = async (x) => x,
    postRequestFailureFunction = async (e) => { throw e; }
  ) => {
    const defaultsRequest = request.defaults(defaults)

    const _requestWithDefault = (requestOptions) =>
      new Promise((resolve, reject) => {
        defaultsRequest(requestOptions, (err, res, body) => {
          if (err) return reject(err);
          resolve({ ...res, body });
        });
      });

    return async (requestOptions) => {
      const preRequestFunctionResults = await preRequestFunction(requestOptions);
      const _requestOptions = {
        ...requestOptions,
        ...preRequestFunctionResults
      };

      let postRequestFunctionResults;
      try {
        const result = await _requestWithDefault(_requestOptions);
        checkForStatusError(result, _requestOptions);

        postRequestFunctionResults = await postRequestSuccessFunction(result);
      } catch (error) {
        postRequestFunctionResults = await postRequestFailureFunction(
          error,
          _requestOptions
        );
      }
      return postRequestFunctionResults;
    };
  };

  const handleAuth = async ({
    options: { url: _url, apiKey, accessId },
    path,
    ...requestOptions
  }) => {
    const uri = `${_url.endsWith('/') ? _url : `${_url}/`}v2/${path}`;

    const signaturePath = /(http[s]?:\/\/)?([^\/\s]+)(\/.*)/g.exec(uri)[3];
    
    let TimeStamp = Math.floor(Date.now() / 1000);
    let signature = signaturePath + ':' + requestOptions.method + ':' + TimeStamp;

    let hmacSignatureInBase64 = crypto
      .createHmac('sha256', apiKey)
      .update(signature)
      .digest('base64');

    const Authorization = 'TC ' + accessId + ':' + hmacSignatureInBase64;

    return {
      ...requestOptions,
      uri,
      headers: {
        ...requestOptions.headers,
        Authorization,
        TimeStamp
      }
    };
  };

  const checkForStatusError = ({ statusCode, body }, requestOptions) => {
    Logger.trace({
      statusCode,
      body,
      requestOptions: { ...requestOptions, options: '*************' }
    });
    checkForInternalServiceError(statusCode, body);
    const roundedStatus = Math.round(statusCode / 100) * 100;
    if (roundedStatus !== 200) {
      const requestError = Error('Request Error');
      requestError.status = statusCode;
      requestError.description = body;
      requestError.requestOptions = requestOptions;
      throw requestError;
    }
  };

  const requestDefaultsWithInterceptors = requestWithDefaults(handleAuth);

  return requestDefaultsWithInterceptors;
};

module.exports = createRequestWithDefaults;
