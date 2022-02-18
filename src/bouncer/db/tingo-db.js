'use strict'


const IDb = require('../idb')
const Hoek = require('@hapi/hoek')

const {promisfy} = require('promisfy')


const debug = require('debug')('bouncer.db.tingo-db')


module.exports = class TingoDb extends IDb {

  constructor ({path, factory, tingoOptions, prefix}) {
    super(factory, prefix)
    debug('constructor path=',path, tingoOptions)
    this.tingo = null
    this.path = path
    this.tingoOptions = tingoOptions || {nativeObjectID: true}
    this.error = null
  }


  async start(){

    debug('starting', this.tingoOptions)
    await new Promise((resolve,reject)=>{
      try{

        const Tingo = require('tingodb')(this.tingoOptions)
        this.tingo = new Tingo.Db(this.path, this.tingoOptions)
        resolve()
      }
      catch(err){ this.error = err; reject(err) }
    })

    await super.start()
  }



  /** convert db documnet to plain object with $meta field */
  documentToObject(doc){
    let obj = Object.assign({},doc)
    obj.$meta = {
      id: Hoek.reach(obj,'meta.id', {default: obj._id}),
      type: Hoek.reach(obj,'meta.type'),
      created: Hoek.reach(obj,'meta.created', {default: (new Date()).toISOString()}),
      revision: Hoek.reach(obj,'meta.revision', {default: 1}),
      removed: Hoek.reach(obj,'meta.removed')
    }
    delete obj.meta
    delete obj._id

    return obj
  }


  /** convert object with $meta field to db representation*/
  documentFromObject(obj){ 
    let doc = Object.assign({},obj)
    doc._id = Hoek.reach(obj,'$meta.id', {default: obj._id}),
    doc.meta = {
      id: Hoek.reach(obj,'$meta.id', {default: obj._id}),
      type: Hoek.reach(obj,'$meta.type'),
      created: Hoek.reach(obj,'$meta.created', {default: (new Date()).toISOString()}),
      revision: Hoek.reach(obj,'$meta.revision', {default: 1}),
      removed: Hoek.reach(obj,'$meta.removed')
    }
    
    delete doc.$meta

    return doc
  }

  ensureId(obj){
    let temp = {...obj}
    if(!reach(temp,'$meta.id')){
      temp.$meta.id = new this.tingo.ObjectID().valueOf()
    }

    let dbDoc = this.documentFromObject(temp)
    
    return dbDoc
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

  async insert(collectionName, obj){ 
    debug('insert collection=', collectionName, ' doc=', JSON.stringify(obj,null,2))
    let collection = await this.getCollection(collectionName)

    let dbDoc = this.ensureId(obj)
    
    /*if(dbDoc._id===undefined){ dbDoc._id = new this.tingo.ObjectID().valueOf()  }

    dbDoc.meta = {
      id: obj._id,
      type: collectionName,
      created: Hoek.reach(doc,'$meta.created', {default: Date.now()}),
      revision: Hoek.reach(doc,'$meta.revision', {default: 1})
    }*/

    const validatedDbDoc = await this.factory.validate(collectionName, this.stripMeta(dbDoc))

    const docs = await promisfy(collection.insert.bind(collection))( dbDoc )

    const finalDbDoc = docs[0]
    const finalObj = this.documentToObject(finalDbDoc)

    this.emitChange(finalObj, 'create')

    return finalObj
  }

  async insertMany(collectionName, docs){ 
    debug('insert collection=', collectionName, ' docs=', JSON.stringify(docs,null,2))
    let collection = await this.getCollection(collectionName)

    let resultSet = []

    for(let obj of docs){
      let temp = {...obj}
      if(temp._id===undefined){ temp._id = (new this.tingo.ObjectID()).toString(); temp.$meta.id=temp._id;  }

      let dbDoc = this.documentFromObject(temp)


      /*dbDoc.meta = {
        id: dbDoc._id,
        type: collectionName,
        created: Hoek.reach(doc,'$meta.created', {default: Date.now()}),
        revision: Hoek.reach(doc,'$meta.revision', {default: 1})
      }*/

      const stripped = this.stripMeta(temp)

      debug('validating', stripped,'from', temp)

      await this.factory.validate(collectionName, stripped)

      debug('its good, inserting', dbDoc)

      const result = await promisfy(collection.insert.bind(collection))( dbDoc )

      const finalDbDoc = result[0]
      const finalObj = this.documentToObject(finalDbDoc)

      this.emitChange(finalObj, 'create')

      resultSet.push(finalObj)
    }

    return resultSet

  }

  async update(collectionName, docs){ 
    debug('update collection', collectionName, ' docs', docs)

    let collection = await this.getCollection(collectionName)

    let objs = []

    for(let obj of docs){
      let dbDoc = this.documentFromObject(obj)

      dbDoc.meta.revision++

      debug('updating',obj, 'to', dbDoc)

      const stripped = this.stripMeta(dbDoc)

      debug('validating', stripped,'from', dbDoc)

      await this.factory.validate(collectionName, stripped)

      debug('its good, updating', dbDoc)

      const result = await promisfy(collection.update.bind(collection))( {_id: dbDoc._id}, dbDoc )

      const finalObj = this.documentToObject(dbDoc)

      this.emitChange(finalObj, 'update')

      objs.push( finalObj )

    }

    /*const dbDocs = docs.map(this.documentFromObject)
    const docs = await promisfy(collection.update.bind(collection))( dbRmMsg )

    let objs = docs.map(doc=>{
      let obj = this.documentToObject(doc)

      this.emitChange(obj, 'update')

      return obj
    })*/

    return objs
  }

  async findAndRemove(collectionName, obj){ 
    debug('findAndRemove collection', collectionName, ' obj', obj)

    let collection = await this.getCollection(collectionName)

    const dbDoc = await promisfy(collection.findAndRemove.bind(collection))( { _id: obj.$meta.id } )

    debug('dbDoc', dbDoc)

    let finalObj = this.documentToObject(dbDoc)

    finalObj.$meta.removed = true

    this.emitChange(finalObj, 'remove')

    debug('obj', finalObj)

    return finalObj
  }
}
