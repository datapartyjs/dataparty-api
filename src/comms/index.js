const BLEMessage = require('./ble/BLEMessage')
const BLEOp = require('./ble/BLEOp')
const AuthOp = require('./op/auth-op')
const AuthError = require('../errors/auth-error')

const RestComms = require('./rest-comms')
const SocketComms = require('./socket-comms')

const LoopbackComms = require('./loopback-comms')
const LoopbackChannel = require('./loopback-channel')

const PeerComms = require('./peer-comms')
const WebsocketComms = require('./websocket-comms')
const RTCSocketComms = require('./rtc-socket-comms')
const I2pSocketComms = require('./i2p-socket-comms')

const SocketOp = require('./socket-comms')
const WebsocketOp = require('./websocket-op')



module.exports = {
  RestComms, SocketComms, PeerComms, 
  LoopbackComms, LoopbackChannel,
  WebsocketComms, RTCSocketComms, I2pSocketComms,
  SocketOp, WebsocketOp, BLEMessage, BLEOp,
  AuthOp, AuthError
}