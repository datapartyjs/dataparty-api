const debug = require('debug')('dataparty.comms.ros-shim')
const ROSLIB = require('roslib')

class RosShim extends ROSLIB.Ros {
    constructor(socket){
        super()
        this.socket = socket

        this.socket.once('close', ()=>{
            debug('roshim close')
            this.emit('close')
            this.isConnected = false
        })

        this.socket.on('message', this.handleMessage.bind(this))

        debug('roshim')

        this.isConnected = true
        this.emit('connection', {})
    }

    connect(){
        debug('roshim - connect')
    }


    handleMessage(message) {

        if (message.op === 'publish') {
          debug('publish op')
          this.emit(message.topic, message.msg);
        } /*else if (message.op === 'service_response') {
          this.emit(message.id, message);
        } else if (message.op === 'call_service') {
            this.emit(message.service, message);
        }*/ else if(message.op === 'status'){


          if(message.id){
            this.emit('status:'+message.id, message);
          } else {
            this.emit('status', message);
          }
        }
      }
}

module.exports = RosShim