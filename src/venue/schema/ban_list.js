'use strict'

const Hoek = require('hoek')
const BouncerDb = require('@dataparty/bouncer-db')

require('mongoose-schema-jsonschema')(BouncerDb.mongoose())
const cryptoRandomString = require('crypto-random-string')
const debug = require('debug')('venue.ban_list')

const Bouncer = require('../../bouncer')

const Utils = Bouncer.ISchema.Utils


class BanList extends Bouncer.ISchema {

  static get Type () { return 'ban_list' }

  static get Schema(){
    return {
      created: Utils.created,
      actor: Utils.actor(['cloud', 'billing_account']),
      email: {type: String, index: true},
      short_code: String,
    }
  }

  static setupSchema(schema){
    schema.index({ actor: {id: 1, type:1} }, {unique: true})

    schema.pre('save', async function() {
      if (this.short_code == null) {
        this.short_code = await this.getUniqueShortCode();
      }
    })

    return schema
  }

  static permissions (context) {
    return {
      read: false,
      new: false,
      change: false
    }
  }

  static async getUniqueShortCode(){
    let value = cryptoRandomString({length: 6, type:'url-safe'})
    let found = await this.findOne({short_code: value}).exec()

    while(found){
      value = cryptoRandomString({length: 6, type:'url-safe'})
      found = await this.findOne({short_code: value}).exec()
    }

    return value
  }

  static async isBanned(actor){
    const bans = await this.find({
    'actor.id': actor.id,
    'actor.type': actor.type
  }, {_id: 1})
    .limit(1)
    .exec()

  return bans.length > 0
  }
}


module.exports = BanList