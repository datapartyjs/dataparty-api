'use strict'

const debug = require('debug')('dataparty.comms.ble-op')
const EventEmitter = require('eventemitter3')

class BLEOp extends EventEmitter {
  constructor(request, ble){
    super()
    this.request = request
    this.response = undefined

    this.ble = ble

    this.bleRequest = undefined
    this.bleResponse = undefined

    this.timeout = false
    this.startTime = Date.now()
    this.endTime = undefined
    this.lastActivity = Date.now()

  }

  async run(){

    if (!this.bleRequest){
      this.bleRequest = await this.ble.send(this.request)
      this.startTime = Date.now()
      this.lastActivity = Date.now()
    }

    this.ble.on('message:' + this.bleRequest.commandSeq, this.onMessage.bind(this))

    return new Promise((resolve, reject) => {
      this.once('done', () => {
        resolve(this.response)
      })
    })
  }

  onMessage(msg){
    debug('onMessage')
    if (msg.seq !== this.bleRequest.seq){ debug('onMessage - seq mismatch'); return }

    debug('onMessage - done')

    this.bleResponse = msg
    this.response = JSON.parse(msg.text)
    this.endTime = Date.now()
    this.lastActivity = Date.now()
    this.emit('done', this)

    debug(this)
  }
}

module.exports = BLEOp
