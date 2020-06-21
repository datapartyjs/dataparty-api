const Joi = require('@hapi/joi')
const Hoek = require('@hapi/hoek')
const {Message, Identity} = require('@dataparty/crypto')
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

  static async run(ctx){

    if (!Config){ return }
  

    const senderStr = JSON.stringify({key: ctx.senderKey})

    const reply = new Message({msg: ctx.output})
    const sender = Identity.fromString(senderStr)

    const payload = await reply.encrypt(ctx.party.privateIdentity, sender.key)

    ctx.debug('setting payload', payload)
    ctx.setOutput(payload)

  }
}