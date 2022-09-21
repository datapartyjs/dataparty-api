'use strict'

const debug = require('debug')('dataparty.comms.websocket-op')
const EventEmitter = require('eventemitter3')

class WebsocketOp extends EventEmitter {
    constructor(op, data, socket){
        super()
        this.op = op
        this.id = this.op+':'+socket.opId++
        this.data = data
        this.socket = socket

        this._thenPromise = undefined
        this._thenResolve = undefined
        this._thenReject = undefined

        this.socket.on(this.id, this.handleOpEvent.bind(this))
    }

    run(){
        if(this._thenPromise){
            return this._thenPromise
        }

        this._thenPromise = new Promise((resolve, reject)=>{
            this.socket.encrypt(this)
                .then(JSON.stringify)
                .then((jsonStr)=>{
                    debug('stringed content')
                    debug('sending op ' + this.id)
                    this._thenResolve = resolve
                    this._thenReject = reject
                    return jsonStr
                })
                .then(this.socket.socket.send.bind(this.socket.socket))
                .catch(error=>{
                    this._thenPromise = undefined
                    this._thenResolve = undefined
                    this._thenReject = undefined
                    reject(error)
                })
        })

        return this._thenPromise
    }

    handleOpEvent(event){
        debug('handleOpEvent()')
        debug(event)
        if(this._thenResolve != undefined){
            debug(event.state.indexOf('Finished'))
            if(event.state.indexOf('Finished') != -1){
                if(event.state == 'Finished_Success'){
                    debug('success')
                    this.emit('success', event)
                    this._thenResolve(event)
                    this._thenPromise = undefined
                    this._thenResolve = undefined
                    this._thenReject = undefined
                }
                else{
                    debug('failure')
                    this.emit('failure', event)
                    this._thenReject(event)
                    this._thenPromise = undefined
                    this._thenResolve = undefined
                    this._thenReject = undefined
                }
            } else {
                debug('status update')
                this.emit('status', event)
            }
        }
    }
}

module.exports = WebsocketOp