'use strict'

const BouncerDb = require('@dataparty/bouncer-db')
const debug = require('debug')('dataparty.mongo-party')

const IParty = require('../iparty')
const Qb = require('../qb')


/**
 * @class 
 * @alias module:dataparty.MongoParty
 * @interface
 */
class MongoParty extends IParty {

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
    else{
      debug('loading models from bouncer model')
      this.db.addBouncerModels(this.factory.model)
    }
  }


  async handleCall(ask){
    const reply = await this.db.adminAsk({bundle: JSON.parse(JSON.stringify(ask))})

    return JSON.parse(JSON.stringify(reply))
  }
}

module.exports = MongoParty