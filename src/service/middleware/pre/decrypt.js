const Joi = require('joi')
const Hoek = require('@hapi/hoek')
const {Message, Routines} = require('@dataparty/crypto')
const debug = require('debug')('dataparty.middleware.pre.decrypt')

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

  static async start(party){
    
  }

  static async run(context, {Config}){

    if (!Config){ return }

    if(!context.input || !context.input.enc){
      throw new Error('insecure message')
    }

    context.debug('input', context.input, typeof context.input)
  

    const msg = new Message(context.input)
    context.debug('privateIdentity', context.party.privateIdentity.id)

    const publicKeys = Routines.extractPublicKeys(msg.enc)

    context.debug('sender', publicKeys)
    context.debug(typeof context.party.privateIdentity.key.private.box)
    context.debug(context.input.enc)

    const jsonContent = await msg.decrypt(context.party.privateIdentity)
    

    context.setSenderKey({
      type: 'nacl',
      public: publicKeys
    })

    context.setInputSession(Hoek.reach(jsonContent, 'session'))
    context.setInput(Hoek.reach(jsonContent, 'data'))
  }
}