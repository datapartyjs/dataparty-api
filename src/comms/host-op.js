const Hoek = require('@hapi/hoek')
const debug = require('debug')('dataparty.op.host-op')
const moment = require('moment')
const EventEmitter = require('eventemitter3')

const OP_STATUS_LEVEL = {
  Status_Undefined: 'Status_Undefined',
  Status_None: 'Status_None',
  Status_Error: 'Status_Error',
  Status_Warning: 'Status_Warning',
  Status_Info: 'Status_Info',
  Status_Debug: 'Status_Debug'
}


const OP_STATES = {
  Pending: 'Pending',
  Starting: 'Starting',
  Running: 'Running',
  Finished_Success: 'Finished_Success',
  Finished_Fail: 'Finished_Fail',
  Finished_Permission_Denied: 'Finished_Permission_Denied',
  Finished_Invalid_Op: 'Finished_Invalid_Op',
  Finished_Invalid_Id: 'Finished_Invalid_Id',
  Finished_Buffer_Full: 'Finished_Buffer_Full'
}

class Op extends EventEmitter {
  constructor({msg, input}){
    super()
    this.msg = msg      //! original encrypted message
    this.input = input  //! parsed and validated input
    this.start = Date.now()
    this.end = undefined
    this.state = Op.STATES.Pending
    this.level = Op.STATUS_LEVELS.Status_Info
  }

  get op(){
    return Hoek.reach(this.input, 'op')
  }

  get id(){
    return Hoek.reach(this.input, 'id')
  }


  static get STATES(){
    return OP_STATES
  }

  static get STATUS_LEVELS(){
    return OP_STATUS_LEVEL
  }

  setState(state, level, message){

    this.state = state

    const status = {
      op: 'status',
      id: this.id,
      state: this.state,
      level: level || Op.STATUS_LEVELS.Status_Info,
      msg: message || undefined,
      timestamp: Date.now(),
      stats: {
        start: this.start,
        end: this.end,
        duration_ms: this.end - this.start
      }
    }

    if(this.state == Op.STATES.Finished_Success ||
      this.state == Op.STATES.Finished_Fail ||
      this.state == Op.STATES.Finished_Invalid_Op ||
      this.state == Op.STATES.Finished_Invalid_Id ||
      this.state == Op.STATES.Finished_Permission_Denied ||
      this.state == Op.STATES.Finished_Buffer_Full)
    {
      debug('set end time')
      this.end = Date.now()
      this.emit('finished', true)
    }
    else{
      this.emit('finished', false)
      this.emit('status', status)
    }
  }

  setOpStatusLevel(level){
    this.level = level
  }

  setStatus(level, message){
    this.emit('status', )
  }

}

module.exports = Op
