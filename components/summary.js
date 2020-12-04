polarity.export = PolarityComponent.extend({
  summary: Ember.computed.alias('block.data.summary'),
  details: Ember.computed.alias('block.data.details'),
  maxUniqueKeyNumber: Ember.computed.alias('details.maxUniqueKeyNumber'),
  _summary:[],
  init() {
    this.set('_summary', this.get(`details.summary${this.get('maxUniqueKeyNumber')}`));
    this._super(...arguments);
  },
  observer: Ember.on(
    'willUpdate',
    Ember.observer('details.maxUniqueKeyNumber', function () {
      if (this.get('maxUniqueKeyNumber') !== this.get('_maxUniqueKeyNumber')) {
        this.set('_maxUniqueKeyNumber', this.get('maxUniqueKeyNumber'));
        this.set(
          '_summary',
          this.get(`details.summary${this.get('maxUniqueKeyNumber')}`)
        );
      }
    })
  )
});
