'use strict'

const debug = require('debug')('dataparty.local-party')

const IParty = require('../iparty')
const LokiDb = require('./loki-db')

const Qb = require('../qb')


/**
 * @class 
 * @alias module:dataparty.LocalParty
 * @interface
 */
class LocalParty extends IParty {

  constructor ({path, dbAdapter, ...options}) {
    super(options)

    this.db = new LokiDb({
      path, factory: this.factory
    })

    this.qb = new Qb({
      call: this.handleCall.bind(this),
      cache: this.cache
    })
  }

  async start(){
    await super.start()
    await this.db.start()
  }


  async handleCall(ask){
    return await this.db.handleCall(ask)
  }
}

module.exports = LocalParty