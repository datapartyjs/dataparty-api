'use strict'

const debug = require('debug')('venue.venue_project')

const ISchema = require('../../bouncer/ischema')

const Utils = ISchema.Utils


class VenueProject extends ISchema {

  static get Type () { return 'venue_project' }

  static get Schema(){
    return {
      owner: {type: String, required: true},
      created: {type: Number, required: true},
      changed: {type: Number, required: true},
      workspace: {type: String, required: true},
      tarpath: {type: String},
      hash: {type: String, required: true, index: true},

      enabled: {type: Boolean},


      project: {
        owner: {type: String, required: true, index: true},  //public_key.key.hash
        //created: {type: Number, required: true},

        name: {type: String, required: true, index: true},
        version: {type: String, required: true, index: true},
        venue: {type: String},
        domain: {type: String, index: true/*, unique: true*/},

        i2p: {
          address: String,
          public: String,
          securePrivate: String
        },

        party: [{
          name: String,
          type: {type: String, enum: ['tingo', 'zango', 'loki', 'peer', 'mongo']},
          tingo: {
            path: String
          },
          zango: {
            dbname: String
          },
          loki: {
            dbAdapter: {type: String, enum: ['memory', 'fs', 'lsfa', 'localstorage']},
            path: String
          },
          mongo: {
            uri: String,
            mongoOptions: String,
            secureUri: String
          }
          peer: {
            venue: String,
            remoteIdentity: String
          },
          key: {
            hash: String,
            securePrivate: String
          },
          settings: {
            noCache: Boolean,
          },
          defaultConfig: Object
        }],
        routes: [{
          prefix: String,
          party: String,
          package: {
            owner: String,
            name: {type: String, required: true},
            version: String,
            branch: String,
            hash: String,
          },
          settings: {
            sendFullErrors: {type: Boolean, required: true},
            useNative: {type: Boolean, required: true},
          }
        }],
        files: Object,
        signatures: {type: Object, required: true}
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


module.exports = VenueProject