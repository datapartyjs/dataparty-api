'use strict'

const reach = require('../reach')
const debug = require('debug')('dataparty.idocument')
const EventEmitter = require('last-eventemitter')

/**
 * Represents a cached document with cloud change notifications
 * @class
 * @interface
 * @alias module:dataparty.DataParty.Document
 * @param {object}    options
 * @param {DataParty} options.party
 * @param {string}    options.id
 * @param {string}    options.type
 * @param {object}    options.data
 */
class IDocument extends EventEmitter {
  constructor({party, type, id, data, followcache}){
    super()
    this.party = party
    
    this.watchSub = undefined
    this.watchedFields = {}
    this.watchedFilters = {}

    this.autopull = true     //! If we detect a cloud change should we copy into the local cache?
    this.flushcache = true   //! If we detect a cloud change should we flush the local cache?
    this.followcache = followcache !== undefined ? followcache: true  //! Watch document for local changes
    

    debug('document', type, id, data)

    this._data = {
      ...data,
      $meta: {id: id, type: type},
    }

    if(this.party.cache){
      this.party.cache.on(this.idString, this._handleCacheEvent.bind(this))
    }
  }


  /**
   * Document mongo-id
   * @type {string}
   */
  get id(){ return reach(this._data, '$meta.id') }

  /**
   * Document type string
   * @type {string}
   */
  get type(){ return reach(this._data, '$meta.type') }

  /**
   * Document version string
   * @type {string}
   */
  get version(){ return reach(this._data, '$meta.version') }


  /**
   * @typedef {Object} IdObj
   * @property {string} id    <mongo-id>
   * @property {string} type  Document type
   */

  /**
   * Document id string in format `<type>:<mongo-id>`
   * @type {IdObj}  
   */
  get idObj(){
    return {
      id: this.id,
      type: this.type
    }
  }

  /**
   * Document id string in format `<type>:<mongo-id>`
   * @type {sting}
   */
  get idString() { return this.type + ':' + this.id }

  /**
   * @method
   */
  getData(){ return this._data }

  /**
   * entire document
   * @type {object}
   */
  get data(){ return this._data }

  /**
   * document data with no library added fields
   * @type {object}
   */
  get cleanData(){
    const {$meta, ...obj} = this._data
    return obj
  }

  /**
   * Merge fields into document
   * @method
   * @param {object}  input
   * @returns {object}
   */
  async mergeData(input){
    return this.setData(Object.assign({}, this.data, input))
  }

  /**
   * Set entire document
   * @method
   * @param {object}  input
   * @returns {object}
   */
  async setData(input){
    let valid = await this.party.factory.validate(this.type, input)
    this._data = valid
  }

  /**
   * Saves document changes to remote party
   * @method
   */
  async save(){
    const value = Object.assign({}, this.data)

    delete value.$meta.version
    delete value.__v

    await this.setData(value)
    await this.party.update(value)
    await this.pull()
  }


  static async create(party, data){

    debug('creating document ', data.type, data.id)

    const rawDocument = await party.create(data.type, data)
    return party.find()
      .type(rawDocument.type)
      .id(rawDocument.id)
      .exec()
  }

  async remove(){
    debug('removing document ', this.data.type, this.data.id)

    return this.party.remove(this.data)
  }

  /**
   * Download document changes from party
   * @method
   * @param {boolean} flushcache  Update local cache as well
   */
  async pull (flushcache) {

    // debug('this is :', this)

    debug('pulling', this.idString)

    if (!this.type){
      throw new Error('type undefined')
    }

    debug('pull', this.data)
    const typeCache = '' + this.type
    if (flushcache && this.party.cache){
      this.party.cache.remove(this.type, this.id)
    }

    debug('pull type -', this.type)

    return this.party.find()
      .type(typeCache)
      .id(this.id)
      .exec()
      .then(docs => {
        this._data = docs[0].data

        debug('pull found', docs)

        return this
      })
  }


  /**
   * Watches document for remote changes. 
   * @method
   * @param {boolean} autopull 
   * @param {boolean} flushcache 
   * @param {function=}  cb    Optional Change event callback function
   * @fires module:dataparty.DataParty.Document#change
   */
  async watch(autopull, flushcache, cb){

    if(cb){ this.on('change', cb) }

    if([true,false].indexOf(autopull) < 0 && [true,false].indexOf(this.autopull) < 0){ this.autopull = true }
    if([true,false].indexOf(flushcache) < 0 && [true,false].indexOf(this.flushcache) < 0){ this.flushcache = true }
    if([true,false].indexOf(autopull) > -1){ this.autopull = autopull }
    if([true,false].indexOf(flushcache) > -1){ this.flushcache = flushcache }

    if (this.watchSub){ return }

    const socket = await this.party.socket()
    const ros = socket.ros
    const watchPath = '/dataparty/document/' + this.type + '/' + this.id

    debug('watch document', watchPath)

    this.watchSub = new this.party.ROSLIB.Topic({
      ros: ros,
      name: watchPath,
      messageType: 'dataparty/DocumentChange'
    })

    this.watchSub.subscribe(this._handleWatchMsg.bind(this))
  }


  

