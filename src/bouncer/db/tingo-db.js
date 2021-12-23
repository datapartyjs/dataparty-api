'use strict'


const IDb = require('../idb')
const Hoek = require('@hapi/hoek')
const Tingo = require('tingodb')()
const {promisfy} = require('promisfy')

const debug = require('debug')('bouncer.db.tingo-db')


module.exports = class TingoDb extends IDb {

  constructor ({path, factory, tingoOptions, prefix}) {
    super(factory, prefix)
    debug('constructor path=',path)
    this.tingo = null
    this.path = path
    this.tingoOptions = tingoOptions || {}
    this.error = null
  }


  async start(){

    debug('starting')
    await new Promise((resolve,reject)=>{
      try{

        this.tingo = new Tingo.Db(this.path, this.tingoOptions)
        resolve()
      }
      catch(err){ this.error = err; reject(err) }
    })

    await super.start()
  }

  stripMeta(doc){
    const {meta, $meta, ...rawMsg} = doc
    return rawMsg
  }

  /** convert db documnet to plain object with $meta field */
  documentToObject(doc){
    let obj = Object.assign({},doc)
    obj.$meta = {
      id: Hoek.reach(obj,'meta.id', {default: obj._id}),
      type: Hoek.reach(obj,'meta.type'),
      created: Hoek.reach(obj,'meta.created'),
      revision: Hoek.reach(obj,'meta.revision'),
      removed: Hoek.reach(obj,'meta.removed')
    }
    delete obj.meta

    return obj
  }


  /** convert object with $meta field to db representation*/
  documentFromObject(obj){ 
    let doc = Object.assign({},obj)
    doc._id = Hoek.reach(obj,'$meta.id', {default: obj._id}),
    doc.meta = {
      id: Hoek.reach(obj,'$meta.id', {default: obj._id}),
      type: Hoek.reach(obj,'$meta.type'),
      created: Hoek.reach(obj,'$meta.created'),
      revision: Hoek.reach(obj,'$meta.revision'),
      removed: Hoek.reach(obj,'$meta.removed')
    }
    
    delete doc.$meta

    return doc
  }

  async getCollectionNames(name){
    let names = await promisfy(this.tingo.collectionNames.bind(this.tingo))({})

    return names.map(name=>{
      return name.replace(this.prefix, '')
    })
  }

  async createCollection(name, indexSettings){
    debug('createCollection', name, indexSettings)

    if(this.hasCollection(name) !== null){ return }

    let collection = await promisfy(this.tingo.createCollection.bind(this.tingo))(this.prefix+name)
  }


  async getCollection(name){ 
    let collection = await promisfy(this.tingo.collection.bind(this.tingo))(this.prefix+name)

    return collection
  }

  async find(collectionName, query){
    debug('find collection=', collectionName, ' query=', JSON.stringify(query,null,2))
    let collection = await this.getCollection(collectionName)
    let cursor = await promisfy(collection.find.bind(collection))(query)
    let resultArray = await promisfy(cursor.toArray.bind(cursor))()

    return resultArray.map(this.documentToObject) || []
  }

  async insert(collectionName, doc){ 
    debug('insert collection=', collectionName, ' doc=', JSON.stringify(doc,null,2))
    let collection = await this.getCollection(collectionName)

    let dbDoc = {...doc}
    
    if(dbDoc._id===undefined){ dbDoc._id = new this.tingo.ObjectID().valueOf()  }

    dbDoc.meta = {
      id: obj._id,
      type: collectionName,
      created: Hoek.reach(doc,'$meta.created', {default: Date.now()}),
      revision: Hoek.reach(doc,'$meta.revision', {default: 1})
    }

    this.factory.validate(collectionName, this.stripMeta(dbDoc))

    const docs = await promisfy(collection.insert.bind(collection))( dbDoc )

    const finalDbDoc = docs[0]
    const finalObj = this.documentToObject(finalDbDoc)

    return finalObj
  }

  async insertMany(collectionName, docs){ 
    debug('insert collection=', collectionName, ' doc=', JSON.stringify(doc,null,2))
    let collection = await this.getCollection(collectionName)

    let resultSet = []

    for(let doc of docs){
      let dbDoc = {...doc}
    
      if(dbDoc._id===undefined){ dbDoc._id = new this.tingo.ObjectID().valueOf()  }

      dbDoc.meta = {
        id: obj._id,
        type: collectionName,
        created: Hoek.reach(doc,'$meta.created', {default: Date.now()}),
        revision: Hoek.reach(doc,'$meta.revision', {default: 1})
      }

      this.factory.validate(collectionName, this.stripMeta(dbDoc))

      const docs = await promisfy(collection.insert.bind(collection))( dbDoc )

      const finalDbDoc = docs[0]
      const finalObj = this.documentToObject(finalDbDoc)

      resultSet.push(finalObj)
    }

    return resultSet

  }

  async findAndRemove(collectionName, rmMsg){ 
    debug('findAndRemove collection', collectionName, ' rmMsg', rmMsg)

    let collection = await this.getCollection(collectionName)

    const dbRmMsg = this.documentFromObject(rmMsg)
    await promisfy(collection.findAndRemove.bind(collection))( dbRmMsg )
  }
}
