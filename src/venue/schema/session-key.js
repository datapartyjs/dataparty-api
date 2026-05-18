'use strict'

const ISchema = require('../../bouncer/ischema')


function PublicKeySchema(unique=true){
  return  {
    type: {required: true, type: String},
    hash: {required: true, index: true, type: String, unique},
    public: {
      box: String,
      sign: String,
      pqkem: String,
      pqsign_ml: String,
      pqsign_slh: String
    }
  }
}


class SessionKey extends ISchema {

  static get Type () { return 'session_key' }

  static get Schema(){
    return {
      created: {
        type: Number,
        required: true
      },
      expiry: {
        type: Number,
        index: true,
        required: true
      },
      annoucement: {
        created: {
          type: Number,
          required: true
        },
        expiry: {
          type: Number,
          required: true
        },
        sessionKey: PublicKeySchema(true),
        actorKey: PublicKeySchema(false)
      },
      trust: {
        actorSig: {required: true, type: String},   //! base64 of BSON signature
        sessionSig: {required: true, type: String}  //! base64 of BSON signature
      }
    }
  }

  static setupSchema(schema){
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


module.exports = SessionKey