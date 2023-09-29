const fp = require('lodash/fp');
const { ENTITY_TYPES } = require('./constants');

let maxUniqueKeyNumber = 0;

const createLookupResults = (
  options,
  entities,
  groups,
  _foundEntities,
  myOwner,
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
    ...(notFoundEntities.length ? ['New Entites'] : [])
  ];
  maxUniqueKeyNumber++;

  // remove this for the real integration
  const test = (groups[0] = apiResponse.data);

  return [
    {
      entity: {
        ...entities[0],
        value: 'ThreatConnect IOC Submission'
      },
      isVolatile: true,
      data: {
        summary: [
          ...(foundEntities.length ? ['Entities Found'] : []),
          ...(notFoundEntities.length ? ['New Entites'] : [])
        ],
        details: {
          uiUrl: getUiUrl(options.url),
          maxUniqueKeyNumber,
          owner: myOwner,
          [`summary${maxUniqueKeyNumber}`]: summary,
          [`groups${maxUniqueKeyNumber}`]: test,
          [`foundEntities${maxUniqueKeyNumber}`]: foundEntities,
          [`notFoundEntities${maxUniqueKeyNumber}`]: notFoundEntities
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

const apiResponse = {
  data: [
    {
      id: 21731163,
      dateAdded: '2023-09-20T17:47:37Z',
      securityLabels: {},
      ownerId: 26,
      ownerName: 'Polarity',
      webLink:
        'https://partnerstage.threatconnect.com/#/details/groups/21731163/overview',
      tags: {},
      type: 'Report',
      name: 'Testing Reports',
      createdBy: {
        id: 30,
        userName: 'ed@polarity.io',
        firstName: 'Ed',
        lastName: 'Dorsey',
        pseudonym: 'spline',
        owner: 'Polarity'
      },
      upVoteCount: '0',
      downVoteCount: '0',
      generatedReport: true,
      attributes: {},
      fileName: 'testing-reports.pdf',
      fileSize: 10307,
      status: 'Success',
      documentType: 'PDF',
      documentDateAdded: '2023-09-20T17:47:37Z',
      lastModified: '2023-09-29T15:35:16Z',
      legacyLink:
        'https://partnerstage.threatconnect.com/auth/report/report.xhtml?report=21731163'
    },
    {
      id: 21731163,
      dateAdded: '2023-09-20T17:47:37Z',
      securityLabels: {},
      ownerId: 26,
      ownerName: 'Polarity',
      webLink:
        'https://partnerstage.threatconnect.com/#/details/groups/21731163/overview',
      tags: {},
      type: 'Report',
      name: 'Testing Reports',
      createdBy: {
        id: 30,
        userName: 'ed@polarity.io',
        firstName: 'Ed',
        lastName: 'Dorsey',
        pseudonym: 'spline',
        owner: 'Polarity'
      },
      upVoteCount: '0',
      downVoteCount: '0',
      generatedReport: true,
      attributes: {},
      fileName: 'testing-reports.pdf',
      fileSize: 10307,
      status: 'Success',
      documentType: 'PDF',
      documentDateAdded: '2023-09-20T17:47:37Z',
      lastModified: '2023-09-29T15:35:16Z',
      legacyLink:
        'https://partnerstage.threatconnect.com/auth/report/report.xhtml?report=21731163'
    }
  ],
  status: 'Success'
};

module.exports = createLookupResults;
