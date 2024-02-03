'use strict'

const IDb = require('../idb')
const Hoek = require('@hapi/hoek')
const Loki = require('lokijs')
const LokiFS = Loki.LokiFsAdapter
const LFSA = require('lokijs/src/loki-fs-structured-adapter')
const ObjectId = require('bson-objectid')
const uuidv4 = require('uuid/v4')

const MongoQuery = require('../mongo-query')
const { promisfy } = require('promisfy')
const debug = require('debug')('bouncer.db.loki-db')



/**
 * A db implementation based on LokiJS.
 * 
 * Ideal for frontend apps with small datasets (smaller than total RAM). This is an in-memory db so it trades RAM efficiency for access speed.
 * @see https://github.com/techfort/LokiJS
 * 
 * @class  module:Db.LokiDb
 * @extends {module:Db.IDb}
 * @link module:Db
 * @see module:Party.LokiParty
 */
module.exports = class LokiDb extends IDb {

  constructor ({path, factory, dbAdapter, lokiOptions, useUuid}) {
    super(factory)
    debug('constructor')
    this.loki = null
    this.lokiOptions = lokiOptions
    this.path = path
    this.dbAdapter = dbAdapter || new LFSA()
    this.error = null
    this.useUuid = (useUuid==undefined) ? true : useUuid
  }

  static get LokiLocalStorageAdapter(){
    return Loki.LokiLocalStorageAdapter
  }


  async start(){

    debug('starting')

    debug('path',this.path)
    this.loki = new Loki(
      this.path,
      { 
        adapter : this.dbAdapter,
        ...this.lokiOptions
      }
    )

    
    await new Promise((resolve, reject)=>{
      this.loki.loadDatabase({}, resolve)
      debug('started with collections', this.loki.listCollections())
    })
    
    await super.start()
    //await promisfy(this.loki.saveDatabase.bind(this.loki))
    debug('started with collections', this.loki.listCollections())
  }

  async getCollectionNames(){
    const names = this.loki.listCollections()

    return names.map(obj=>{return obj.name.replace(this.prefix,'')})
  }

  async createCollection(name, indexSettings){
    debug('createCollection', name, indexSettings)
    
    /*const existing = this.loki.getCollection(name)
    if(existing !== null){ return }*/

    if(this.hasCollection(name) == true){ return }

    const options = {
      unique: ['$meta.id'].concat(indexSettings.unique),
      indices: ['$meta.id'].concat(indexSettings.indices)
    }

    debug('createCollection', name, options)


    options.unique.push('$meta.id')

    let collection = this.loki.addCollection(this.prefix+name, options)

    debug(collection)
  }

  async getCollection(name){ 
    let collection = this.loki.getCollection(this.prefix+name)

    debug('collections', this.loki.listCollections())

    return collection
  }

  /** convert db documnet to plain object with $meta field */
  documentToObject(doc){
    let obj = Object.assign({},doc)
    obj.$meta = {
      id: Hoek.reach(obj,'$meta.id', {default: obj._id}),
      type: Hoek.reach(doc,'$meta.type'),
      created: Hoek.reach(obj,'$meta.created', {default: (new Date()).toISOString()}),
      revision: Hoek.reach(obj,'$meta.revision', {default: 1}),
      removed: Hoek.reach(obj,'$meta.removed')
    }
    
    delete obj.meta
    delete obj.$loki
    delete obj._id

    return obj
  }


  /** convert object with $meta field to db representation*/
  documentFromObject(obj){ 
    let doc = Object.assign({},obj)
    doc._id = Hoek.reach(obj,'$meta.id', {default: obj._id}),
    doc.$meta = {
      id: Hoek.reach(obj,'$meta.id', {default: obj._id}),
      type: Hoek.reach(obj,'$meta.type'),
      created: Hoek.reach(obj,'$meta.created', {default: (new Date()).toISOString()}),
      revision: Hoek.reach(obj,'$meta.revision', {default: 1}),
      removed: Hoek.reach(obj,'$meta.removed')
    }
    

    //delete doc.$meta

    return doc
  }

  ensureId(obj){
    let temp = {...obj}
    if(!reach(temp,'$meta.id')){

      if(this.useUuid){
        temp.$meta.id = uuidv4()
      }
      else{
        temp.$meta.id = (new ObjectId()).toHexString()
      }
    }

    let dbDoc = this.documentFromObject(temp)
    
    return dbDoc
  }

  /*
  async handleCall(ask){
    debug('handleCall')
    //debug('\task', JSON.stringify(ask,null,2))

    let complete = true
    let results = []

    for(let crufl of ask.crufls){
      let result = {
        op: crufl.op,
        uuid: crufl.uuid,
        msgs: [],
        complete: true,
        error: null
      }

      debug('\tcrufl->', crufl.op, crufl.type)

      //debug('\t\tcrufl ->', crufl)

      switch(crufl.op){
        case 'create':
          result.msgs = await this.applyCreate(crufl)
          break
        case 'remove':
          result.msgs = await this.applyRemove(crufl)
          break
        case 'find':
          result.msgs = await this.applyFind(crufl, false)
          break
        case 'lookup':
          result.msgs = await this.applyFind(crufl, true)
          break
        
        default:
          break
      }

      results.push(result)
    }

    let freshness = {
      uuid: ask.uuid,
      results,
      complete
    }

    //debug('replying', JSON.stringify(freshness,null,2))

    return {freshness: results }
  }*/

  async find(collectionName, mongoQuery){

    let query = mongoQuery.getQueryDoc()

    debug('find collection=', collectionName, ' query=', JSON.stringify(query,null,2))
    let collection = await this.getCollection(collectionName)
    let resultSet = collection.chain().find(query)


    if(mongoQuery.hasLimit()){
      resultSet = resultSet.limit(mongoQuery.getLimit())
    }

    if(mongoQuery.hasSort()){
      let sortPath = Object.keys(mongoQuery.getSort())[0]
      resultSet = resultSet.simplesort( sortPath )
    }

    return resultSet.data().map(this.documentToObject) || []
  }

  async insertMany(collectionName, docs){ 
    debug('insert collection=', collectionName, ' docs=', JSON.stringify(docs,null,2))
    let collection = await this.getCollection(collectionName)

    let resultSet = []

    for(let obj of docs){
      let temp = {...obj}
      if(temp._id===undefined){

        if(this.useUuid){
          temp._id = uuidv4()
        }
        else{
          temp._id = (new ObjectId()).toHexString()
        }

        temp.$meta.id=temp._id;
      }

      

      let dbDoc = this.documentFromObject(temp)

      const stripped = this.stripMeta(temp)

      debug('validating', stripped,'from', temp)

      await this.factory.validate(collectionName, stripped)

      debug('its good, inserting', dbDoc)

      const result = collection.insert( dbDoc )

      debug('inserted', result)

      const finalDbDoc = result
      const finalObj = this.documentToObject(finalDbDoc)

      debug('returning', finalObj)

      this.emitChange(finalObj, 'create')

      resultSet.push(finalObj)
    }


    await promisfy(this.loki.saveDatabase.bind(this.loki))
    return resultSet

  }
  
  async update(collectionName, docs){ 
    debug('update collection', collectionName, ' docs', docs)

    let collection = await this.getCollection(collectionName)

    let objs = []

    for(let obj of docs){
      let dbDoc = this.documentFromObject(obj)

      dbDoc.$meta.revision++

      debug('updating',obj, 'to', dbDoc)

      const stripped = this.stripMeta(dbDoc)

      debug('validating', stripped,'from', dbDoc)

      await this.factory.validate(collectionName, stripped)

      debug('its good, updating', dbDoc)

      let old = collection.findOne( {'$meta.id': dbDoc._id})
      
      let mergedDoc = {...old, ...dbDoc}

      collection.update(mergedDoc)

      const finalObj = this.documentToObject(mergedDoc)

      this.emitChange(finalObj, 'update')

      objs.push( finalObj )

    }

    await promisfy(this.loki.saveDatabase.bind(this.loki))
    return objs
  }

  async findAndRemove(collectionName, obj){ 
    debug('findAndRemove collection', collectionName, ' obj', obj)

    let collection = await this.getCollection(collectionName)

    const dbDoc = collection.findAndRemove( { '$meta.id': obj.$meta.id } )

    let finalObj = {
      $meta: obj.$meta
    }

    finalObj.$meta.removed = true

    this.emitChange(finalObj, 'remove')

    debug('finalObj', finalObj)
    debug('obj', obj)

    await promisfy(this.loki.saveDatabase.bind(this.loki))
    return finalObj
  }

  /*async applyFind(crufl, includeData = false){
    debug('find', JSON.stringify(crufl,null,2))
    let query = new MongoQuery(crufl.spec)

    let MongoQuery = query.getQueryDoc()

    debug('loki-find', JSON.stringify(MongoQuery,null,2))

    let collection = this.loki.getCollection(crufl.type)

    let resultSet = collection.find(MongoQuery)

    //debug(collection)
    //debug('resultSet', resultSet)

    let msgs = []

    for(const result of resultSet){

      if(includeData){

        let msg = Object.assign({},result)
        msg.$meta.revision = msg.meta.revision
        msg.$meta.created = msg.meta.created
        msg.$meta.version = msg.meta.version
        delete msg.meta
        delete msg.$loki

        msgs.push(msg)

      } else{

        msgs.push({
          $meta:{
            id: result.$meta.id,
            type: result.$meta.type
          }
        })

      }
    }

    debug(msgs)
    return msgs
  }

  async applyCreate(crufl){
    let msgs = []

    let collection = this.loki.getCollection(crufl.type)


    for(let createMsg of crufl.msgs){
      let raw = {...createMsg}
      raw.$meta.id = (new ObjectId()).toHexString()
      let doc = collection.insert(Object.assign({},raw))
      

      let msg = Object.assign({},doc)
      msg.$meta.revision = msg.meta.revision
      msg.$meta.created = msg.meta.created
      msg.$meta.version = msg.meta.version
      delete msg.meta
      delete msg.$loki

      msgs.push(msg)
    }

    return msgs
  }

  async applyRemove(crufl){
    let msgs = []

    let collection = this.loki.getCollection(crufl.type)

    for(let rmMsg of crufl.msgs){
      let msg = { $meta: {
        removed: true,
        id: rmMsg.$meta.id,
        type: rmMsg.$meta.type
      }}

      collection.findAndRemove(rmMsg)
      msgs.push(msg)
    }

    return msgs
  }
  */
}
