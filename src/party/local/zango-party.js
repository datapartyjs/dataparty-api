 
'use strict'

const debug = require('debug')('dataparty.zango-party')

const IParty = require('../iparty')
const ZangoDb = require('../../bouncer/db/zango-db')
const AdminCrufler = require('../../bouncer/crufler-admin')

const Qb = require('../qb')


/**
 * @class
 * @alias module:dataparty.ZangoParty
 * @interface
 */
class ZangoParty extends IParty {

  constructor ({dbname, qbOptions, ...options}) {
    super(options)

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

  async start(){
    await super.start()
    await this.db.start()
  }


  async handleCall(ask){
    return await this.crufler.handleCall(ask)
  }
}

module.exports = ZangoParty
