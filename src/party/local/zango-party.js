 
'use strict'

const debug = require('debug')('dataparty.zango-party')

const IParty = require('../iparty')
const ZangoDb = require('../../bouncer/db/zango-db')
const AdminCrufler = require('../../bouncer/crufler-admin')

const Qb = require('../qb')


class ZangoParty extends IParty {

/**
 * A local party implementation based on IndexedDb via ZangoDB
 * 
 * Ideal for frontend apps with large datasets (larger then total RAM). This is an IndexedDb based driver so it span to nearly 1/3 of total system storage spave available to the browser/app.
 * @see https://erikolson186.github.io/zangodb/
 * 
 * @class  module:Party.ZangoParty
 * @extends {module:Party.IParty}
 * @link module.Party
 * @param string dbName
 */

  constructor ({dbname, qbOptions, ...options}) {
    super(options)

    this.dbStarted = false
    this.db = new ZangoDb({
      dbname, factory: this.factory,
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
   * @method  module:Party.ZangoParty.start
   */
  async start(){
    await super.start()
    if(!this.dbStarted){
      await this.db.start()
      this.dbStarted = true
    }
  }


  /**
   * @method  module:Party.ZangoParty.handleCall
   * @param {Object} ask 
   * @returns 
   */
  async handleCall(ask){
    return await this.crufler.handleCall(ask)
  }
}

module.exports = ZangoParty
