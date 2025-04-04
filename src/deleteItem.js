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
    let owner = entity.createdIndicatorsOwner.name;

    await requestWithDefaults({
      method: 'DELETE',
      path: `indicators/${POLARITY_TYPE_TO_THREATCONNECT[entity.type]}/${
        entity.value
      }?owner=${encodeURIComponent(owner)}`,
      options
    });
  } catch (error) {
    Logger.error(error, `Attribute Deletion Error ${entity.value}`);
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

  let updatedEntity = { ...entity, canDelete: false };
  if (!shouldRemoveIocFromAlreadyIn) {
    updatedEntity.ownershipStatus = 'notInMyOwner'; // Keep in `foundEntities` as "notInMyOwner"
  }

  const newList = fp.flow(
    fp.filter(({ value }) => value !== entity.value),
    fp.thru((entities) =>
      shouldRemoveIocFromAlreadyIn ? entities : entities.concat(updatedEntity)
    )
  )(foundEntities);

  const newIocs = [
    ...(shouldRemoveIocFromAlreadyIn ? [{ ...entity, ownershipStatus: 'new' }] : []),
    ..._newIocs
  ];

  return callback(null, { newList, newIocs });
};

module.exports = deleteItem;
