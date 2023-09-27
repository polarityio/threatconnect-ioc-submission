const STATUS_CODE_ERROR_MESSAGE = {
  400: (error) => ({
    err: error.message,
    detail: error.description
  }),
  401: (error) => ({
    err: 'Unauthorized',
    detail: `Unable to retrieve Auth Token -> ${error.description}`
  }),
  404: (error) => ({
    err: 'Not Found',
    detail:
      'Requested item doesn’t exist or not enough access permissions -> ' +
      `${error.description}`
  }),
  500: (error) => ({
    err: 'Server Error',
    detail: `Unexpected Server Error -> ${error.description}`
  }),
  internalServiceError: (error) => ({
    err: 'Internal Service Error',
    detail: `Internal Service Error -> ${error.description}`
  }),
  unknown: (error) =>
    error.message.includes('getaddrinfo ENOTFOUND')
      ? {
          err: 'Url Not Found',
          detail: `The Url you used in options was Not Found -> ${error.message}`
        }
      : error.message.includes('self signed certificate')
      ? {
          err: 'Problem with Certificate',
          detail: `A Problem was found with your Certificate -> ${error.message}`
        }
      : error.message.includes('Unexpected token < in JSON at position 0')
      ? {
          err: 'Problem with User Options',
          detail: `A Problem was found with your User Options -> Verify your Options are correct and your ThreatConnect Dashboard is working correctly.`
        }
      : {
          err: 'Unknown',
          detail: error.message
        }
};

const handleError = (error) =>
  (
    STATUS_CODE_ERROR_MESSAGE[error.status] ||
    STATUS_CODE_ERROR_MESSAGE[Math.round(error.status / 10) * 10] ||
    STATUS_CODE_ERROR_MESSAGE['unknown']
  )(error);

const checkForInternalServiceError = (statusCode, response) => {
  const { status } = response;
  if (['Error', 'Failure'].includes(status)) {
    const internalServiceError = Error(response.message);
    internalServiceError.status = 'internalServiceError';
    internalServiceError.description = response.message;
    throw internalServiceError;
  }
  return response;
};

module.exports = { handleError, checkForInternalServiceError };
