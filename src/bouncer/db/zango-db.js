'use strict'

const IDb = require('../idb')
const Hoek = require('@hapi/hoek')
const zango = require('zangodb')
const reach = require('../../utils/reach')
const ObjectId = require('bson-objectid')

const MongoQuery = require('../mongo-query')
const { promisfy } = require('promisfy')
const debug = require('debug')('bouncer.db.zango-db')

/**
 * Ideal for frontend apps with large datasets (larger then total RAM). This is an IndexedDb based driver so it span to nearly 1/3 of total system storage spave available to the browser/app.
 * 
* @class  module:Db.ZangoDb
* @extends {module:Db.IDb}
* @link module:Db
* @see module:Party.ZangoParty
*/
module.exports = class ZangoDb extends IDb {

  constructor ({dbname, factory}) {
    super(factory)
    debug('constructor')
    this.zango = null
    this.dbname = dbname
    this.error = null
  }


  async start(){

    debug('starting')


    let collectionSettings = {}

    for(const name of this.factory.getValidators()){
      debug('creating collection', name)

      const indexSettings = reach(this.factory, 'schemas.IndexSettings.'+name)

      const indices = ['$meta.id'].concat(indexSettings.unique).concat(indexSettings.indices)

      collectionSettings[this.prefix+name] = indices.length > 0 ? indices : true
    }

    debug('dbname',this.dbname, collectionSettings)

    this.zango = new zango.Db(this.dbname, collectionSettings)
    
  }

  async getCollectionNames(){

    const names = this.factory.getValidators()

    return names.map(name=>{return name.replace(this.prefix,'')})
  }


  async getCollection(name){ 
    let collection = this.zango.collection(this.prefix+name)

    return collection
  }

  /** convert db documnet to plain object with $meta field */
  documentToObject(doc){
    let obj = Object.assign({},doc)
    obj.$meta = {
      id: Hoek.reach(obj,'meta.id', {default: obj._id}),
      type: Hoek.reach(doc,'meta.type'),
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
      temp.$meta.id = (new ObjectId()).toHexString()
    }

    let dbDoc = this.documentFromObject(temp)
    
    return dbDoc
  }

  async find(collectionName, mongoQuery){

    let query = mongoQuery.getQueryDoc()

    debug('find collection=', collectionName, ' query=', JSON.stringify(query,null,2))
    let collection = await this.getCollection(collectionName)
    let resultSet = collection.find(query)


    if(mongoQuery.hasLimit()){
      resultSet = resultSet.limit(mongoQuery.getLimit())
    }

    if(mongoQuery.hasSort()){
      resultSet = resultSet.sort( mongoQuery.getSort() )
    }

    return (await resultSet.toArray()).map(this.documentToObject) || []
  }

  async insertMany(collectionName, docs){ 
    debug('insert collection=', collectionName, ' docs=', JSON.stringify(docs,null,2))
    let collection = await this.getCollection(collectionName)

    let resultSet = []

    for(let obj of docs){
      let temp = {...obj}
      if(temp._id===undefined){ temp._id = (new ObjectId()).toString(); temp.$meta.id=temp._id;  }

      let dbDoc = this.documentFromObject(temp)

      const stripped = this.stripMeta(temp)

      debug('validating', stripped,'from', temp)

      await this.factory.validate(collectionName, stripped)

      debug('its good, inserting', dbDoc)

      await collection.insert( dbDoc )

      debug('inserted', dbDoc)

      const finalObj = this.documentToObject(dbDoc)

      debug('returning', finalObj)

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

      debug('updating',obj, 'to', dbDoc)

      const stripped = this.stripMeta(dbDoc)
      const meta = this.onlyMeta(obj)

      debug('validating', stripped,'from', dbDoc)

      await this.factory.validate(collectionName, stripped)

      debug('its good, updating', dbDoc)

      let old = await collection.findOne( {'_id': dbDoc._id})

      debug('found old', old)
      dbDoc.meta.revision = old.meta.revision++

      
      let mergedDoc = {...old, ...dbDoc}

      await collection.update({'_id': dbDoc._id}, mergedDoc)

      const finalObj = this.documentToObject(mergedDoc)

      this.emitChange(finalObj, 'update')

      objs.push( finalObj )

    }

    return objs
  }

  async findAndRemove(collectionName, obj){ 
    debug('findAndRemove collection', collectionName, ' obj', obj)

    let collection = await this.getCollection(collectionName)

    const dbDoc = await collection.findOne( {'_id': obj.$meta.id})

    debug('found old doc', dbDoc)

    await collection.remove( { '_id': obj.$meta.id } )

    debug('dbDoc', dbDoc)

    let finalObj = this.documentToObject(dbDoc)

    finalObj.$meta.removed = true

    this.emitChange(finalObj, 'remove')

    debug('obj', finalObj)

    return finalObj
  }
}
