'use strict'

const debug = require('debug')('dataparty.loki-party')

const IParty = require('../iparty')
const LokiDb = require('../../bouncer/db/loki-db')
const AdminCrufler = require('../../bouncer/crufler-admin')

const Qb = require('../qb')



/**
 * A local party based on LokiJS.
 * @see https://github.com/techfort/LokiJS
 * 
 * @class  module:Party.LokiParty
 * @extends {module:Party.IParty}
 * @link module.Party
 * @param {string} path Path on filesystem to lokijs db file
 * @param {LokiAdapater} dbAdapter Lokijs db adapter, see: http://techfort.github.io/LokiJS/tutorial-Persistence%20Adapters.html
 * @param {Object} lokiOptions Options to pass to lokijs see: http://techfort.github.io/LokiJS/Loki.html
*/
class LokiParty extends IParty {

  /**
   * 
   * @param {*} param0 
   */

  constructor ({path, dbAdapter, qbOptions, lokiOptions, ...options}) {
    super(options)

    this.db = new LokiDb({
      dbAdapter,
      path, factory: this.factory,
      lokiOptions
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