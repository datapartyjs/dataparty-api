'use strict'

const debug = require('debug')('venue.venue_pkg')

const ISchema = require('../../bouncer/ischema')

const Utils = ISchema.Utils


class VenuePkg extends ISchema {

  static get Type () { return 'venue_pkg' }

  static get Schema(){
    return {
      owner: {type: String, required: true, index: true},  //public_key.key.hash
      created: {type: Number, required: true},
      changed: {type: Number},
      venue: {type: String},
      settings: {
        enabled: {type: Boolean, required: true},
        staticPrefix: String,
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


module.exports = VenuePkg