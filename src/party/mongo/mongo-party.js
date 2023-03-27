'use strict'

const BouncerDb = require('@dataparty/bouncer-db')
const debug = require('debug')('dataparty.mongo-party')

const IParty = require('../iparty')
const Qb = require('../qb')



/**
 * A party implementation based on Mongodb and mongoose.
 * 
 *  The humongouse database we all know all love. If you need a multi-region HA database, this is the one.
 * @see https://mongoosejs.com/
 * 
 * @class  module:Party.MongoParty
 * @implements {module:Party.IParty}
 * @link module.Party
 */
class MongoParty extends IParty {

  constructor ({uri, mongoOptions, serverModels, qbOptions, ...options}) {
    super(options)

    this.db = new BouncerDb(uri, mongoOptions)
    this.serverModels = serverModels

    this.qb = new Qb({
      call: this.handleCall.bind(this),
      cache: this.cache,
      ...qbOptions
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