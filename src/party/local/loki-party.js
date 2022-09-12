'use strict'

const debug = require('debug')('dataparty.loki-party')

const IParty = require('../iparty')
const LokiDb = require('../../bouncer/db/loki-db')
const AdminCrufler = require('../../bouncer/crufler-admin')

const Qb = require('../qb')


/**
 * @class 
 * @alias module:dataparty.LokiParty
 * @interface
 */
class LokiParty extends IParty {

  constructor ({path, dbAdapter, qbOptions, ...options}) {
    super(options)

    this.db = new LokiDb({
      dbAdapter,
      path, factory: this.factory
    })

    this.crufler = new AdminCrufler({
      db: this.db
    })


    this.qb = new Qb({
      call: this.handleCall.bind(this),
      cache: this.cache,
      ...qbOptions
    })
  }

  async start(){
    await super.start()
    await this.db.start()
  }


  async handleCall(ask){
    return await this.crufler.handleCall(ask)
  }
}

module.exports = LokiParty