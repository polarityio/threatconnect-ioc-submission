polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  maxUniqueKeyNumber: Ember.computed.alias('details.maxUniqueKeyNumber'),
  url: Ember.computed.alias('details.url'),
  description: '',
  groupType: '',
  groupID: '',
  title: '',
  source: '',
  whoisActive: false,
  dnsActive: false,
  rating: 0,
  ratingHuman: 'Unknown',
  confidence: 0,
  confidenceHuman: 'Unassessed',
  foundEntities: [],
  groups: [],
  newIocs: [],
  newIocsToSubmit: [],
  selectedTags: [],
  deleteMessage: '',
  deleteErrorMessage: '',
  deleteIsRunning: false,
  isDeleting: false,
  entityToDelete: {},
  createMessage: '',
  createErrorMessage: '',
  createIsRunning: false,
  selectedTag: [],
  editingTags: false,
  showOwnershipMessage: false,
  maxTagsInBlock: 10,
  isExpanded: true,
  interactionDisabled: Ember.computed('isDeleting', 'createIsRunning', function () {
    const interactionDisabled =
      this.get('isDeleting') ||
      this.get('showOwnershipMessage') ||
      this.get('createIsRunning');

    return interactionDisabled;
  }),
  isInMyOwner: Ember.computed('foundEntities.@each.ownershipStatus', function () {
    return this.foundEntities.some(
      (foundEntity) => foundEntity.ownershipStatus === 'inMyOwner'
    );
  }),
  isNotInMyOwner: Ember.computed('foundEntities.@each.ownershipStatus', function () {
    return this.foundEntities.some(
      (foundEntity) => foundEntity.ownershipStatus === 'notInMyOwner'
    );
  }),
  init() {
    this.set(
      'newIocs',
      this.get(`details.notFoundEntities${this.get('maxUniqueKeyNumber')}`)
    );

    this.set(
      'foundEntities',
      this.get(`details.foundEntities${this.get('maxUniqueKeyNumber')}`)
    );
    this.set('groups', this.get(`details.groups${this.get('maxUniqueKeyNumber')}`));

    this.set('selectedTags', [
      {
        name: 'Submitted By Polarity'
      }
    ]);

    this._super(...arguments);
  },
  observer: Ember.on(
    'willUpdate',
    Ember.observer('details.maxUniqueKeyNumber', function () {
      if (this.get('maxUniqueKeyNumber') !== this.get('_maxUniqueKeyNumber')) {
        this.set('_maxUniqueKeyNumber', this.get('maxUniqueKeyNumber'));

        this.set(
          'newIocs',
          this.get(`details.notFoundEntities${this.get('maxUniqueKeyNumber')}`)
        );

        this.set(
          'foundEntities',
          this.get(`details.foundEntities${this.get('maxUniqueKeyNumber')}`)
        );

        this.set('groups', this.get(`details.groups${this.get('maxUniqueKeyNumber')}`));

        this.set('newIocsToSubmit', []);
      }
    })
  ),
  searchTags: function (term, resolve, reject) {
    const outerThis = this;
    outerThis.set('createMessage', '');
    outerThis.set('createErrorMessage', '');
    outerThis.get('block').notifyPropertyChange('data');

    outerThis
      .sendIntegrationMessage({
        data: {
          action: 'searchTags',
          term,
          selectedTags: this.get('selectedTags')
        }
      })
      .then(({ tags }) => {
        outerThis.set(
          'existingTags',
          [...(term ? [{ name: term, isNew: true }] : [])].concat(tags)
        );
      })
      .catch((err) => {
        outerThis.set(
          'createErrorMessage',
          'Search Tags Failed: ' +
            (err &&
              (err.detail || err.err || err.message || err.title || err.description)) ||
            'Unknown Reason'
        );
      })
      .finally(() => {
        outerThis.get('block').notifyPropertyChange('data');
        setTimeout(() => {
          outerThis.set('createMessage', '');
          outerThis.set('createErrorMessage', '');
          outerThis.get('block').notifyPropertyChange('data');
        }, 5000);
        resolve();
      });
  },
  actions: {
    toggleIsExpanded(foundEntity) {
      Ember.set(foundEntity, 'isExpanded', !foundEntity.isExpanded);
    },
    toggleOwnershipMessage: function () {
      this.toggleProperty('showOwnershipMessage');
    },
    initiateItemDeletion: function (entity) {
      this.set('isDeleting', true);
      this.set('entityToDelete', entity);
    },
    cancelItemDeletion: function () {
      this.set('isDeleting', false);
      this.set('entityToDelete', {});
    },
    confirmDelete: function () {
      const outerThis = this;
      outerThis.set('deleteMessage', '');
      outerThis.set('deleteErrorMessage', '');
      outerThis.set('deleteIsRunning', true);
      outerThis.get('block').notifyPropertyChange('data');

      outerThis
        .sendIntegrationMessage({
          data: {
            action: 'deleteItem',
            entity: outerThis.get('entityToDelete'),
            newIocs: outerThis.get('newIocs'),
            foundEntities: outerThis.get('foundEntities')
          }
        })
        .then(({ newIocs, newList }) => {
          outerThis.set('newIocs', newIocs);
          outerThis.set('foundEntities', newList);
          outerThis.set('deleteMessage', 'Successfully Deleted IOC');
        })
        .catch((err) => {
          outerThis.set(
            'deleteErrorMessage',
            'Failed to Delete IOC: ' +
              (err &&
                (err.detail || err.err || err.message || err.title || err.description)) ||
              'Unknown Reason'
          );
        })
        .finally(() => {
          this.set('isDeleting', false);
          this.set('entityToDelete', {});
          outerThis.set('deleteIsRunning', false);
          outerThis.get('block').notifyPropertyChange('data');
          setTimeout(() => {
            outerThis.set('deleteMessage', '');
            outerThis.set('deleteErrorMessage', '');
            outerThis.get('block').notifyPropertyChange('data');
          }, 5000);
        });
    },
    removeAllSubmitItems: function () {
      const foundIOCs = this.get('newIocsToSubmit').filter((ioc) => ioc.resultsFound);
      const allFoundIOCs = this.get('foundEntities').concat(foundIOCs);
      const newIOCs = this.get('newIocsToSubmit').filter((ioc) => !ioc.resultsFound);
      const allNewIOCs = this.get('newIocs').concat(newIOCs);

      this.set('newIocs', allNewIOCs);
      this.set('foundEntities', allFoundIOCs);
      this.set('newIocsToSubmit', []);

      this.get('block').notifyPropertyChange('data');
    },
    addAllSubmitItems: function () {
      const allIOCs = this.get('newIocs').concat(this.get('newIocsToSubmit'));

      this.set('newIocs', []);
      this.set('newIocsToSubmit', allIOCs);
      this.get('block').notifyPropertyChange('data');
    },
    removeSubmitItem: function (entity) {
      if (entity.resultsFound) {
        this.set('foundEntities', this.get('foundEntities').concat(entity));
      } else {
        this.set('newIocs', this.get('newIocs').concat(entity));
      }
      this.set(
        'newIocsToSubmit',
        this.get('newIocsToSubmit').filter(({ value }) => value !== entity.value)
      );

      this.get('block').notifyPropertyChange('data');
    },
    addSubmitItem: function (entity) {
      this.set(
        'foundEntities',
        this.get('foundEntities').filter(({ value }) => value !== entity.value)
      );
      this.set(
        'newIocs',
        this.get('newIocs').filter(({ value }) => value !== entity.value)
      );
      const updatedNewIocsToSubmit = this.get('newIocsToSubmit').concat(entity);
      console.log('GROUPS', this.get('groups'));
      this.set('newIocsToSubmit', updatedNewIocsToSubmit);

      this.get('block').notifyPropertyChange('data');
    },
    submitItems: function () {
      const outerThis = this;
      const possibleParamErrors = [
        {
          condition: () => !outerThis.get('newIocsToSubmit').length,
          message: 'No Items to Submit...'
        }
      ];

      const paramErrorMessages = possibleParamErrors.reduce(
        (agg, possibleParamError) =>
          possibleParamError.condition() ? agg.concat(possibleParamError.message) : agg,
        []
      );

      if (paramErrorMessages.length) {
        outerThis.set('createErrorMessage', paramErrorMessages[0]);
        outerThis.get('block').notifyPropertyChange('data');
        setTimeout(() => {
          outerThis.set('createErrorMessage', '');
          outerThis.get('block').notifyPropertyChange('data');
        }, 5000);
        return;
      }

      outerThis.set('createMessage', '');
      outerThis.set('createErrorMessage', '');
      outerThis.set('createIsRunning', true);
      outerThis.get('block').notifyPropertyChange('data');
      outerThis
        .sendIntegrationMessage({
          data: {
            action: 'submitItems',
            newIocsToSubmit: outerThis.get('newIocsToSubmit'),
            description: outerThis.get('description'),
            title: outerThis.get('title'),
            source: outerThis.get('source'),
            whoisActive: outerThis.get('whoisActive'),
            dnsActive: outerThis.get('dnsActive'),
            rating: outerThis.get('rating'),
            confidence: outerThis.get('confidence'),
            foundEntities: outerThis.get('foundEntities'),
            submitTags: outerThis.get('selectedTags'),
            groupType: outerThis.get('groupType'),
            groupID: outerThis.get('groupID')
          }
        })
        .then(({ foundEntities, exclusionListEntities }) => {
          const filteredFoundEntities = foundEntities.filter(
            (entity) => !exclusionListEntities.includes(entity.value)
          );
          filteredFoundEntities.forEach((entity) => {
            if (
              outerThis.get('newIocsToSubmit').some((ioc) => ioc.value === entity.value)
            ) {
              entity.ownershipStatus = 'inMyOwner';
            }
          });
          outerThis.set('foundEntities', filteredFoundEntities);
          outerThis.set('exclusionListEntities', exclusionListEntities, []);
          outerThis.set('newIocsToSubmit', []);
          outerThis.set('createMessage', 'Successfully Created IOCs');
          outerThis.set('groupID', '');
        })
        .catch((err) => {
          outerThis.set(
            'createErrorMessage',
            'Failed to Create IOC: ' +
              (err && err.title ? `"${err.title}" - ` : '') +
              (err && (err.detail || err.message || err.title || err.description)) ||
              'Unknown Reason'
          );
        })
        .finally(() => {
          outerThis.set('createIsRunning', false);
          outerThis.get('block').notifyPropertyChange('data');
          setTimeout(() => {
            outerThis.set('createMessage', '');
            outerThis.set('createErrorMessage', '');
            outerThis.get('block').notifyPropertyChange('data');
          }, 5000);
        });
    },
    editTags: function () {
      this.toggleProperty('editingTags');
      this.get('block').notifyPropertyChange('data');
    },
    deleteTag: function (tagToDelete) {
      this.set(
        'selectedTags',
        this.get('selectedTags').filter(
          (selectedTag) => selectedTag.name !== tagToDelete.name
        )
      );
    },
    searchTags: function (term) {
      return new Ember.RSVP.Promise((resolve, reject) => {
        Ember.run.debounce(this, this.searchTags, term, resolve, reject, 600);
      });
    },
    addTags: function (tags) {
      const selectedTag = this.get('selectedTag');
      const selectedTags = this.get('selectedTags');

      this.set('createMessage', '');

      let newSelectedTags = selectedTag.filter(
        (tag) =>
          !selectedTags.some(
            (selectedTag) =>
              tag.name.toLowerCase().trim() === selectedTag.name.toLowerCase().trim()
          )
      );

      this.set('selectedTags', selectedTags.concat(newSelectedTags));
      this.set('selectedTag', []);
      this.set('editingTags', false);
    },
    setRating: function (rating) {
      const RATING_TO_TEXT = {
        0: 'Unknown',
        1: 'Suspicious',
        2: 'Low',
        3: 'Moderate',
        4: 'High',
        5: 'Critical'
      };

      this.set('rating', rating);
      this.set('ratingHuman', RATING_TO_TEXT[rating] || 'Unknown');
    },
    setConfidence: function (confidence) {
      const CONFIDENCE_TO_TEXT = !confidence
        ? 'Unassessed'
        : confidence <= 25
        ? 'Improbable'
        : confidence <= 49
        ? 'Doubtful'
        : confidence <= 69
        ? 'Possible'
        : confidence <= 89
        ? 'Probable'
        : 'Confirmed';

      this.set('confidence', confidence);
      this.set('confidenceHuman', CONFIDENCE_TO_TEXT);
    }
  }
});
