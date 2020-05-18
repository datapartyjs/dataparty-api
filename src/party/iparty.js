const debug = require('debug')('dataparty.iparty')

const IDocument = require('./idocument')
const DocumentFactory = require('./document-factory')
const LokiCache = require('./loki-cache.js') // insert | populate cache

/**
 * @class 
 * @alias module:dataparty.IParty
 * @interface
 */
class IParty {
  constructor({config, cache, model, factories, documentClass}){
    this.config = config
    this.cache = cache || new LokiCache()
    
    /**
     * @member factory 
     * @type {DocumentFactory} */
    this.factory = new DocumentFactory({party: this, model, factories, documentClass})
  }

  /** @method */
  async start(){
    debug('start')
    if(this.config){
      await this.config.start()
    }

    if(this.cache){
      await this.cache.start()
    }

    debug('\tDocument Validators', this.factory.getValidators())
    debug('\tDocument Classes', this.factory.getTypes())
  }

  /**
   * @method
   */
  createDocument(type, ...options){
    let Type = this.types[type]

    return Type.create(this, {...options, type})
  }

  create (type, ...msgs) {
    throw new Error('Not Implemented')
  }

  remove (...msgs) {
    throw new Error('Not Implemented')
  }


  update (...msgs) {
    throw new Error('Not Implemented')
  }
  
  find () {
    throw new Error('Not Implemented')
  }

  get comms(){
    return undefined
  }

  /**
   * @method
   */
  async call(msg){
    throw new Error('Not Implemented')
  }

  /**
   * @method
   */
  async socket(reuse){
    throw new Error('Not Implemented')
  }

  

  /** @type {ROSLIB} */
  get ROSLIB(){
    return ROSLIB
  }


  /** @type {IDocument} */
  get Document(){
    return this.factory.Document
  }

  /**
   * @method
   */
  get types(){
    return this.factory.getFactories()
  }
}

module.exports = IParty