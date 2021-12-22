const RestComms = require('./rest-comms')
const SocketComms = require('./socket-comms')
const WebsocketComms = require('./websocket-comms')
const SocketOp = require('./socket-comms')
const WebsocketOp = require('./websocket-op')
const BLEMessage = require('./ble/BLEMessage')
const BLEOp = require('./ble/BLEOp')
const AuthOp = require('./op/auth-op')
const AuthError = require('../errors/auth-error')

module.exports = {
  RestComms, SocketComms,
  WebsocketComms, 
  SocketOp, WebsocketOp, BLEMessage, BLEOp,
  AuthOp, AuthError
}