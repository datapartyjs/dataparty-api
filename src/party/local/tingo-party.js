'use strict'

const debug = require('debug')('dataparty.tingo-party')

const IParty = require('../iparty')
const TingoDb = require('../../bouncer/db/tingo-db')
const AdminCrufler = require('../../bouncer/crufler-admin')

const Qb = require('../qb')


/**
 * @class 
 * @alias module:dataparty.TingoParty
 * @interface
 */
class TingoParty extends IParty {

  constructor ({path, qbOptions, tingoOptions, ...options}) {
    super(options)

    this.db = new TingoDb({
      path, factory: this.factory,
      tingoOptions
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

module.exports = TingoParty