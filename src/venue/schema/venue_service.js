'use strict'

const debug = require('debug')('venue.venue_srv')


const ISchema = require('../../bouncer/ischema')

const Utils = ISchema.Utils


class VenueSrv extends ISchema {

  static get Type () { return 'venue_srv' }

  static get Schema(){
    return {
      owner: {type: String, required: true, index: true},  //public_key.key.hash
      party: {type: String, required: true, index: true},  //party's public key hash
      created: {type: Number, required: true},
      settings: {
        enabled: {type: Boolean, required: true},
        workspace: {type: String, required: true},
        domain: {type: String, required: true, index: true},
        prefix: {type: String, required: true},
        sendFullErrors: {type: Boolean, required: true},
        useNative: {type: Boolean, required: true},
        defaultConfig: {type: Object}
      },
      package: {
        name: {type: String, required: true, index: true},
        version: {type: String, required: true},
        githash: {type: String, required: true},
        branch: {type: String, required: true}
      },
      compressedBuild: {type: String, required: true}, //! zlib compressed
      signature: {
        timestamp: {type: Number, required: true},
        type: {type: String, required: true, maxlength: 10},
        value: {type: String, required: true}
      }
    }
  }

  static setupSchema(schema){
    //schema.index({ 'package.name': 1 }, {unique: true})
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


module.exports = VenueSrv