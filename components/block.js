polarity.export = PolarityComponent.extend({
  timezone: Ember.computed('Intl', function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  flashMessages: Ember.inject.service('flashMessages'),
  details: Ember.computed.alias('block.data.details'),
  maxUniqueKeyNumber: Ember.computed.alias('details.maxUniqueKeyNumber'),
  url: Ember.computed.alias('details.url'),
  ownersWithCreatePermission: Ember.computed.alias('details.ownersWithCreatePermission'),
  ownersWithGroupPermission: Ember.computed.alias('details.ownersWithGroupPermission'),
  groupTypeNames: [
    'Report',
    'Event',
    'Document',
    'Threat',
    'Adversary',
    'Campaign',
    'Email',
    'Event',
    'Incident',
    'Intrusion Set',
    'Malware',
    'Signature',
    'Vulnerability'
  ],
  description: '',
  groupType: '',
  title: '',
  source: '',
  whoisActive: false,
  dnsActive: false,
  rating: 0,
  ratingHuman: 'Unknown',
  confidence: 0,
  confidenceHuman: 'Unassessed',
  foundEntities: [],
  groups: Ember.A(),
  groupTypeFilter: [],
  ownerFilter: [],
  selectedTags: [],
  selectedGroups: [],
  selectedAttributes: Ember.A(),
  isDeleting: false,
  resultToDelete: {},
  createMessage: '',
  createErrorMessage: '',
  createIsRunning: false,
  selectedTag: [],
  editingTags: false,
  previousTagSearch: '',
  entitiesToSubmitIncludeDomain: Ember.computed(
    'details.results.@each.__toBeSubmitted',
    function () {
      return this.get('details.results').some(
        (result) => result.displayType === 'Host' && result.__toBeSubmitted
      );
    }
  ),
  interactionDisabled: Ember.computed('isDeleting', 'createIsRunning', function () {
    const interactionDisabled =
      this.get('isDeleting') ||
      this.get('showOwnershipMessage') ||
      this.get('createIsRunning');

    return interactionDisabled;
  }),
  hasFoundInThreatConnectIndicatorsAvailableToSubmit: Ember.computed(
    'details.results.@each.__toBeSubmitted',
    'details.results.@each.__isOnExclusionList',
    'details.results.@each.foundInThreatConnect',
    function () {
      return this.get('details.results').some(
        (result) =>
          result.foundInThreatConnect &&
          !result.__toBeSubmitted &&
          !result.__isOnExclusionlist
      );
    }
  ),
  hasNotInThreatConnectIndicatorsAvailableToSubmit: Ember.computed(
    'details.results.@each.__toBeSubmitted',
    'details.results.@each.__isOnExclusionList',
    'details.results.@each.foundInThreatConnect',
    function () {
      return this.get('details.results').some(
        (result) =>
          !result.foundInThreatConnect &&
          !result.__toBeSubmitted &&
          !result.__isOnExclusionList
      );
    }
  ),
  /**
   * Returns true if all indicators that are not in ThreatConnect have been queued for submission
   * not including indicators that are exclusion listed
   */
  notInThreatConnectIsEmpty: Ember.computed(
    'details.results.@each.__toBeSubmitted',
    'details.results.@each.__isOnExclusionList',
    'details.results.@each.foundInThreatConnect',
    function () {
      return this.get('details.results').every(
        (result) =>
          (result.__toBeSubmitted && !result.foundInThreatConnect) ||
          result.foundInThreatConnect
      );
    }
  ),
  foundInThreatConnectIsEmpty: Ember.computed(
    'details.results.@each.__toBeSubmitted',
    'details.results.@each.__isOnExclusionList',
    'details.results.@each.foundInThreatConnect',
    function () {
      return this.get('details.results').every(
        (result) =>
          (result.__toBeSubmitted && result.foundInThreatConnect) ||
          !result.foundInThreatConnect
      );
    }
  ),
  numberOfIndicatorsToBeSubmitted: Ember.computed(
    'details.results.@each.__toBeSubmitted',
    function () {
      return this.get('details.results').reduce((count, result) => {
        return result.__toBeSubmitted ? count + 1 : count;
      }, 0);
    }
  ),
  indicatorTypesToSubmit: Ember.computed(
    'details.results.@each.__toBeSubmitted',
    function () {
      return Array.from(
        this.get('details.results').reduce((typeSet, result) => {
          if (result.__toBeSubmitted) {
            typeSet.add(result.displayType);
          }
          return typeSet;
        }, new Set())
      );
    }
  ),
  /**
   * Returns true if any indicators are marked to be submitted
   */
  hasIndicatorToBeSubmitted: Ember.computed(
    'details.results.@each.__toBeSubmitted',
    function () {
      return this.get('details.results').some((result) => result.__toBeSubmitted);
    }
  ),
  /**
   * Returns true if any indicators are not in ThreatConnect
   */
  hasIndicatorNotInThreatConnect: Ember.computed(
    'details.results.@each.foundInThreatConnect',
    function () {
      return this.get('details.results').some((result) => !result.foundInThreatConnect);
    }
  ),
  hasIndicatorsInThreatConnect: Ember.computed(
    'details.results.@each.foundInThreatConnect',
    function () {
      return this.get('details.results').some((result) => result.foundInThreatConnect);
    }
  ),
  /**
   * Returns true if any indicators are in ThreatConnect but not the owner's organization.
   */
  hasIndicatorNotInMyOwner: Ember.computed(
    'details.results.@each.foundInThreatConnect',
    'details.results.@each.isInMyOwner',
    function () {
      return this.get('details.results').some(
        (result) => !result.isInMyOwner && result.foundInThreatConnect
      );
    }
  ),
  /**
   * Returns true if there is at least one indicator that is in the owner's organization
   */
  hasIndicatorInMyOwner: Ember.computed(
    'details.results.@each.foundInThreatConnect',
    'details.results.@each.isInMyOwner',
    function () {
      return this.get('details.results').some(
        (result) => result.isInMyOwner && result.foundInThreatConnect
      );
    }
  ),
  init() {
    this.set('groups', Ember.A(this.get('details.groups')));
    this.set('selectedTags', [
      {
        name: 'Submitted By Polarity'
      }
    ]);

    if (this.get('state')) {
      this.set('state', {});
      this.set('state.errorMessage', '');
      this.set('state.errorTitle', '');
    }

    // Default owners to the requesting user owner
    const myOwner = this.get('ownersWithCreatePermission.0');
    this.set('owner', myOwner);
    this.set('ownerFilter', [myOwner]);

    this._super(...arguments);
  },
  searchGroups: function (term, resolve, reject) {
    const groupTypeFilter = this.get('groupTypeFilter');
    const ownerFilter = this.get('ownerFilter');
    this.set('searchingGroups', true);
    const payload = {
      data: {
        action: 'searchGroups',
        term,
        ownerIds: ownerFilter.map((owner) => owner.id),
        groupTypes: groupTypeFilter
      }
    };
    this.sendIntegrationMessage(payload)
      .then((result) => {
        this.set('groups', Ember.A(result.groups));
      })
      .catch((err) => {
        console.error('Group Search Error', err);
        this.flashMessage(`Failed to search groups`, 'danger');
      })
      .finally(() => {
        this.set('searchingGroups', false);
      });
    if (typeof resolve === 'function') {
      resolve();
    }
  },
  searchTags: function (term, resolve, reject) {
    this.set('createMessage', '');
    this.set('createErrorMessage', '');

    // Prevent running the same search twice in a row.  Can happen if the user opens and closes
    // the tag search power select (which will run empty string searches repeatedly).
    if (term === this.get('previousTagSearch') && this.get('existingTags.length') > 0) {
      return;
    }

    this.sendIntegrationMessage({
      data: {
        action: 'searchTags',
        term,
        ownerId: this.get('details.owner.id'),
        selectedTags: this.get('selectedTags')
      }
    })
      .then(({ tags }) => {
        this.set(
          'existingTags',
          [...(term ? [{ name: term, isNew: true }] : [])].concat(tags)
        );
        this.set('previousTagSearch', term);
      })
      .catch((err) => {
        this.set(
          'createErrorMessage',
          'Search Tags Failed: ' +
            (err &&
              (err.detail || err.err || err.message || err.title || err.description)) ||
            'Unknown Reason'
        );
      })
      .finally(() => {
        setTimeout(() => {
          if (!this.isDestroyed) {
            this.set('createMessage', '');
            this.set('createErrorMessage', '');
          }
        }, 5000);
        if (typeof resolve === 'function') {
          resolve();
        }
      });
  },
  /**
   * Flash a message on the screen for a specific issue
   * @param message
   * @param type 'info', 'danger', or 'success'
   */
  flashMessage(message, type = 'info', duration = 3000) {
    this.flashMessages.add({
      message: `${this.block.acronym}: ${message}`,
      type: `unv-${type}`,
      icon:
        type === 'success'
          ? 'check-circle'
          : type === 'danger'
          ? 'exclamation-circle'
          : 'info-circle',
      timeout: duration
    });
  },
  // Returns a validation error message if the attributeValue does not validate
  validateAttribute() {
    const attributeValue = this.get('attributeValue');
    const selectedAttribute = this.get('selectedAttribute');

    if (typeof attributeValue === 'undefined' || attributeValue.length === 0) {
      return 'You must provide a value';
    }

    if (
      selectedAttribute &&
      selectedAttribute.validationRule &&
      selectedAttribute.validationRule.type === 'Regex' &&
      selectedAttribute.validationRule.text
    ) {
      try {
        const validationRegexString = selectedAttribute.validationRule.text;
        const regex = new RegExp(validationRegexString);
        const isMatch = regex.test(attributeValue);
        if (!isMatch) {
          return `Provided value does not match regular expression ${validationRegexString}`;
        }
      } catch (err) {
        // Ignore regex creation errors
        console.error('Failed to validate attribute regex', err);
      }
    }
    return '';
  },
  actions: {
    initiateItemDeletion: function (result) {
      this.set('resultToDelete', result);
      this.set('showDeletionModal', true);
    },
    cancelItemDeletion: function () {
      this.set('showDeletionModal', false);
      this.set('resultToDelete', {});
    },
    initializeGroupFilter: function () {
      this.searchGroups('');
    },
    initializeAttributeFilter: function () {},
    confirmDelete: function () {
      this.set('isDeleting', true);
      const payload = {
        action: 'deleteItem',
        entity: this.get('resultToDelete.entity'),
        indicatorToDelete: this.get('resultToDelete.indicators').find(
          (indicator) => indicator.ownerId === this.get('details.myOwner.id')
        )
      };

      if (!payload.indicatorToDelete) {
        this.flashMessage(
          `Indicator does not exist in your default organization ${this.get(
            'details.myOwner.name'
          )} and cannot be deleted`,
          'danger'
        );
        return;
      }

      this.sendIntegrationMessage({
        data: payload
      })
        .then((deletionResult) => {
          // `deletionResult` contains the updated search result after the deletion
          // We find this value in our local results and replace the local result with the
          // new post-deletion result.
          console.info('Deletion result', deletionResult);
          this.get('details.results').forEach((result, index) => {
            if (result.entity.value == deletionResult.result.entity.value) {
              this.set(`details.results.${index}`, deletionResult.result);
            }
          });
          // We have to change the array reference here to trigger a template update
          this.set('details.results', [...this.get('details.results')]);
          this.flashMessage('Successfully deleted indicator', 'success');
        })
        .catch((err) => {
          console.error('Error deleting indicator', err);
          this.set('state.errorTitle', 'Failed to Delete Indicator');
          this.set('state.errorMessage', JSON.stringify(err, null, 2));
          this.flashMessage('Failed to delete indicator', 'danger');
        })
        .finally(() => {
          this.set('showDeletionModal', false);
          this.set('resultToDelete', {});
          this.set('isDeleting', false);
        });
    },
    removeAllToBeSubmitted: function () {
      this.get('details.results').forEach((result, index) => {
        this.set(`details.results.${index}.__toBeSubmitted`, false);
        this.set(`details.results.${index}.__deleteTooltipIsVisible`, false);
      });
    },
    addAllNotInThreatConnectBeSubmitted: function () {
      this.get('details.results').forEach((result, index) => {
        if (!result.foundInThreatConnect && !result.__isOnExclusionList) {
          this.set(`details.results.${index}.__toBeSubmitted`, true);
          this.set(`details.results.${index}.__deleteTooltipIsVisible`, false);
        }
      });
    },
    addAllCurrentlyInThreatConnectToBeSubmitted: function () {
      this.get('details.results').forEach((result, index) => {
        if (result.foundInThreatConnect && !result.__isOnExclusionList) {
          this.set(`details.results.${index}.__toBeSubmitted`, true);
          this.set(`details.results.${index}.__deleteTooltipIsVisible`, false);
        }
      });
    },
    submitItems: function () {
      if (!this.get('hasIndicatorToBeSubmitted')) {
        this.flashMessage('No indicators selected for submission', 'info');
        return;
      }

      this.set('createMessage', '');
      this.set('createErrorMessage', '');
      this.set('createIsRunning', true);

      const payload = {
        data: {
          action: 'submitItems',
          newIocsToSubmit: this.get('details.results').filter(
            (result) => result.__toBeSubmitted
          ),
          description: this.get('description'),
          title: this.get('title'),
          source: this.get('source'),
          whoisActive: this.get('whoisActive'),
          dnsActive: this.get('dnsActive'),
          rating: this.get('rating'),
          confidence: this.get('confidence'),
          owner: this.get('owner'),
          tags: this.get('selectedTags'),
          groups: this.get('selectedGroups'),
          attributes: this.get('selectedAttributes')
        }
      };

      this.sendIntegrationMessage(payload)
        .then(({ results, exclusionListEntities, errors }) => {
          results.forEach((result) => {
            // Find the corresponding result in our existing results array and replace that
            // result with our new result which is now in ThreatConnect
            const indexToReplace = this.get('details.results').findIndex(
              (existingResult) => existingResult.entity.value === result.entity.value
            );

            if (indexToReplace >= 0) {
              this.set(`details.results.${indexToReplace}`, result);
              this.set(`details.results.${indexToReplace}.__isNewlyAdded`, true);
            }
          });

          exclusionListEntities.forEach((entity) => {
            const indexToReplace = this.get('details.results').findIndex(
              (existingResult) => existingResult.entity.value === entity.value
            );

            if (indexToReplace >= 0) {
              this.set(`details.results.${indexToReplace}.__isOnExclusionList`, true);
              this.set(`details.results.${indexToReplace}.__toBeSubmitted`, false);
            }
          });

          errors.forEach((error) => {
            const indexToReplace = this.get('details.results').findIndex(
              (existingResult) => existingResult.entity.value === error.entity.value
            );

            if (indexToReplace >= 0) {
              this.set(
                `details.results.${indexToReplace}.__errorMessage`,
                JSON.stringify(error.error, null, 2)
              );
              this.set(`details.results.${indexToReplace}.__hasSubmissionError`, true);
              this.set(`details.results.${indexToReplace}.__toBeSubmitted`, false);
              this.set(
                `details.results.${indexToReplace}.__deleteTooltipIsVisible`,
                false
              );
            }
          });

          // We have to change the array reference here to trigger a template update
          this.set('details.results', [...this.get('details.results')]);

          let messageType = 'success';
          let message = '';
          if (results.length > 0) {
            message = `${results.length} IOC${
              results.length > 1 ? 's were' : ' was'
            } submitted`;
          }
          if (exclusionListEntities.length > 0) {
            message += `${message.length > 0 ? ' | ' : ''}${
              exclusionListEntities.length
            } IOC${
              exclusionListEntities.length > 1 ? 's were' : ' was'
            } on the exclusion list and could not be submitted`;
            messageType = 'warn';
          }
          if (errors.length > 0) {
            message += `${message.length > 0 ? ' | ' : ''}${errors.length} indicator${
              errors.length > 1 ? 's ' : ''
            } encountered submission errors`;
            messageType = 'danger';
          }

          this.flashMessage(
            message,
            messageType,
            errors.length > 0 || exclusionListEntities.length > 0 ? 10000 : 3000
          );
        })
        .catch((error) => {
          console.error('Error creating indicators');
          this.set('state.errorTitle', 'Indicator Creation Failed');
          this.set('state.errorMessage', JSON.stringify(error, null, 2));
          this.flashMessage('Failed to create indicators', 'danger');
        })
        .finally(() => {
          this.set('createIsRunning', false);
        });
    },
    deleteTag: function (tagToDelete) {
      this.set(
        'selectedTags',
        this.get('selectedTags').filter(
          (selectedTag) => selectedTag.name !== tagToDelete.name
        )
      );
    },
    searchGroups: function (term) {
      return new Ember.RSVP.Promise((resolve, reject) => {
        Ember.run.debounce(this, this.searchGroups, term, resolve, reject, 600);
      });
    },
    searchTags: function (term) {
      return new Ember.RSVP.Promise((resolve, reject) => {
        Ember.run.debounce(this, this.searchTags, term, resolve, reject, 600);
      });
    },
    removeGroup: function (targetGroup) {
      const selectedGroups = this.get('selectedGroups');
      const index = selectedGroups.findIndex((group) => group.id === targetGroup.id);
      if (index >= 0) {
        // Remove the group from selected groups
        this.set('selectedGroups', [
          ...selectedGroups.slice(0, index),
          ...selectedGroups.slice(index + 1)
        ]);

        //Add the group back to all groups
        this.get('groups').pushObject(targetGroup);
      }
    },
    addGroup: function () {
      const selectedGroup = this.get('selectedGroup');
      const selectedGroups = this.get('selectedGroups');

      if (selectedGroup) {
        // Remove the group from the list of selectable groups
        const groupToRemoveIndex = this.get('groups').findIndex(
          (group) => group.id === selectedGroup.id
        );
        if (groupToRemoveIndex >= 0) {
          this.get('groups').removeAt(groupToRemoveIndex);
        }
        this.set('selectedGroups', selectedGroups.concat(selectedGroup));
        this.set('selectedGroup', '');
      }
    },
    addTags: function () {
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
    },
    resetSubmissionOptions: function () {
      this.set('description', '');
      this.set('source', '');
      this.set('title', '');
      this.set('rating', 0);
      this.set('confidence', 0);
      this.set('selectedGroups', []);
      this.set('selectedAttributes', Ember.A());
      this.set('selectedTags', [
        {
          name: 'Submitted By Polarity'
        }
      ]);
      const myOwner = this.get('ownersWithCreatePermission.0');
      this.set('owner', myOwner);
    },
    getAttributesForSelectedType: function () {
      this.set('loadingAttributes', true);
      const payload = {
        data: {
          action: 'getAttributesForType',
          attributeType: this.get('selectedIndicatorType')
        }
      };
      this.sendIntegrationMessage(payload)
        .then((result) => {
          this.set('attributes', result.attributes);
        })
        .finally(() => {
          this.set('loadingAttributes', false);
        });
    },
    addAttribute: function () {
      const attributeValue = this.get('attributeValue');
      const attributeName = this.get('selectedAttribute.name');
      const attributeId = this.get('selectedAttribute.id');
      const indicatorType = this.get('selectedIndicatorType');
      const attributeIsPinned = this.get('attributeIsPinned');

      let validationError = this.validateAttribute();
      if (validationError) {
        this.set('attributeValidationError', validationError);
        return;
      } else {
        this.set('attributeValidationError', '');
      }

      this.set('attributeValue', '');
      this.set('editingAttributes', false);

      this.get('selectedAttributes').pushObject({
        id: attributeId,
        type: attributeName,
        value: attributeValue,
        indicatorType: indicatorType,
        pinned: attributeIsPinned
      });
    },
    removeAttribute: function (targetAttribute) {
      const selectedAttributes = this.get('selectedAttributes');
      const index = selectedAttributes.findIndex(
        (attribute) => attribute.id === targetAttribute.id
      );
      if (index >= 0) {
        // Remove the group from selected groups
        this.set('selectedAttributes', [
          ...selectedAttributes.slice(0, index),
          ...selectedAttributes.slice(index + 1)
        ]);
      }
    }
  }
});
