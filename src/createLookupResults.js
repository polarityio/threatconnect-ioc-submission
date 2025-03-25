const fp = require('lodash/fp');
const { ENTITY_TYPES } = require('./constants');

let maxUniqueKeyNumber = 0;

const createLookupResults = (
  options,
  entities,
  groups,
  _foundEntities,
  myOwner,
  allOwners,
  Logger
) => {
  const foundEntities = fp.flow(
    fp.filter(fp.get('resultsFound')),
    fp.map((foundEntity) => ({
      ...foundEntity,
      displayedType: ENTITY_TYPES[foundEntity.type] || 'hash'
    }))
  )(_foundEntities);

  const notFoundEntities = getNotFoundEntities(foundEntities, entities);
  const summary = [
    ...(foundEntities.length ? ['Entities Found'] : []),
    ...(notFoundEntities.length ? ['New Entities'] : [])
  ];
  maxUniqueKeyNumber++;

  return [
    {
      entity: {
        ...entities[0],
        value: 'ThreatConnect IOC Submission'
      },
      displayValue: 'ThreatConnect IOC Submission',
      isVolatile: true,
      data: {
        summary: [
          ...(foundEntities.length ? ['Entities Found'] : []),
          ...(notFoundEntities.length ? ['New Entities'] : [])
        ],
        details: {
          uiUrl: getUiUrl(options.url),
          maxUniqueKeyNumber,
          owner: myOwner,
          [`summary${maxUniqueKeyNumber}`]: summary,
          [`groups${maxUniqueKeyNumber}`]: groups,
          [`foundEntities${maxUniqueKeyNumber}`]: foundEntities,
          [`notFoundEntities${maxUniqueKeyNumber}`]: notFoundEntities,
          allOwners: allOwners
        }
      }
    }
  ];
};

const getUiUrl = fp.flow(
  fp.thru((x) => /^((http[s]?|ftp):\/)\/?([^:\/\s]+)/g.exec(x)),
  fp.first
);

const getNotFoundEntities = (foundEntities, entities) =>
  fp.reduce(
    (agg, entity) =>
      !fp.any(
        ({ value }) => fp.lowerCase(entity.value) === fp.lowerCase(value),
        foundEntities
      )
        ? agg.concat({
            ...entity,
            displayedType: fp.includes('IP', entity.type) ? 'ip' : fp.toLower(entity.type)
          })
        : agg,
    [],
    entities
  );

module.exports = createLookupResults;
