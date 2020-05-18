'use strict'

const Hoek = require('@hapi/hoek')
const Loki = require('lokijs')
const LFSA = require('lokijs/src/loki-fs-structured-adapter')
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
      unique: indexSettings.unique,
      indices: indexSettings.indices
    })
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
