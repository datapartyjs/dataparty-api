
const reach = require('../utils/reach')
const debug = require('debug')('bouncer.idb')
const EventEmitter = require('eventemitter3')

class IDb extends EventEmitter {

  /**
   * @interface module:Db.IDb
   * @link module:Db
   * 
   * @param {module:Party.ocumentFactory} factory 
   * @param {string} prefix Prefix collection names
   */
  constructor(factory, prefix='api_'){
    super()
    this.factory = factory
    this.prefix = prefix
  }

  async start(){ 
    debug('starting')

    debug(this.factory.getValidators())

    for(const collectionName of this.factory.getValidators()){
      debug('creating collection', collectionName)

      const indexSettings = reach(this.factory, 'schemas.IndexSettings.'+collectionName)
      await this.createCollection(collectionName, indexSettings)
    }
  }

  async hasCollection(name){
    const existing = (await this.getCollectionNames()).indexOf(name) != -1

    return existing
  }

  async stop(){ throw new Error('not implemented') }

  /** convert db documnet to plain object with $meta field */
  documentToObject(doc){ throw new Error('not implemented') }

  /** convert object with $meta field to db representation*/
  documentFromObject(obj){ throw new Error('not implemented') }

  ensureId(obj){ throw new Error('not implemented') }

  stripMeta(doc){
    const {_id, meta, $meta, ...rawMsg} = doc
    return rawMsg
  }

  onlyMeta(objOrDoc){
    const {meta, $meta, ...rawMsg} = objOrDoc
    return {$meta: $meta || meta }
  }


  emitChange(msg, change){
    const { type, id, revision } = msg.$meta
    debug('emitChange', `${type}:${id}`)
    this.emit(
      `${type}:${id}`,
      {
        event: change,
        msg: { type, id, revision }
      }
    )
  }

  /**
   * Create collection with prefixed name
   * @param {*} name 
   * @param {*} indexSettings 
   */
  async createCollection(name, indexSettings){ throw new Error('not implemented') }

  /**
   * Get native collection instance by prefixed name
   * 
   * @param {*} name Collection name without prefix 
   */
  async getCollection(name){ throw new Error('not implemented') }

  /**
   * Return non-prefixed collection names
   */
  async getCollectionNames(){ throw new Error('not implemented') }

  async find(collectionName, query){ throw new Error('not implemented') }

  async insert(collectionName, doc){ throw new Error('not implemented') }

  async insertMany(collectionName, doc){ throw new Error('not implemented') }

  async update(collectionName, query, doc){ throw new Error('not implemented') }

  async findAndRemove(collectionName, msg){ throw new Error('not implemented') }

}

module.exports = IDb