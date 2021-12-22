'use strict'

const Hoek = require('@hapi/hoek')
const Loki = require('lokijs')
const LFSA = require('lokijs/src/loki-fs-structured-adapter')
const ObjectId = require('bson-objectid')

const MongoQuery = require('../mongo-query')
const debug = require('debug')('dataparty.local.loki-db')


module.exports = class LokiDb extends IDb {

  constructor ({path, factory, dbAdapter}) {
    super()
    debug('constructor')
    this.loki = null
    this.path = path
    this.factory = factory
    this.dbAdapter = dbAdapter || new LFSA()
    this.error = null
  }


  async start(){

    debug('starting')
    await new Promise((resolve,reject)=>{
      try{

        this.loki = new Loki(
          this.path,
          { 
            adapter : this.dbAdapter,
            autoload: true,
            autoloadCallback : resolve,
            autosave: true, 
            autosaveInterval: 1000
          }
        )

      }
      catch(err){ this.error = err; reject(err) }
    })

    /** @todo
      - create db collections
      - set indicies
      - set uniques
    */


    debug('started')

    debug(this.factory.model.IndexSettings)
    debug(this.factory.getValidators())

    for(const collectionName of this.factory.getValidators()){
      this.createCollection(collectionName)
    }
    
  }

  createCollection(name){
    debug('createCollection', name)
    const indexSettings = Hoek.reach(this.factory, 'model.IndexSettings.'+name)

    const existing = this.loki.getCollection(name)
    if(existing !== null){ return }

    const options = {
      unique: ['$meta.id'].concat(indexSettings.unique),
      indices: ['$meta.id'].concat(indexSettings.indices)
    }

    debug('createCollection', name, options)

    this.loki.addCollection(name, options)
  }

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
  }

  async applyFind(crufl, includeData = false){
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
      
      collection.findAndRemove(msg)
      msgs.push(msg)
    }

    return msgs
  }
}
