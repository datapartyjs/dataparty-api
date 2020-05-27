const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const {Message, Routines} = require('@dataparty/crypto')
const debug = require('debug')('roshub.middleware.pre.decrypt')

const IMiddleware = require('../../imiddleware')

module.exports = class Decrypt extends IMiddleware {

  static get Name(){
    return 'decrypt'
  }

  static get Type(){
    return 'pre'
  }

  static get Description(){
    return 'Decrypt inbound data'
  }

  static get ConfigSchema(){
    return Joi.boolean()
  }

  static async run(ctx, static_ctx){

    if (!Hoek.reach(ctx, 'endpoint.MiddlewareConfig.pre.decrypt', false)){
      return
    }
  

    const msg = new Message(ctx.input)
    const jsonContent = await msg.decrpyt(this.serviceParty.privateIdentity)
    const publicKeys = Routines.extractPublicKeys(msg.enc)

    ctx.setInputSession(jsonContent.session)

    return {
      input: Hoek.reach(content, 'data'),
      sender: {
        type: 'ecdsa',
        public: publicKeys
      }
    }
  }
}