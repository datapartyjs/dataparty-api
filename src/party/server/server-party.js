'use strict'

const BouncerDb = require('@dataparty/bouncer-db')
const debug = require('debug')('dataparty.server-party')

const IParty = require('../iparty')
const Qb = require('../qb')


/**
 * @class 
 * @alias module:dataparty.LocalParty
 * @interface
 */
class ServerParty extends IParty {

  constructor ({uri, mongoOptions, serverModels, ...options}) {
    super(options)

    this.db = new BouncerDb(uri, mongoOptions)
    this.serverModels = serverModels

    this.qb = new Qb({
      call: this.handleCall.bind(this),
      cache: this.cache
    })
  }

  async start(){
    debug('starting ...')
    await super.start()
    await this.db.connect()

    if(this.serverModels){ this.db.addModels(this.serverModels) }
  }


  async handleCall(ask){
    const reply = await this.db.adminAsk({bundle: JSON.parse(JSON.stringify(ask))})

    return JSON.parse(JSON.stringify(reply))
  }
}

module.exports = ServerParty