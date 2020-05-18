'use strict'

const debug = require('debug')('dataparty.cloud.qb')
const uuidv4 = require('uuid/v4') // random uuid generator
const Clerk = require('./clerk.js')
const reach = require('../../utils/reach')
// qb (query backend / queen bee / quarterback -> the leader of the party)
// handles backend communication to data-bouncer server
// * caches msguments locally to save bandwidth
//
// // check defines a single backend op on a single data collection (type)
// check = {
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
// // result of check has list of msgs
// // * lookup returns msgs with params, others just msg metadata
// // * msgs removed from backend have version set to -1
// result = {
//   op: 'op', // find | lookup | update | create | remove
//   uuid: '..', // uuid of check this is result for
//   type: '..', // collection result msgs belong to
//   msgs: [msg0 .. msgN], // db misses indicated with null msg
//   complete: boolean, // flag to indicate whether all msgs are included
// }
//
// // check calls are debounced & bundled into a single ask
// // * wrapped in dataparty-crypto message to secure backend comms
// ask = {
//   uuid: '..', // unique random id for this ask
//   checks: [check0 .. checkN], // array of check requests
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
module.exports = class LocalQb {

  constructor ({ }) {
  }

  // async call to resolve query spec thru backend server & local cache
  find (spec) {

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

  }
}
