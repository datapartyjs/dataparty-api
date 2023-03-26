'use strict'

const debug = require('debug')('dataparty.tingo-party')

const IParty = require('../iparty')
const TingoDb = require('../../bouncer/db/tingo-db')
const AdminCrufler = require('../../bouncer/crufler-admin')

const Qb = require('../qb')



/**
 * A local party implementation based on TingoDB
 * @see http://www.tingodb.com/
 * 
 * @class  module:Party.TingoParty
 * @implements {module:Party.IParty}
 * @link module.Party
 * @see http://www.tingodb.com/
 * @param string path  Path to a directory on the file system to store tingo db
 * @param {Object} tingoOptions O ptions to pass to tingodb. Defaults to `{nativeObjectID: true}`. See: https://github.com/sergeyksv/tingodb#requiretingodboptions
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