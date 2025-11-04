const Joi = require('joi')
const Hoek = require('@hapi/hoek')
const {Message, Routines} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.endpoint.identity')

const IEndpoint = require('../iendpoint')

module.exports = class ServiceIdentity extends IEndpoint {

  static get Name(){
    return 'identity'
  }


  static get Description(){
    return 'Get host identity'
  }

  static get MiddlewareConfig(){
    return {
      pre: {
        decrypt: false,
        validate: Joi.object().keys({}).description('no input allowed'),
      },
      post:{
        validate: Joi.object().keys({
          id: Joi.string(),
          key: {
            type: Joi.alternatives().try(
              Joi.string().valid('nacl,nacl,ml_kem1024,ml_dsa65,slh_dsa_sha2_128f')
            ),
            hash: Joi.string(),
            public: Joi.object().keys({
              box: Joi.string(),
              sign: Joi.string(),
              pqkem: Joi.string(),
              pqsign_ml: Joi.string(),
              pqsign_slh: Joi.string()
            }),
            private: Joi.any().strip()
          },
          seed: Joi.any().strip()
        })
      }
    }
  }

  static async run(ctx, {Package}){

  
    const identity = ctx.party.identity

    return identity.toJSON()
  }
}
