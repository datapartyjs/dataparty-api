const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const {Message, Routines} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.middleware.post.encrypt')

const IMiddleware = require('../../imiddleware')

module.exports = class Encrypt extends IMiddleware {

  static get Name(){
    return 'encrypt'
  }

  static get Type(){
    return 'post'
  }

  static get Description(){
    return 'Decrypt inbound data'
  }

  static get ConfigSchema(){
    return Joi.boolean()
  }

  static async start(party){
    
  }

  static async run(context){

    if (!Hoek.reach(context, 'endpoint.MiddlewareConfig.post.encrypt', false)){
      return
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