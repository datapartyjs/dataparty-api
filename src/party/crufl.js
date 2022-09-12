'use strict'

const debug = require('debug')('dataparty.party.crufl')
const EventEmitter = require("last-eventemitter")

const moment = require('moment')

const uuidv4 = require('uuid/v4') // random uuid generator
const Clerk = require('./clerk.js')
const reach = require('../utils/reach')
const Hashes = require('jshashes')
const { takeWhile } = require('lodash')
const MD5 = new Hashes.MD5

module.exports = class Crufl extends EventEmitter {
  constructor({op, spec, msgs, qb, timeout}){
    super()

    this.cache = qb.cache
    this.lookup = qb.lookup.bind(qb)
 
    this.request
    
    this.op = op
    this.type = null
    this.spec = spec
    this.msgs = msgs
    this.uuid = uuidv4()
    this.specHash = this.spec !== undefined ? MD5.hex(JSON.stringify(this.spec)) : undefined

    this.errors = false
    this.result = null
    this.timeout = null
    this.timeoutTimer = (!timeout) ? undefined : setTimeout(this.onTimeout.bind(this), timeout)

    this.startTime = moment()
    this.endTime = null

    if (this.spec !== undefined && this.msgs !== undefined) {
      throw new Error('crufl can not have both spec and msgs')

    } else if (this.spec !== undefined) {

      debug('crufl('+this.op+') - created from spec')
      this.type = spec.type
      if (!(typeof this.type === 'string' && this.type.length > 0)) {
        debug(spec)
        throw (new Error('crufl with no spec type!\n'+JSON.stringify(spec,null,2)))
      }


    } else if (this.msgs !== undefined) {

      debug('crufl('+this.op+') - created from msgs')
      // validate msgs share a type
      const [type, typedMsgs] = Clerk.validateOneType(msgs)
      if (type === null) {
        throw (new Error('crufl with no consistent type!\n'+JSON.stringify(spec,null,2)))
      }

      this.type = type
      this.msgs = typedMsgs
    }
  }

  get duration(){

    if(this.endTime){ return this.endTime.diff(this.startTime, 'ms') }

    return moment().diff(this.startTime, 'ms')
  }

  clearTimeout(){
    if(this.timeoutTimer !== null ){
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
      this.timeout = false
    }
  }

  async onResult(result){
    debug('onResult', result)

    if(this.timeout == true){
      throw new Error('result after timeout - '+this.uuid)
    }

    this.result = result
    this.clearTimeout()

    try{
      if(this.result.op != this.op){ throw new Error('result op does not match request') }

      switch(this.result.op){
        case 'find':
          if (!this.result.msgs || this.result.msgs.length < 1) {
            this.result.msgs = []
            break
          }
  
          debug('lookup needed', this.result)
  
          let msgs = await this.lookup(this.result.msgs)
  
          this.result.msgs = msgs
          break
        case 'lookup':
          if(this.cache){ this.cache.insert(this.result.msgs) }
    
          this.errors = this.anyErrors(this.result.msgs)
          if(this.errors != false){ break }
    
          await this.lookup(filterInvalid(claim.msgs, result.msgs), claim)
          break
        case 'update':
        case 'create':
        case 'remove':
          if(this.cache){ this.cache.insert(this.result.msgs) }
    
          this.errors = this.anyErrors(this.result.msgs)
          if(this.errors != false){ break }
    
          break
    
      default:
        throw new Error(`unsupported result op: ${result.op}`)
      }
  
    }
    catch(err){
      if(!this.errors){ this.errors = err }
    }
    
    
    this.endTime = moment()

    this.emit('complete')
  }

  onTimeout(){
    debug('onTimeout')

    this.timeout = true
    this.timeoutTimer = null
    this.endTime = moment()

    this.errors = new Error('crufl timeout')
    
    this.emit('complete')
  }

  get request(){
    return {
      op: this.op,
      uuid: this.uuid,
      type: this.type,
      msgs: this.msgs,
      spec: this.spec,
      specHash: this.specHash
    }
  }

  anyErrors(msgs) {

    let errors = undefined
  
    for (const msg of msgs) {
      if (msg.$meta.error) {
        if(!errors){errors={}}
        let errArr = errors[msg.$meta.error]
  
        if(!errArr){ errArr = errors[msg.$meta.error] = [] }
  
        errArr.push(msg.$meta.id)
      }
    }
  
  
    if(errors){
      let e = new Error( Object.keys(errors)[0] )
      let details = {
        errors: errors,
        crufl: this
      }
      e.name = Object.keys(errors)[0]
      e.message = JSON.stringify(details, null, 2)
      return e
    }
  
    return false
  }

  // give up on messages that the backend flags as invalid
  filterInvalid(reqMsgs, resMsgs) {
    const idmap = {}
    for (const msg of reqMsgs) {
      idmap[msg._id] = msg
    }
    for (const msg of resMsgs) {
      if (msg.$meta.error) {
        delete idmap[msg._id]
      }
    }
    return Object.values(idmap)
  }
  
}



