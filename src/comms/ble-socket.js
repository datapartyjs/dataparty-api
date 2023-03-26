'use strict'

const debug = require('debug')('dataparty.comms.ble-peer')
const EventEmitter = require('eventemitter3')

const BLEMessage = require('./ble/BLEMessage')
const BLEOp = require('./ble/BLEOp')
// const bluetooth = (navigator) navigator.bluetooth

/**
 * A simple BLE socket
 * ⚠️ Warning: This class maybe significantly refactored in future releases
 * 
 * @class module:Comms.BLEPeerClient
 * @extends EventEmitter
 * @link module:Comms
 * @see https://webbluetoothcg.github.io/web-bluetooth
 * @param {BleDevice} bleDevice A connected BLE device. See BLEPeerClient.requestDevice()
 */

class BLEPeerClient extends EventEmitter {
  constructor(bleDevice){
    super()
    this.autoReconnect = true
    this.reconnectFails = 0
    this.reconnectDelay = 500
    this.reconnectMaxTries = 5
    this.reconnectTimer = undefined

    this.rxBuffer = {} // indexed on command sequence -> Message

    /* */
    this.bleDevice = bleDevice
    this.info = undefined

    this.characteristics = {
      owner: undefined,
      actor: undefined,
      tx: undefined,
      rx: undefined
    }

    this.bleDevice.addEventListener('gattserverdisconnected', this.handleGATTDisconnected.bind(this))
  }

  static get MTU(){ return 20 }
  static get DATAPARTY_SERVICE_UUID(){ return 0x31337 }
  static get OWNER_ID_CHARACTERISTIC_UUID(){ return BluetoothUUID.getCharacteristic('00000001-abcd-42d0-bc79-df8168b55f04') }
  static get ACTOR_ID_CHARACTERISTIC_UUID(){ return BluetoothUUID.getCharacteristic('00000002-abcd-42d0-bc79-df8168b55f04') }
  static get RX_CHARACTERISTIC_UUID(){ return BluetoothUUID.getCharacteristic('00000003-abcd-42d0-bc79-df8168b55f04') }
  static get TX_CHARACTERISTIC_UUID(){ return BluetoothUUID.getCharacteristic('00000004-abcd-42d0-bc79-df8168b55f04') }

  static buf2hex(buffer){
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('')
  }

  static parseActor(data){
    const dataArr = new Uint8Array(data.buffer)
    const actorTypeId = parseInt(dataArr.slice(0, 2))
    const idStr = BLEPeerClient.buf2hex(dataArr.slice(1, dataArr.length))

    const ACTORS = [undefined, 'user', 'team', 'org', 'device', 'app']

    return {
      type: ACTORS[actorTypeId] || undefined,
      id: idStr
    }
  }

  handleGATTDisconnected(){
    debug('GATT disconnected', new Date())

    if (this.autoReconnect){
      this.resume()
    }
  }

  async resume(){

    debug('resuming', new Date())
    return new Promise((resolve, reject) => {
      this.start()
        .then(resolve)
        .catch((err) => {
          this.reconnectFails += 1

          if (this.reconnectFails >= this.reconnectMaxTries){
            debug('max-reconnect', err)
            return reject(new Error('max-reconnect'))
          }

          const delay = this.reconnectDelay * Math.pow(2, this.reconnectFails)
          debug('start failed (error,', err, ') retying in', delay, 'ms')

          this.reconnectTimer = setTimeout(() => {
            this.resume().then(resolve).catch(reject)
          }, delay)
        })

    })
  }

  onRx(event){
    debug('onRx', event.target.value.buffer)

    debug('raw value', event.target.value)
    const input = new Uint8Array(event.target.value.buffer)

    debug('input', input)

    const header = BLEMessage.parseHeader(input)

    let buffer = this.rxBuffer[ header.seq ]
    if (!buffer){

      buffer = BLEMessage.fromPacket(input)
      this.rxBuffer[ header.seq ] = buffer

    } else {

      buffer.parsePacket(input)

    }

    if (buffer.rxComplete){
      debug('onRx complete ', header.seq)
      debug('buffer', buffer)
      this.emit('message', buffer)
      this.emit('message:' + header.seq, buffer)
    }

  }

  async transmit(arr){
    return this.characteristics.tx.writeValue(arr)
  }

  async send(obj){
    debug('sending', obj)
    const msg = new BLEMessage({msg: obj})

    debug(msg)

    const packets = []

    for (let i = 0; i < msg.packetCount; i++){
      await this.transmit(msg.getPacket(i))
    }
    return msg
  }

  async run(obj){
    const op = new BLEOp(obj, this)

    return op.run().then(response => {
      debug('op got respone')
      return response
    })
  }

  async start(autoreconnect = true){
    this.autoReconnect = autoreconnect

    try {
      await this.bleDevice.gatt.connect()

      if (!this.bleDevice.gatt.connected){
        debug('warning GATT not connected')
      }

      debug('GATT connected', new Date())
      const primaryService = await this.bleDevice.gatt.getPrimaryService(BLEPeerClient.DATAPARTY_SERVICE_UUID)

      const primaryCharacteristics = await primaryService.getCharacteristics()
      debug('PRIMARY SERVICE', primaryCharacteristics.length, primaryCharacteristics)

      debug('\t found primary service')
      this.characteristics.owner = await primaryService.getCharacteristic(BLEPeerClient.OWNER_ID_CHARACTERISTIC_UUID)
      debug('\t found owner', this.characteristics.owner)

      this.characteristics.actor = await primaryService.getCharacteristic(BLEPeerClient.ACTOR_ID_CHARACTERISTIC_UUID)
      debug('\t found actor')

      this.characteristics.tx = await primaryService.getCharacteristic(BLEPeerClient.TX_CHARACTERISTIC_UUID)
      debug('\t found tx')

      this.characteristics.rx = await primaryService.getCharacteristic(BLEPeerClient.RX_CHARACTERISTIC_UUID)
      debug('\t found rx')

      this.characteristics.rx.addEventListener('characteristicvaluechanged', this.onRx.bind(this))
      this.characteristics.rx.startNotifications()
      debug('\t started rx notifications')

      const owner = await this.characteristics.owner.readValue()
      debug('\t read owner')

      const actor = await this.characteristics.actor.readValue()
      debug('\t read actor')

      // let decoder = new TextDecoder('utf-8')

      this.info = {
        owner: BLEPeerClient.parseActor(owner),
        actor: BLEPeerClient.parseActor(actor)
      }

      debug(this.info)
      this.reconnectFails = 0
      return this
    } catch (error){
      debug('exception in bluetooth :(', error)
      debug(error)
      debug(error.stack)
      if(this.reconnectFails == 0){
        return this.resume()
      }
      return Promise.reject(error)
    }
  }

  stop(){
    this.autoReconnect = false

    if (!this.bleDevice.gatt.connected){
      debug('gatt already disconnected')
      return
    }

    debug('disconnecting gatt')
    this.bleDevice.gatt.disconnect()
  }

  static requestDevice(shortId){

    const filters = []

    if (!shortId){

      filters.push({
        services: [BLEPeerClient.DATAPARTY_SERVICE_UUID],
        namePrefix: 'DataParty'
      })

    } else {

      filters.push({
        services: [BLEPeerClient.DATAPARTY_SERVICE_UUID],
        name: 'DataParty-' + shortId
      })

    }

    return navigator.bluetooth.requestDevice({ filters: filters }).then(device => {
      debug('requested device')
      debug(device)
      return new BLEPeerClient(device)
    })
  }
}

module.exports = BLEPeerClient
