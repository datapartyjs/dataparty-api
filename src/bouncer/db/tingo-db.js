'use strict'

const Hoek = require('@hapi/hoek')
const Tingo = require('tingodb')()
const ObjectId = require('bson-objectid')
const EventEmitter = require('last-eventemitter')
const {promisfy, waitFor} = require('promisfy')

const MongoQuery = require('../../party/local/loki-query')
const debug = require('debug')('dataparty.local.tingo-db')


module.exports = class TingoDb extends EventEmitter {

  constructor ({path, factory, tingoOptions}) {
    super()
    debug('constructor path=',path)
    this.tingo = null
    this.path = path
    this.factory = factory
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

    /** @todo
      - create db collections
      - set indicies
      - set uniques
    */


    debug('started')

    debug(this.factory.model.IndexSettings)
    debug(this.factory.getValidators())

    for(const collectionName of this.factory.getValidators()){
      await this.createCollection(collectionName)
    }
    
  }

  async collectionNames(name){
    let names = await promisfy(this.tingo.collectionNames.bind(this.tingo))({})

    return names
  }

  async createCollection(name){
    debug('createCollection', name)
    const indexSettings = Hoek.reach(this.factory, 'model.IndexSettings.'+name)

    const existing = (await this.collectionNames()).indexOf(name) != -1
    if(existing !== null){ return }

    const options = {
      unique: ['meta.id'].concat(indexSettings.unique),
      indices: ['meta.id'].concat(indexSettings.indices)
    }

    debug('createCollection', name, options)

    let ollection = await promisfy(this.tingo.createCollection.bind(this.tingo))(name)
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

    let collection = await promisfy(this.tingo.collection.bind(this.tingo))(crufl.type)

    let resultSet = await new Promise((resolve,reject)=>{
      let cursor = collection.find(MongoQuery) 
      cursor.toArray((arr)=>{
        if(!arr){ arr = [] }

        resolve(arr)
      })
    })

    debug(resultSet)

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
        //delete msg.$meta

        msgs.push(msg)

      } else{

        msgs.push({
          $meta:{
            id: result.$meta.id,
            type: result.$meta.type,
            revision: result.$meta.revision
          }
        })

      }
    }

    debug(msgs)
    return msgs
  }

  async applyCreate(crufl){
    let msgs = []

    let collection = await promisfy(this.tingo.collection.bind(this.tingo))(crufl.type)

    for(let createMsg of crufl.msgs){
      let raw = {...createMsg}
      
      raw.meta = raw.$meta
      raw.meta.created = Date.now()
      delete raw.$meta

      raw.meta.id = (new ObjectId()).toHexString()

      const docs = await promisfy(collection.insert.bind(collection))(Object.assign({},raw) )

      debug('docs', docs)

      const doc = docs[0]

      let msg = Object.assign({},doc)

      msg.$meta = {
        id: msg.meta.id,
        type: msg.meta.type,
        revision: msg.meta.revision || 1,
        created: msg.meta.created
      }
      delete msg.meta

      msgs.push(msg)
    }

    return msgs
  }

  async applyRemove(crufl){
    let msgs = []

    let collection = await promisfy(this.tingo.collection.bind(this.tingo))(crufl.type)

    for(let rmMsg of crufl.msgs){
      let msg = { $meta: {
        removed: true,
        id: rmMsg.$meta.id,
        type: rmMsg.$meta.type
      }}
      
      await promisfy(collection.findAndRemove.bind(collection))(msg)
      msgs.push(msg)
    }

    return msgs
  }
}
