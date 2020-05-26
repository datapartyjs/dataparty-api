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

  async run(config, context){
    if(!config){
      return
    }

    if (!Hoek.reach(context, 'endpoint.MiddlewareConfig.pre.decrypt', false)){
      return Promise.resolve(context)
    }
  

    const msg = new Message(context.input)
    const jsonContent = await msg.decrpyt(this.serviceParty.privateIdentity)
    const publicKeys = Routines.extractPublicKeys(msg.enc)

    context.setInputSession(jsonContent.session)

    return {
      input: Hoek.reach(content, 'data'),
      sender: {
        type: 'ecdsa',
        public: publicKeys
      }
    }
  }
}