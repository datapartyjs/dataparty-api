'use strict'

const debug = require('debug')('dataparty.party.qb')
const EventEmitter = require("eventemitter3")

const uuidv4 = require('uuid/v4')

const Clerk = require('./clerk.js')
const Crufl = require('./crufl')

// qb (query backend / queen bee / quarterback -> the leader of the party)
// handles backend communication to data-bouncer server
// * caches msguments locally to save bandwidth
//
// // crufl defines a single backend op on a single data collection (type)
// crufl = {
//   op: 'op', // crufl -> create | remove | update | find | lookup
//   uuid: '..', // unique random (uuid v4 -> random) id for this check op
//   type: '..', // message collection to check
//   spec: { .. }, // query spec for find
//   msgs: [msg0 .. msgN], // msg list for c | r | u | l
// }
//
// // claim holds reject & resolve / observer callback handlers to resolve
// // check after reply is received
// claim = {
//   op: 'op', // find | lookup | update | create | remove
//   uuid: '..', // uuid to match claim with check reply
//   fresh: Date.now() // timestamp to track resolution latency
//   resolve: handler, // resolve handler to call on op success
//   reject: handler, // reject handler to call on op failure / error
//   observer: handler // observer handler to watch for state changes
//   spec: { .. }, // keep copy of spec to resolve query locally
//   msgs: [msg0 .. msgN], // lookup keeps msg headers
// }
//
// // result of crufl has list of msgs
// // * lookup returns msgs with params, others just msg metadata
// // * msgs removed from backend have version set to -1
// result = {
//   op: 'op', // find | lookup | update | create | remove
//   uuid: '..', // uuid of crufl this is result for
//   type: '..', // collection result msgs belong to
//   msgs: [msg0 .. msgN], // db misses indicated with null msg
//   complete: boolean, // flag to indicate whether all msgs are included
//   error: ErrorObject //  string or detailed error object
// }
//
// // check calls are debounced & bundled into a single ask
// // * wrapped in dataparty-crypto message to secure backend comms
// ask = {
//   uuid: '..', // unique random id for this ask
//   crufls: [crufl0 .. cruflN], // array of crufl requests
// }
//
// // reply is returned by data-bouncer endpoint with array of check results
// // * if reply is incomplete it is responsibility of qb to resend
// //   checks that didnt receive results
// reply = {
//   uuid: '..', // id of ask this is reply to
//   results: [result0 .. resultN], // results for checks
//   complete: boolean, // flag to indicate whether all results are included
// }


