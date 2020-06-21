const Joi = require('@hapi/joi')
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
            type: Joi.string().valid('ecdsa'),
            public: Joi.object().keys({
              box: Joi.string(),
              sign: Joi.string()
            }),
            private: Joi.any().strip()
          }
        })
      }
    }
  }

  static async run(ctx, static_ctx){

  
    const identity = ctx.party.identity

    return {
      ...identity
    }
  }
}