  /**
   * Stop watching for remote document changes
   * @param {function=}  cb    Optional Change event callback function
   */
  async unwatch(cb){
    if(cb){ this.off('change', cb) }

    this.autopull = undefined
    this.flushcache = undefined

    if(!this.watchSub){ return }

    this.watchSub.unsubscribe(this._handleWatchMsg.bind(this))
    this.watchSub = undefined
  }

  /**
   * Watch a field for changes. If `value` is supplied watches
   * for field and `value` to match.
   * 
   * @param {string}  field   Field path to watch for changes
   * @param {*=}      value   Match value
   * @param {function}  cb    Callback function
   * @fires module:dataparty.DataParty.Document#field
   */
  async watchField(field, value, cb){
    this.watchedFields[field] = (value == undefined) ? true : {'$eq': value}

    if(cb){ this.on('field.'+field, cb) }
    if(!this.watchSub){ return this.watch() }
  }

  async unwatchField(field, cb){
    this.watchedFields[field] = undefined
    delete this.watchedFields[field]

    if(cb){ this.off('field.'+field, cb) }
  }

  _handleWatchMsg(message){
    if(!this.watchSub){return}
    debug(`document changed ${this.watchSub.name} `, message)

    if (this.autopull){ this.pull.bind(this)(this.flushcache) }

    /**
     * Document change Event - This is event is triggered when a document has been
     * modified on the `CloudParty` service
     * @event module:dataparty.DataParty.Document#change
     * @type {object}
     */
    this.emit('change', message)
  }

  _handleCacheEvent(event){

    debug('cache event', this.idString, event)
    const newMsg = this.party.cache.findById(this.type, this.id)
    const oldMsg = Object.assign({}, this.getData())

    debug('new message', newMsg)

    switch (event.event){
      case 'remove':
      case 'update':
      case 'create':

        if(this.followcache){ 
          this._data = newMsg 

          /**
           * Document value Event - This event is triggered after a change has been 
           * applied to the backing cache of `Document.data`. Only fired when `Document.followcache` 
           * is true.
           * @event module:dataparty.DataParty.Document#value
           * @type {Document}
           */
          this.emit('value', this)
        }

        /**
         * Document modified Event - This event is triggered after a change has been 
         * applied to the backing cache of `Document.data`. If `Document.followcache` 
         * is true the document `doc` has also accepted the change.
         * 
         * @event module:dataparty.DataParty.Document#remove
         * @event module:dataparty.DataParty.Document#update
         * @event module:dataparty.DataParty.Document#create
         * @type {object}
         * @property  {module:dataparty.DataParty.Document}  doc the changed document
         * @property  {object}  new the new document data
         * @property  {object}  old the old document data
         */
        this.emit(event.event, {new: newMsg, old: oldMsg, doc: this})

        if(this.watchedFields && Object.keys(this.watchedFields).length > 0){

          // Emit field level changes

          for(const field in this.watchedFields){
            const expected = this.watchedFields[field]
      
            const oldVal = JSON.stringify(reach(oldMsg, field))
            const newVal = JSON.stringify(reach(newMsg, field))
      
            if(oldVal !== newVal){

              // TODO: Should we do both raising and falling edge detection? Should it be configurable?
              if( (typeof expected == 'object' && newVal != JSON.stringify(expected.$eq))) /* &&
                  (typeof expected == 'object' && oldVal != JSON.stringify(expected.$eq))) */
              { continue }


              /**
               * Field change event. This is emitted as `field.[FIELD_PATH]`
               * @event module:dataparty.DataParty.Document#field
               * @type  {object}
               * @property  doc   The changed document
               * @property  field The changed FIELDPATH 
               * @property  old   The old field value
               * @property  new   The new field value
               * @property  expected  The expected field value
               */
              this.emit('field.'+field, {
                expected,
                doc: doc,
                field: field,
                old: reach(oldMsg, field),
                new: reach(newMsg, field)
              })
            }
          }
        }
        break
      default:
        debug('unexpected event', event, this)
        break
    }
  }
}

module.exports = IDocument