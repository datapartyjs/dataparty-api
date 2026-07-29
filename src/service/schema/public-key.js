'use strict'

const ISchema = require('../../bouncer/ischema')

class PublicKey extends ISchema {

  static get Type () { return 'public_key' }

  static get Schema(){
    return {
      created: {
        type: Number,
        required: true
      },

      role: String,     // [ guest, billing, service, wallet ]

      owner: {required: true, index: true, type: String},    // public key hash

      type: String,
      hash: {required: true, index: true, type: String, unique: true},
      public: {
        box: String,
        sign: String,
        pqkem: String,
        pqsign_ml: String,
        pqsign_slh: String
      }
    }
  }

  static setupSchema(schema){
    //schema.index({ 'hash': 1 }, {unique: true})
    return schema
  }

  static permissions (context) {
    return {
      read: false,
      new: false,
      change: false
    }
  }
}


module.exports = PublicKey
