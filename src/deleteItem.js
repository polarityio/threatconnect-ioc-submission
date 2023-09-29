const fp = require('lodash/fp');
const { POLARITY_TYPE_TO_THREATCONNECT } = require('./constants');

const deleteItem = async (
  { entity, newIocs: _newIocs, foundEntities },
  requestWithDefaults,
  options,
  Logger,
  callback
) => {
  try {
    const id = foundEntities[0].id;

    await requestWithDefaults({
      method: 'DELETE',
      path: `/v3/indicators/${id}`,
      options
    });
  } catch (error) {
    Logger.error(error, 'Attribute Deletion Error');
    return callback({
      errors: [
        {
          err: error,
          detail: error.message
        }
      ]
    });
  }

  const shouldRemoveIocFromAlreadyIn =
    fp.flow(
      fp.getOr([], 'owners'),
      fp.filter((owner) => owner.id !== entity.myOwner.id),
      fp.size
    )(entity) === 0;

  const newList = fp.flow(
    fp.filter(({ value }) => value !== entity.value),
    fp.thru((entities) =>
      shouldRemoveIocFromAlreadyIn
        ? entities
        : entities.concat({ ...entity, canDelete: false })
    )
  )(foundEntities);

  const newIocs = [...(shouldRemoveIocFromAlreadyIn ? [entity] : []), ..._newIocs];

  return callback(null, { newList, newIocs });
};

module.exports = deleteItem;
