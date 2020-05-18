'use strict'

const debug = require('debug')('dataparty.cloud.qb')
const uuidv4 = require('uuid/v4') // random uuid generator
const Clerk = require('./clerk.js')
const reach = require('../../utils/reach')
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
module.exports = class CloudQb {

  constructor ({ call, cache, debounce }) {

    this.call = call // function to call data bouncer backend
    this.cache = cache // cache with insert / populate interface

    this.claimTable = {} // claims indexed by uuid
    this.claimTimeout = 9000 // reject claims with no results within limit
    this.checkStack = [] // collects debounced check requests
    this.checkTimeout = undefined // for pending ask
    this.debounce = debounce | 10 // ms to wait before asking backend
  }

  // async call to resolve query spec thru backend server & local cache
  async find (spec) {

    const type = spec.type
    if (!(typeof type === 'string' && type.length > 0)) {
      debug(spec)
      throw (new Error('outside cant process query without type!\n'+JSON.stringify(spec,null,2)))
    }

    return new Promise((resolve, reject) => {


      const type = spec.type
      if (!(typeof type === 'string' && type.length > 0)) {
        debug(spec)
        throw (new Error('cant process query without type!\n'+JSON.stringify(spec,null,2)))
      }

      // build bouncer check object
      const check = {
        op: 'find',
        uuid: uuidv4(),
        type: type,
        spec: spec // query spec to execute
      }

      // keep resolve / reject handlers & spec in claim
      const claim = {
        op: check.op,
        uuid: check.uuid,
        fresh: Date.now(),
        resolve: resolve,
        reject: reject,
        spec: spec,
        entryStack: undefined
      }

      if(debug.enabled){
        claim.entryStack = {}
        Error.captureStackTrace( claim.entryStack )
      }

      // if no ids given aggregate find check into ask call
      if (!('id' in spec || 'ids' in spec)) {
        debug('find -> has no id or ids')
        this.pushCheck(check, claim)

      // otherwise build lookup for given ids
      } else {
        debug('find -> has ids')
        const ids = 'id' in spec ? [spec.id] : spec.ids
        const msgs = ids.map(id => Clerk.partyize(type, id))
        this.lookup(msgs, claim)
      }
    })
  }

  // insert list of objects into given db collection
  create (type, msgs) {

    // shallow copy given msgs & insert metadata props
    const partyMsgs = msgs.map(msg => Clerk.partyize(type, msg))

    // return promise resolving to list of successfully inserted msgs
    return this.modify(partyMsgs, 'create')
  }

  // make async call to update | create | remove list of msgs
  modify (msgs, op) {
    return new Promise((resolve, reject) => {

      // validate msgs share a type
      const [type, typedMsgs] = Clerk.validateOneType(msgs)
      if (type === null) {
        return reject(new Error('cant modify msgs: no type set!'))
      }

      debug('modify -> ', op, msgs)

      // build bouncer check object
      const check = {
        op: op,
        uuid: uuidv4(),
        type: type,
        msgs: typedMsgs
      }

      // keep resolve / reject handlers in claim
      const claim = {
        op: check.op,
        uuid: check.uuid,
        fresh: Date.now(),
        resolve: resolve,
        reject: reject,
        spec: typedMsgs,
        entryStack: undefined
      }

      if(debug.enabled){
        claim.entryStack = {}
        Error.captureStackTrace( claim.entryStack )
      }

      // aggregate check into ask call
      this.pushCheck(check, claim)
    })
  }

  // attempt lookup of given msg metadata against local cache before
  // generating server check for cache misses
  // * called by find to populate msgs returned by search
  // * called by itself until timeout is reached to allow downloading partial
  //   msg listings & intercall cache invalidation
  lookup (msgs, parentClaim) {
    return new Promise((resolve, reject) => {

      debug('lookup', msgs)

      // if no messages given resolve to empty list
      if (msgs.length < 1) {
        resolve([])
      }

      // validate msgs share a type
      const [type, typedMsgs] = Clerk.validateOneType(msgs)
      if (type === null) {
        return reject(new Error('cant lookup msgs: no type set!'))
      }

      // build lookup check & claim
      const check = {
        op: 'lookup',
        uuid: uuidv4(),
        type: type,
        msgs: typedMsgs
      }
      const claim = {
        op: check.op,
        uuid: check.uuid,
        fresh: Date.now(),
        resolve: resolve,
        reject: reject,
        spec: typedMsgs,
        entryStack: undefined
      }

      if(debug.enabled){
        claim.entryStack = {}
        Error.captureStackTrace( claim.entryStack )
      }

      // if this lookup is following on another claim use its handlers instead
      if (parentClaim) {
        claim.resolve = parentClaim.resolve
        claim.reject = parentClaim.reject
        claim.fresh = parentClaim.fresh
        if (parentClaim.spec) {
          claim.spec = parentClaim.spec
        }
      }

      // check for msgs in cache
      this.cache.populate(typedMsgs)
        .then((populated) => {

          // debug('cache results: ' + JSON.stringify(populated, null, 2))

          // if there were no misses resolve with hits
          if (populated.misses.length === 0) {

            // if selection was specified resolve selection
            if (claim.spec && claim.spec.select) {
              claim.resolve(
                Clerk.selectAll(claim.spec.select, populated.hits))
            } else {
              claim.resolve(populated.hits)
            }

          // if claim is stale (from inherited stamp) call reject handler
          } else if (Date.now() - claim.fresh > this.claimTimeout) {
            claim.reject(
              new Error(`server timeout on lookup op: id ${claim.uuid}`))

          // otherwise keep original msg headers & initiate ask for misses
          } else {
            claim.msgs = typedMsgs
            check.msgs = populated.misses
            this.pushCheck(check, claim)
          }
        })
    })
  }

  // debounce server communication by aggregating check calls within a
  // time window into a single ask call
  // * check claim table for stale claims & reject them
  pushCheck (check, claim) {

    debug('pushing check onto stack:', check)

    // push check onto stack (other checks can be pushed in debounce window)
    this.checkStack.push(check)

    // add claim to claim table
    this.claimTable[claim.uuid] = claim

    // if check timeout isnt set start debounce window ask call
    if (this.checkTimeout) {
      debug('check timeout already set, waiting!')
    } else {
      debug(`setting ask timeout callback in ${this.debounce} ms`)
      this.checkTimeout = setTimeout(this.sendAsk.bind(this), this.debounce)
    }

    // reject stale claims
    const now = Date.now()
    for (const oldClaim of Object.values(this.claimTable)) {
      if (now - oldClaim.fresh > this.claimTimeout) {
        oldClaim.reject(
          new Error(`server timeout: op ${oldClaim.op} id ${oldClaim.uuid}`))
        delete this.claimTable[oldClaim.uuid]
      }
    }
  }

  // to be called asynchronously after debounce timeout to aggregate checks
  async sendAsk () {

    // package check stack into an ask
    const ask = {
      uuid: uuidv4(),
      crufls: this.checkStack
    }

    // init new checkstack & clear flag
    this.checkStack = []
    clearTimeout(this.checkTimeout) // should have already fired but make sure
    this.checkTimeout = undefined

    // if there are no checks in ask just return
    if (ask.crufls.length < 1) {
      return
    }

    try {
      const reply = await this.call(ask)

      // build check map to track whether results are complete
      const unclaimed = {}
      for (const check of ask.crufls) {
        unclaimed[check.uuid] = check
      }

      // process results for check claims
      for (const crufl of reply.freshness) {
        this.processClaim(crufl)
        delete this.claimTable[crufl.uuid]
        delete unclaimed[crufl.uuid]
      }

      this.recheck(unclaimed)

    } catch (error) {
      debug('ask error path ->', error)

      for (const crufl of ask.crufls) {

        const claim = this.claimTable[crufl.uuid]
        claim.reject(error)
        delete this.claimTable[claim.uuid]
      }

      debug('ask error handled')
    }
  }

  // push unclaimed checks back onto check stack unless stale
  recheck (unclaimed) {
    for (const check of Object.values(unclaimed)) {

      // get matching claim from claim table or else
      const claim = this.claimTable[check.uuid]
      if (claim === undefined) {
        throw new Error(
          `no claim for check op ${check.op} id ${check.uuid}`)
      }

      // if claim is stale call reject handler & delete from table
      if (Date.now() - claim.fresh > this.claimTimeout) {
        claim.reject(
          new Error(`server timeout after incomplete result: op ${claim.op}`))
        delete this.claimTable[claim.uuid]

      // otherwise put claim back on check stack & init ask
      } else {
        this.checkStack.push(check)
        if (!this.checkTimeout) {
          this.checkTimeout = setTimeout(this.sendAsk.bind(this), this.debounce)
        }
      }
    }
  }

  // process result from data bouncer server against stored claim
  async processClaim (result) {

    debug('processing claim for result ->', JSON.stringify(result))

    // find matching claim or else
    const claim = this.claimTable[result.uuid]
    if (claim === undefined) {
      throw new Error(`no claim for result op ${result.op} id ${result.uuid}`)
    }

    // if claim & result ops dont match reject claim
    if (result.op !== claim.op) {
      return claim.reject(
        new Error(`result op ${result.op} !== claim op ${claim.op}`))
    }

    // if result error is set reject with error
    if (result.error) {
      return claim.reject(new Error(result.error))
    }

    let errors
    // handle result according to operation
    switch (result.op) {

    // convert find claim to lookup to populate msg headers with params
    case 'find':
      if (!result.msgs || result.msgs.length < 1) {
        return claim.resolve([])
      }
      return this.lookup(result.msgs, claim)

    // push populated result msgs into cache & lookup original msgs again
    // * if results are incomplete or cache was invalidated lookup will
    //   repeat until claim timeout is reached or all msgs marked as invalid
    case 'lookup':
      await this.cache.insert(result.msgs)
      errors = anyErrors(result.msgs, claim)
      if(errors != false){
        return claim.reject(errors)
      }

      return this.lookup(filterInvalid(claim.msgs, result.msgs), claim)

    // resolve update, create & remove with flat list of msgs
    // * insert new versions of msgs into cache
    // * msgs not in backend db have msg._id set to null, invalidate cached
    case 'update':
    case 'create':
    case 'remove':
      this.cache.insert(result.msgs)

      errors = anyErrors(result.msgs, claim)
      if(errors != false){
        return claim.reject(errors)
      }

      return claim.resolve(result.msgs)

    default:
      return claim.reject(new Error(`unexpected result op: ${result.op}`))
    }
  }
}

// give up on messages that the backend flags as invalid
const filterInvalid = (reqMsgs, resMsgs) => {
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

const anyErrors = (msgs, claim) => {

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
      op: claim.op,
      uuid: claim.uuid,
      spec: claim.spec,
      fresh: claim.fresh,
      entryStack: reach(claim, 'entryStack.stack', '').split('\n')
    }
    e.name = Object.keys(errors)[0]
    e.message = JSON.stringify(details, null, 2)
    return e
  }

  return false
}

