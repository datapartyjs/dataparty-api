'use strict'

const debug = require('debug')('dataparty.comms.websocketcomms')
const W3CWebSocket = require('websocket').w3cwebsocket;
const WebSocket = W3CWebSocket

const SocketComms = require('./socket-comms')

class WebsocketComms extends SocketComms {
    constructor({session, uri, identity, remoteIdentity}){
        super({session, uri, identity, remoteIdentity})

        this.socket = new WebSocket(this.uri)
        this.socket.onclose = this.onclose.bind(this)
        this.socket.onopen = this.onopen.bind(this)
        this.socket.onmessage = this.onmessage.bind(this)
    }
}

module.exports = WebsocketComms