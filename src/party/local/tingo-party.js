'use strict'

const debug = require('debug')('dataparty.tingo-party')

const IParty = require('../iparty')
const TingoDb = require('../../bouncer/db/tingo-db')
const AdminCrufler = require('../../bouncer/crufler-admin')

const Qb = require('../qb')


class TingoParty extends IParty {
/**
 * A local party implementation based on TingoDB
 * Ideal for extremely large datasets with frequent document additions.  Has a very efficient append-only file system driver which is ideal for embedded platforms. All database indexes must fit into RAM and are re-computed at db load time.
 * 
 * @class  module:Party.TingoParty
 * @implements {module:Party.IParty}
 * @link module.Party
 * @see http://www.tingodb.com
 * @param string path  Path to a directory on the file system to store tingo db
 * @param {Object} tingoOptions O ptions to pass to tingodb. Defaults to `{nativeObjectID: true}`. See: https://github.com/sergeyksv/tingodb#requiretingodboptions
 */
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

  /**
   * @method  module:Party.TingoParty.start
   */
  async start(){
    await super.start()
    await this.db.start()
  }


  /**
   * @method  module:Party.TingoParty.handleCall
   * @param {Object} ask 
   * @returns 
   */
  async handleCall(ask){
    return await this.crufler.handleCall(ask)
  }
}

module.exports = TingoParty