
/**
 *  @module Comms 
 */
exports.BLEMessage = require('./ble/BLEMessage')
exports.BLEOp = require('./ble/BLEOp')
exports.AuthOp = require('./op/auth-op')
exports.AuthError = require('../errors/auth-error')
exports.RestComms = require('./rest-comms')
exports.ISocketComms = require('./isocket-comms')
exports.LoopbackComms = require('./loopback-comms')
exports.LoopbackChannel = require('./loopback-channel')
exports.LoopbackChannelPort = require('./loopback-channel-port')
exports.PeerComms = require('./peer-comms')
exports.WebsocketComms = require('./websocket-comms')
exports.RTCSocketComms = require('./rtc-socket-comms')
exports.I2pSocketComms = require('./i2p-socket-comms')
exports.SocketOp = require('./isocket-comms')
exports.WebsocketOp = require('./websocket-op')