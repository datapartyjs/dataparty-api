const RestComms = require('./rest-comms')
const ISocketComms = require('./isocket-comms')
const PeerComms = require('./peer-comms')
const WebsocketComms = require('./websocket-comms')
const SocketOp = require('./isocket-comms')
const WebsocketOp = require('./websocket-op')
const BLEMessage = require('./ble/BLEMessage')
const BLEOp = require('./ble/BLEOp')
const AuthOp = require('./op/auth-op')
const AuthError = require('../errors/auth-error')

const LoopbackComms = require('./loopback-comms')
const RTCSocketComms = require('./rtc-socket-comms')
const LoopbackChannel = require('./loopback-channel')

module.exports = {
  RestComms, ISocketComms,
  PeerComms, LoopbackComms, LoopbackChannel, RTCSocketComms,
  WebsocketComms, 
  SocketOp, WebsocketOp, BLEMessage, BLEOp,
  AuthOp, AuthError
}