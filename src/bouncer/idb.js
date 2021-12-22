
const EventEmitter = require('last-eventemitter')

module.exports = class IDb extends EventEmitter {

  constructor(options){
    this.options = options
  }

  /** convert db documnet to plain object with $meta field */
  documentToObject(doc){ throw new Error('not implemented') }

  /** convert object with $meta field to db representation*/
  documentFromObject(obj){ throw new Error('not implemented') }
  
  async getCollectionNames(){ throw new Error('not implemented') }

  async createCollection(name, options){ throw new Error('not implemented') }

  async getCollection(name){ throw new Error('not implemented') }

  async find(collection, query){ throw new Error('not implemented') }

  async insert(collection, doc){ throw new Error('not implemented') }

  async insertMany(collection, doc){ throw new Error('not implemented') }

  async findAndRemove(collection, msg){ throw new Error('not implemented') }



}