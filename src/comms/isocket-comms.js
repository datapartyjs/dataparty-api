'use strict'

const debug = require('debug')('dataparty.comms.socketcomms')
const EventEmitter = require('eventemitter3')

const {Message, Routines} = require('@dataparty/crypto')

const AuthOp = require('./op/auth-op')
const RosShim = require('./ros-shim')
const IParty = require('../party/iparty')


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
            this.emit('open')
            this.authed = true
        }).catch(error=>{
            this.authed = false
            debug('auth error', error)
            this.emit('close')
        })
    }

    decrypt(reply, sender){
        const replyObj = JSON.parse(reply.data)
        let dataPromise = new Promise((resolve, reject)=>{
            if(replyObj.enc && replyObj.sig){
              let msg = new Message(replyObj)
      
              return resolve(msg.decrypt(this.party._identity).then(content=>{
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
                debug(`senderPub - ${senderPub}`)
      
                if(senderPub.box != sender.key.public.box || senderPub.sign != sender.key.public.sign){
                  return Promise.reject('TRUST - reply is not from expected remote')
                }

                debug('decrypted data')
                return content
              }))
            }
      
            reject( Promise.reject('TRUST - reply is not encrypted') )
          })
      
        return dataPromise
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

    send(input){
        debug('send - ', typeof input, input)

        if(typeof input != 'object'){
            input = JSON.parse(input)
        }

        const content = new Message({msg: input})

        return content.encrypt(this.party._identity, this.remoteIdentity.key)
            .then(JSON.stringify)
            .then(this.socket.send.bind(this.socket))

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