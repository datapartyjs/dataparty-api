'use strict'


const Loki = require('lokijs')
const LFSA = require('lokijs/src/loki-fs-structured-adapter')
const EventEmitter = require('last-eventemitter')

const debug = require('debug')('dataparty.local.loki-db')


//const LokiIndexedAdapater = require('lokijs/src/loki-indexed-adapter')
//const LokiAdapter = new LokiIndexedAdapater('dataparty-cache')

module.exports = class LokiDb extends EventEmitter {

  constructor ({path, adapter, factory}) {
    super()
    debug('constructor')
    this.loki = null
    this.path = path
    this.factory = factory
    this.dbAdapter = adapter || new LFSA()
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
  }

  createCollection(name){
    
  }

  collection(name){
    if(!this.db.getCollection(name)){

    }
  }
}
