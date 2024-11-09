const fp = require('lodash/fp');

const searchTags = async (
  { term, selectedTags },
  requestWithDefaults,
  options,
  Logger,
  callback
) => {
  try {
    const tagResults = fp.getOr(
      [],
      'body.data.tag',
      await requestWithDefaults({
        path: `tags?detailed=true${
          !term ? '' : `&filters=name%5E${encodeURIComponent(term)}`
        }`,
        method: 'GET',
        options
      })
    );

    const tags = fp.flow(
      fp.filter((tagResult) =>
        fp.every(
          (selectedTag) =>
            _getComparableString(tagResult) !== _getComparableString(selectedTag),
          selectedTags
        )
      ),
      fp.uniqBy(_getComparableString),
      fp.sortBy('name'),
      fp.slice(0, 50),
    )(tagResults);
    callback(null, { tags });
  } catch (error) {
    Logger.error(error, { detail: 'Failed to Get Tags from ThreatConnect' }, 'Get Tags Failed');
    return callback({
      errors: [
        {
          err: error,
          detail: error.message
        }
      ]
    });
  }
};

const _getComparableString = fp.flow(fp.getOr('', 'name'), fp.lowerCase, fp.trim);

module.exports = searchTags;