module.exports = class Qb extends EventEmitter {
  constructor({call, cache, debounce=10, timeout=3000, find_dedup=true}){

    super()
    
    this.call = call
    this.cache = cache

    this.debounce = debounce
    this.timeout = timeout
    this.find_dedup = find_dedup

    this.crufls = {}

    this.find_map = {}

    this.send_queue = []
    this.send_timer = null
    this.send_timer_created = null
  }

  async find(spec){
    debug('find -', JSON.stringify(spec,null,2))

    // if no ids given aggregate find check into ask call
    if (!('id' in spec || 'ids' in spec)) {
      debug('find -> has no id or ids')

      const crufl = new Crufl({ op: 'find', spec, qb: this, timeout:this.timeout})
      const reply = await this.queueRequest(crufl)

      return reply

    // otherwise build lookup for given ids
    } else {
      debug('find -> has ids', spec)
      const ids = 'id' in spec ? [spec.id] : spec.ids
      const msgs = ids.map(id => Clerk.partyize(spec.type, id+''))

      const crufl = new Crufl({ op: 'lookup', msgs, qb: this, timeout:this.timeout})
      const reply = await this.queueRequest(crufl)

      return reply
    }

  }

  async create(type, msgs){
    debug('create - ', type, JSON.stringify(msgs,null,2))

    // shallow copy given msgs & insert metadata props
    const partyMsgs = msgs.map(msg => Clerk.partyize(type, msg))

    return await this.modify(partyMsgs, 'create')
  }

  async modify(msgs, op){
    debug('modify - ', op, JSON.stringify(msgs,null,2))

    const crufl = new Crufl({ op, msgs, qb: this, timeout:this.timeout})

    return await this.queueRequest(crufl)
  }

  async lookup(msgs, skipCache){
    debug('lookup - ', JSON.stringify(msgs,null,2))

    if(!msgs || msgs.length<1){
      return []
    }

    const crufl = new Crufl({ op:'lookup', msgs, qb: this, timeout:this.timeout})

    return await this.queueRequest(crufl, skipCache)
  }

  async waitForCruflComplete(crufl){
    return await new Promise((resolve,reject)=>{

      crufl.once('complete', ()=>{
        debug('crufl completed in',crufl.duration,'ms', crufl.request, crufl.result)

        if(crufl.op == 'find' && this.find_dedup){
          delete this.find_map[ crufl.specHash ]
        }

        if(crufl.errors != false){ reject(crufl) }
        else { resolve(crufl.result.msgs) }

        delete this.crufls[crufl.uuid]
      })
    })
  }

  async queueRequest(crufl, skipCache=false){

    if(this.cache && !skipCache && crufl.op == 'lookup'){
      //attempt cache retrieval
      debug('queueRequest - attempt cache lookup')

      // check for msgs in cache
      const populated = await this.cache.populate(crufl.msgs)

      // if there were no misses resolve with hits
      if (populated.misses.length === 0) {

        debug('queueRequest - completed from cache')

        crufl.clearTimeout()

        // if selection was specified resolve selection
        if (crufl.spec && crufl.spec.select) {
          return Clerk.selectAll(crufl.spec.select, populated.hits)
        } else {
          return populated.hits
        }

      } else if( populated.misses.length > 0 && populated.hits.length > 0) {
        // otherwise keep original msg headers & initiate ask for misses

        debug('queueRequest - has partial result from cache')

        let missingMsgs = await this.lookup(populated.misses, true)

        debug('queueRequest - completed partially from cache')
        crufl.clearTimeout()

        return [...populated.hits, ...missingMsgs]
      }
    }


    if(this.find_dedup && crufl.op == 'find'){
      let pendingCrufl = this.find_map[ crufl.specHash ]

      if(!pendingCrufl){
        this.find_map[ crufl.specHash ] = crufl
      } else {
        debug('deduping find op - waiting for pending crufl', pendingCrufl.uuid)
        crufl.clearTimeout()
        return await this.waitForCruflComplete(pendingCrufl)
      }
    }

    this.crufls[crufl.uuid] = crufl

    
    let resultPromise = this.waitForCruflComplete(crufl)

    if(this.debounce === false || this.debounce < 1){
      await this.sendRequests([crufl])
    }
    else{
      this.send_queue.push(crufl)

      if(!this.send_timer){
        this.send_timer = setTimeout(async ()=>{ await this.onSendTimer() }, this.debounce)
      }
    }

    return await resultPromise
  }

  async onSendTimer(){

    const crufls = this.send_queue

    this.send_queue = []
    delete this.send_timer
    this.send_timer = null

    await this.sendRequests(crufls)
  }

  async sendRequests(crufls){

    if(crufls.length < 1){ return }

    const request = {
      uuid: uuidv4(), crufls: crufls.map(c=>c.request)
    }

    debug('doRequest -', JSON.stringify(request,null,2))

    const reply = await this.call(request)

    await this.onReply(reply)
  }

  async onReply(reply){
    debug('onReply - ', reply)

    let resultPromises = []

    for(let result of reply.results){
      let promise = this.onResult(result)
      resultPromises.push(promise)
    }

    await Promise.all(resultPromises)
  }

  async onResult(result){
    debug('onResult', result)


    let crufl = this.crufls[result.uuid]

    if(crufl !== undefined){
      await crufl.onResult(result)

      delete this.crufls[result.uuid]
    }
  }
}