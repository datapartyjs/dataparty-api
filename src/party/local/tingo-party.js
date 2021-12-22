'use strict'

const debug = require('debug')('dataparty.tingo-party')

const IParty = require('../iparty')
const TingoDb = require('../../bouncer/db/tingo-db')

const Qb = require('../qb')


/**
 * @class 
 * @alias module:dataparty.TingoParty
 * @interface
 */
class TingoParty extends IParty {

  constructor ({path, ...options}) {
    super(options)

    this.db = new TingoDb({
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

module.exports = TingoParty