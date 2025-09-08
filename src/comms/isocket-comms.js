'use strict'

const debug = require('debug')('dataparty.comms.socketcomms')
const EventEmitter = require('eventemitter3')

const {Message, Routines} = require('@dataparty/crypto')

const AuthOp = require('./op/auth-op')
const RosShim = require('./ros-shim')



/**
 * @interface module:Comms.ISocketComms
 * @link module:Comms
 * @extends EventEmitter
 * 
 * @param {string}                  session
 * @param {module:Party.IParty}     party
 * @param {module:Dataparty_Crypto.IIdentityProps}  remoteIdentity
 * @param {boolean}                 discoverRemoteIdentity  Set to true if ANY remote identity can connect. When set to `true` the remoteIdentity will be populated from the client.
 */

class ISocketComms extends EventEmitter {
    constructor({session, uri, party, remoteIdentity, discoverRemoteIdentity}){
        super()
        this.uri = uri
        this.session = session
        this.remoteIdentity = remoteIdentity
        this.discoverRemoteIdentity = discoverRemoteIdentity

        this.party = party //used for access to primary identity

        this.connected = false
        this.authed = undefined
        
        this._opId = Math.round(Math.random()*65536)

        this.socket = undefined

        //this.aesOffer = null
        this.aesStream = null

        this._ros = undefined
    }

    get opId(){
        return this._opId++
    }

    authorized(){
        return new Promise((resolve,reject)=>{
            if(this.authed){
                return resolve()
            }

            this.once('open', resolve)
            this.once('close', reject)
        }).then(()=>{
            return this
        })
    }

    close(){
        debug('Client closing connection')
        this.socket.close()
    }

    onclose(){
        this.authed = false
        this.connected = false
        debug('Server closed connection')
        this.emit('close')
    }

    onopen(){
        this.authed = false
        this.connected = true
        debug('socket open!')

        let op = new AuthOp(this)

        op.run().then((status)=>{
            debug(status)
            debug('authed')
            //this.aesOffer = op.offer
            this.aesStream = op.stream
            this.authed = true
            this.emit('open')
        }).catch(error=>{
            this.authed = false
            debug('auth error', error)
            this.emit('close')
        })
    }

    async decrypt(reply, sender){
      if(this.aesStream){
        debug('decrypting quantum aes')

        const contentBSON = await this.aesStream.decrypt( reply.data )
        const content = Routines.BSON.parseObject(new Routines.BSON.BaseParser( contentBSON ))

        return content

      } else {
        debug('decrypting classic')
        const replyObj = JSON.parse(reply.data)
  
        if(replyObj.enc && replyObj.sig){
          let msg = new Message(replyObj)
  
          let content = await msg.decrypt(this.party.privateIdentity())
        
          const senderPub = Routines.extractPublicKeys(msg.enc)
          debug('sender', sender, '\tdiscover', this.discoverRemoteIdentity)
          if(this.discoverRemoteIdentity && !sender){
              debug('discovered remote identity', senderPub)
              this.remoteIdentity = {
                  key: {
                      public: senderPub
                  }
              }
              sender = this.remoteIdentity
          }
          debug(`sender from - ${msg.from}`)
          debug(`senderPub - ${senderPub}`)
  
          if(senderPub.box != sender.key.public.box || senderPub.sign != sender.key.public.sign){
            throw new Error('TRUST - reply is not from expected remote')
          }
  
          debug('decrypted data')
          return content
        }
      }

    }

    onmessage(message){
        debug('onmessage', message)
        let comm = this
        this.decrypt(message, this.remoteIdentity).then(msg=>{
            debug('decrypted msg = ', msg)
            debug(msg.id)

            if(msg.op != 'publish'){
                debug('emit id', msg.id)
                comm.emit(msg.id, msg)
            } else {
                debug('emit message')
                comm.emit('message', msg)
            }
        })
    }

    async send(input){
      debug('send - ', typeof input, input)

      if(typeof input != 'object'){
        input = JSON.parse(input)
      }

      let content = null

      if(this.aesStream){
        debug('sending quantum aes')
        const contentBSON = Routines.BSON.serializeBSONWithoutOptimiser( input )
        content = await this.aesStream.encrypt( contentBSON )
      } else {

        debug('sending classic')
        const msg = new Message({msg: input})
        await msg.encrypt(this.party._identity, this.remoteIdentity.key)
        content = JSON.stringify(msg)
      }

      await this.socket.send(content)
    }

    get ros(){
      if(!this._ros){
          this._ros = new RosShim(this)
          this._ros.connect()
      }

      return this._ros
    }
}

module.exports = ISocketComms