'use strict'

const reach = require('../utils/reach')
const debug = require('debug')('dataparty.idocument')
const EventEmitter = require('eventemitter3')
const objectHasher = require('node-object-hash').hasher()

class IDocument extends EventEmitter {

/**
 * Represents a document with caching and local+remote change notifications
 * @class module:Party.IDocument
 * @extends EventEmitter
 * @link module.Party
 * @param {object}    options
 * @param {DataParty} options.party
 * @param {string}    options.id
 * @param {string}    options.type
 * @param {object}    options.data
 * @param {boolean}   options.followcache
 */
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
      $meta: {id, type, ...data.$meta}
    }

    if(this.party.cache){
      this.party.cache.on(this.idString, this._handleCacheEvent.bind(this))
    }
  }


  /**
   * Document mongo-id
   * @member module:Party.IDocument.id
   * @type {string}
   */
  get id(){ return reach(this._data, '$meta.id') }

  /**
   * Document type string
   * @member module:Party.IDocument.type
   * @type {string}
   */
  get type(){ return reach(this._data, '$meta.type') }

  /**
   * Document revision string
   * @member module:Party.IDocument.revision
   * @type {string}
   */
  get revision(){ return reach(this._data, '$meta.revision') }

  static get DocumentSchema(){
    return 'document'
  }

  /**
   * @typedef {Object} IdObj
   * @property {string} id    mongo-id or UUID
   * @property {string} type  Document type
   */

  /**
   * Document id object
   * @member module:Party.IDocument.idObj
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
   * @member module:Party.IDocument.idString
   * @type {sting}
   */
  get idString() { return this.type + ':' + this.id }

  /**
   * @method module:Party.IDocument.getData
   */
  getData(){ return this._data }

  /**
   * entire document
   * @member module:Party.IDocument.data
   * @type {object}
   */
  get data(){ return this._data }

  /**
   * document data with no library added fields
   * @member module:Party.IDocument.cleanData
   * @type {object}
   */
  get cleanData(){
    const {$meta, ...obj} = this._data
    return obj
  }

  /**
   * hash of `document.data` using sha256
   * @member module:Party.IDocument.hash
   * @type {object}
   */
  get hash(){
    return objectHasher.hash(this.data)
  }

  /**
   * @async
   * Merge fields into document
   * @method module:Party.IDocument.mergeData
   * @param {object}  input
   * @returns {object}
   */
  async mergeData(input){
    return await this.setData(Object.assign({}, this.data, input))
  }

  /**
   * @async
   * Set entire document
   * @method module:Party.IDocument.setData
   * @param {object}  input
   * @returns {object}
   */
  async setData(input){
    debug('setData start')
    let valid = await this.party.factory.validate(this.type, input)
    debug('setData done')
    this._data = valid
  }

  /**
   * @async
   * Saves document changes to remote party
   * @method module:Party.IDocument.save
   */
  async save(){
    const value = Object.assign({}, this.data)

    debug('asign data')
    await this.setData(value)
    debug('data set')
    const expectedRevision = reach(this.data, '$meta.revision', -1) + 1
    const rawDocument = (await this.party.update(value))[0]
    debug('doc updated')
    if(expectedRevision != reach(rawDocument, '$meta.revision')){
      debug('pull')
      await this.pull()
    }
  }


  /**
   * @async
   * @method module:Party.IDocument.create
   * 
   * @param {moddule:Party.IParty} party 
   * @param {*} document
   * @returns 
   */
  static async create(party, {type, id, data}){

    debug('creating document ', type, id)

    const rawDocuments = (await party.create(type, data))
    
    debug('hydrating', rawDocuments)
    return (await party.factory.hydrate(rawDocuments))[0]

    /*const docs = (await party.find()
      .type(rawDocument.$meta.type)
      .id(rawDocument.$meta.id)
      .exec())

    return docs[0]*/
  }

  /**
   * @async
   * @method module:Party.IDocument.remove
   * 
   */
  async remove(){
    debug('removing document ', this.type, this.id)

    //this.emit('remove', this)

    return this.party.remove(this.data)
  }

  /**
   * @async
   * Download document changes from party
   * @method module:Party.IDocument.pull
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
   * @async
   * Watches document for remote changes.
   * @method module:Party.IDocument.watch
   * @param {boolean} autopull 
   * @param {boolean} flushcache 
   * @param {function=}  cb    Optional Change event callback function
   * @fires module:Party.IDocument#change
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
   * @method module:Party.IDocument.unwatch
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
   * @method module:Party.IDocument.watchField
   * 
   * @param {string}  field   Field path to watch for changes
   * @param {*=}      value   Match value
   * @param {function}  cb    Callback function
   * @fires module:Party.IDocument#field
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
     * modified on the remote service
     * @event module:Party.IDocument#change
     * @type {object}
     */
    this.emit('change', message)
  }

  _handleCacheEvent(event){

    debug('cache event', this.idString, event)
    const newMsg = this.party.cache.findById(this.type, this.id)
    const oldMsg = Object.assign({}, this.getData())

    debug('new message', event.event, newMsg)

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
           * @event module:Party.IDocument#value
           * @type {Document}
           */
          this.emit('value', this)
        }

        /**
         * @typedef {module:Party.IDocumentEvent}
         * @property  {module:Party.IDocument}  doc the changed document
         * @property  {object}  new the new document data
         * @property  {object}  old the old document data
         */

        /**
         * Document create Event - This event is triggered after a document has been created and
         * applied to the backing cache of `Document.data`. If `Document.followcache` 
         * is true the document `doc` has also accepted the change.
         * 
         * @event module:Party.IDocument#create
         * @type {module:Party.IDocument.Event}
         */

        /**
         * Document update Event - This event is triggered after a change has been 
         * applied to the backing cache of `Document.data`. If `Document.followcache` 
         * is true the document `doc` has also accepted the change.
         * 
         * @event module:Party.IDocument#update
         * @type {module:Party.IDocument.Event}
         */
    
        /**
         * Document remove Event - This event is triggered after a document has been removed and
         * applied to the backing cache of `Document.data`. If `Document.followcache` 
         * is true the document `doc` has also accepted the change.
         * 
         * @event module:Party.IDocument#remove
         * @type {module:Party.IDocument.Event}
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
               * @event module:Party.IDocument#field
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
