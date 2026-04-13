const polarityRequest = require('../polarity-request');
const { getLogger } = require('../logger');
const SUCCESS_CODES = [200];

/**
 * Fetches all available security labels from ThreatConnect (including TLP labels).
 * Returns the full label list including org-custom labels alongside system TLP labels.
 *
 * On API failure, logs the error and returns an empty array so the submission form
 * remains fully functional without a TLP field (non-blocking per INT-1740).
 *
 * @param {Object} options - Integration options containing url and credentials
 * @returns {Promise<Array>} Array of label objects: [{ id, name, color, description, owner }]
 */
async function getSecurityLabels(options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.url}/v3/securityLabels`,
    method: 'GET',
    useQuerystring: true
  };

  Logger.trace({ requestOptions }, 'Get Security Labels Request Options');

  let apiResponse = await polarityRequest.request(requestOptions, options);

  const labels = (apiResponse.body && apiResponse.body.data) || [];
  Logger.trace({ labelCount: labels.length }, 'Security labels fetched successfully');
  return labels;
}

module.exports = { getSecurityLabels };
