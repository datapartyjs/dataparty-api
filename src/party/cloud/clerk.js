'use strict'

const pick = require('lodash/pick')

// a collection of static methods for working with data party msgs
module.exports = class Clerk {

  // return a list of msgs of a single type
  static validateOneType (msgs) {
    const typeMap = {}
    for (const msg of msgs) {
      if (!(msg.$meta.type in typeMap)) {
        typeMap[msg.$meta.type] = []
      }
      typeMap[msg.$meta.type].push(msg)
    }
    const types = Object.keys(typeMap)
    return types.length < 1 ? [null, []] : [types[0], typeMap[types[0]]]
  }

  // return a copy of msg with only the filtered params populated
  static select (filter, msg) {
    const pickFilter =
      Array.isArray(filter) ? filter : Clerk.splitFilter(filter)

    return pick(msg, pickFilter)
  }

  // selects a list of msgs
  static selectAll (filter, msgs) {
    const pickFilter =
      Array.isArray(filter) ? filter : Clerk.splitFilter(filter)
    const selected = []
    for (const msg of msgs) {
      selected.push(Clerk.select(pickFilter, msg))
    }
    return selected
  }

  // split param filter on spaces then '.':
  // 'name model comms.ble'
  //   -> [['name'], ['model'], ['comms', 'ble']]
  static splitFilter (filter) {
    const splitFilter = []
    for (const match of filter.split(' ')) {
      splitFilter.push(match.split('.'))
    }
    return splitFilter
  }

  // takes plain objects or id strings & returns data party msgs
  static partyize (type, msg) {
    if (typeof msg === 'string') {
      return {
        $meta: { type, id: msg },
        _id: msg
      }
    }

    if (typeof msg === 'object') {
      return Object.assign(
        {},
        msg,
        { $meta: { type: type, id: msg._id } }
      )
    }
  }
}
