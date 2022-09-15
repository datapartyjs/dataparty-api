'use strict'

const debug = require('debug')('dataparty.op.socket-op')
const EventEmitter = require('eventemitter3')

class SocketOp extends EventEmitter {
    constructor(op, data, socket){
        super()
        this.op = op
        this.id = this.op+':'+socket.opId
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

        const obj = Object.assign({}, {
            op: this.op,
            id: this.id,
            session: this.socket.session
        }, this.data)

        debug('sending op ' + this.id)
        this._thenPromise = new Promise((resolve, reject)=>{
            this.socket.send(obj)
                .then(()=>{
                    this._thenResolve = resolve
                    this._thenReject = reject
                })
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

            if(event.op != 'status'){
                debug('not a status message')
                return
            }

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

module.exports = SocketOp