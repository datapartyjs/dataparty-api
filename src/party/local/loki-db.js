'use strict'

const Hoek = require('@hapi/hoek')
const Loki = require('lokijs')
const LFSA = require('lokijs/src/loki-fs-structured-adapter')
const ObjectId = require('bson-objectid')
const EventEmitter = require('last-eventemitter')

const debug = require('debug')('dataparty.local.loki-db')


//const LokiIndexedAdapater = require('lokijs/src/loki-indexed-adapter')
//const LokiAdapter = new LokiIndexedAdapater('dataparty-cache')

module.exports = class LokiDb extends EventEmitter {

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
            autosaveInterval: 10000
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
    debug('\createCollection', name)
    const indexSettings = Hoek.reach(this.factory, 'model.IndexSettings.'+name)

    const existing = this.loki.getCollection(name)
    if(existing !== null){ return }

    this.loki.addCollection(name, {
      unique: ['$meta.id'].concat(indexSettings.unique),
      indices: ['$meta.id'].concat(indexSettings.indices)
    })
  }

  async handleCall(ask){
    debug('handleCall')
    debug('\task', JSON.stringify(ask,null,2))

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

      debug('\t\tcrufl ->', crufl)

      if(crufl.op == 'create'){
        result.msgs = await this.applyCreate(crufl)
      }

      results.push(result)
    }

    let freshness = {
      uuid: ask.uuid,
      results,
      complete
    }

    debug('replying', JSON.stringify(freshness,null,2))

    return //{freshness: [freshness] }
  }

  async applyQuerySpec(){
    // Todo
  }

  async applyCreate(createCrufl){
    let msgs = []

    let collection = this.loki.getCollection(createCrufl.type)

    for(let createMsg of createCrufl.msgs){
      let msg = {...createMsg}
      msg.$meta.id = ObjectId()
      collection.insert(Object.assign({},msg))
      msgs.push(msg)
    }

    return msgs
  }

  /**
   * @method
   */
  find () {
    return new Query(this.qb, this.model)
  }

  // takes modified json msgs & writes to backend, resolves to new stamps
  // requires type & id
  /**
   * @method
   */
  update (...msgs) {
    return this.qb.modify(msgs, 'update')
  }


  /**
   * @method
   */
  create (type, ...msgs) {
    return this.qb.create(type, msgs)
  }


  /**
   * @method
   */
  remove (...msgs) {
    return this.qb.modify(msgs, 'remove')
  }
}
