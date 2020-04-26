'use strict'

const cloneDeep = require('lodash/cloneDeep')
const Clerk = require('./clerk.js')

// query builds query.spec object thru chained match links
//
// query.spec {
//
//   // header -> each field can optionally appear once at top level
//   type: 'type' | types: ['type0' .. 'typeN'],
//   id: 'xxx' | ids: ['xxx', 'yyy', 'zzz'],
//   owner: { type: 'typeQ', id: 'qqq' },
//   sort: { param: ['param', 'path'], direction: < -1 | 1 > },
//   limit: count,
//   select: [['filter'], ['on'], ['param', 'paths']],
//
//   // match operation tree
//   // * ignored if 'id' or 'ids' fields are set
//   // * generated from query chain
//   // * param paths for match ops set from nearest preceding .where()
//   // * executed on table(s) set by type(s) field otherwise all tables
//   // * ops: and | or | equals | exists | in | gt | lt | size | all | elem
//   match: [ // match implicitly ands list of match operations
//     { op: 'equals', param: ['param', 'path'], value: 'value' },
//     { op: 'or',
//       match: [
//         { op: 'in', param: ['param', 'path'], values: [x, y, z] },
//         { op: 'and',
//           match: [
//             { op: 'gt', param: ['param', 'path'], value: min },
//             { op: 'lt', param: ['param', 'path'], value: max },
//           ],
//         },
//       ]
//     },
//     { op: 'size', param: ['path', 'to', 'list'], value: count },
//     { op: 'elem',
//       param: ['path', 'to', 'list'],
//       match: [
//         { op: 'in', param: ['color'], values: ['color0' .. 'colorN'] },
//         { op: 'exists', param: ['name'], value: boolean },
//       ],
//     },
//     { op: 'all', param: ['other', 'list'], values: [p, q, r] },
//   ],
// }
module.exports = class Query {

  constructor (qb, model) {
    this.qb = qb
    this.model = model

    // starts with empty match tree
    this.spec = { match: [] }

    // variables to track the context of the match chain
    this.currentWhere = undefined
    this.whereStack = []
    this.andOrElemStack = []
    this.currentMatch = this.spec.match
    this.matchStack = []
  }

  toJSON(){
    return this.spec
  }

  // return a promise resolving to result of query
  exec (hydrate = true) {

    if(!(typeof this.spec.type === 'string' && this.spec.type.length > 0)){
      console.error(this.spec)
      throw new Error ('Bad query')
    }

    if(hydrate){
      return this.qb.find(this.spec)
        .then(this.model.hydrate.bind(this.model))
    }
    
    return this.qb.find(this.spec)
  }

  // *** match chain headers ***
  //   -> not sensitive to position in chain
  //   -> last call in chain overwrites earlier calls

  // restrict query to msgs of given type
  type (type) {
    delete this.spec.types // mutually exclusive
    this.spec.type = type
    return this // enable chaining
  }

  // restrict query to msgs of given types
  // *not compatible with type*
  types (...types) {
    delete this.spec.type // mutually exclusive
    this.spec.types = types.slice() // copy array to avoid side effects
    return this // enable chaining
  }

  // query for single msg by given id
  // prereq -> type (*not* types)
  // *all other query ops (except type) will be ignored*
  id (id) {
    delete this.spec.ids // mutually exclusive
    this.spec.id = id
    return this // enable chaining
  }

  // query for a list of msgs by given ids
  // prereq -> type (*not* types)
  // *all other query ops (except type) will be ignored*
  ids (...ids) {
    delete this.spec.id // mutually exclusive
    this.spec.ids = ids.slice() // copy array to avoid side effects
    return this // enable chaining
  }

  // restrict query to msgs with owner matching given type, id pair
  owner (type, id) {
    this.spec.owner = { type, id }
    return this // enable chaining
  }

  // sort returned msgs on given param path (leading '-' reverses sort)
  sort (param, direction) {
    let cleanDirection = direction || 1
    let cleanParam = param
    if (cleanParam[0] === '-') {
      cleanDirection = -1
      cleanParam = cleanParam.slice(1) // remove leading '-'
    }
    this.spec.sort = { param: cleanParam, direction: cleanDirection }
    return this // enable chaining
  }

  // limit # of msgs returned by query to a maximum of count
  limit (count) {
    this.spec.limit = count
    return this // enable chaining
  }

  // filter fields from parameters of returned msgs
  select (filter) {
    this.spec.select = Clerk.splitFilter(filter)
    return this // enable chaining
  }

  // *** match tree nodes ***

  // sets context for following operations to given param path
  where (param) {
    this.currentWhere = Query.splitParam(param)
    return this // enable chaining
  }

  // following path segments will be anded (default behavior)
  and () {
    const op = { op: 'and', match: [] }
    this.currentMatch.push(op)

    // push 'and' onto and or elem stack
    this.andOrElemStack.push('and')

    // push old match list onto match stack & set new ops match as current
    this.matchStack.push(this.currentMatch)
    this.currentMatch = op.match

    return this // enable chaining
  }

  // closes scope of most recent and
  dna () {

    // pop scope stack & validate that current scope is 'and'
    const lastAndOrElem = this.andOrElemStack.pop()
    if (lastAndOrElem !== 'and') {
      if (lastAndOrElem === undefined) {
        throw new Error('cant dna without anding first!')
      }
      this.andOrElemStack.push(lastAndOrElem) // restore stack before throw
      throw new Error(`cant dna until ${lastAndOrElem} is closed`)
    }

    // pop match stack and restore last match to current
    this.currentMatch = this.matchStack.pop()

    // validate restored match list
    if (this.currentMatch === undefined) {
      throw new Error('match stack underflow!')
    }

    return this // enable chaining
  }

  // following path segments will be ored
  or () {
    const op = { op: 'or', match: [] }
    this.currentMatch.push(op)

    // push 'or' onto and or elem stack
    this.andOrElemStack.push('or')

    // push old match list onto match stack & set new ops match as current
    this.matchStack.push(this.currentMatch)
    this.currentMatch = op.match

    return this // enable chaining
  }

  // closes scope of most recent or
  ro () {

    // pop scope stack & validate that current scope is 'or'
    const lastAndOrElem = this.andOrElemStack.pop()
    if (lastAndOrElem !== 'or') {
      if (lastAndOrElem === undefined) {
        throw new Error('cant ro without oring first!')
      }
      this.andOrElemStack.push(lastAndOrElem) // restore stack before throw
      throw new Error(`cant ro until ${lastAndOrElem} is closed`)
    }

    // pop match stack and restore last match to current
    this.currentMatch = this.matchStack.pop()

    // validate restored match list
    if (this.currentMatch === undefined) {
      throw new Error('match stack underflow!')
    }

    return this // enable chaining
  }

  equals (value) { // @leaf `{$eq: a}`
    const op = { op: 'equals', param: this.cloneWhere(), value: value }
    this.currentMatch.push(op)
    return this // enable chaining
  }

  exists (flag) { // @leaf `{$eq: a}`
    const does = flag === true || flag === undefined // defaults to true
    const op = { op: 'exists', param: this.cloneWhere(), value: does }
    this.currentMatch.push(op)
    return this // enable chaining
  }

  in (...values) { // @leaf `{$in: [one, two, five]}`
    const op = { op: 'in', param: this.cloneWhere(), values: values }
    this.currentMatch.push(op)
    return this // enable chaining
  }

  gt (value) { // @leaf `{$gt: a}`
    const op = { op: 'gt', param: this.cloneWhere(), value: value }
    this.currentMatch.push(op)
    return this // enable chaining
  }

  lt (value) { // @leaf `{$lt: a}`
    const op = { op: 'lt', param: this.cloneWhere(), value: value }
    this.currentMatch.push(op)
    return this // enable chaining
  }

  // *** list operators ***
  //   -> subtype of match tree nodes
  //   -> most recent .where('param') path must be list for these to match

  // searches for a single element of list matching *all* following conditions
  // between elem .. mele nodes where('path') calls are relative to
  // param path scope at opening of element match
  elem () {
    const op = { op: 'elem', param: this.cloneWhere(), match: [] }
    this.currentMatch.push(op)

    // push current where onto where stack & set where to empty list
    this.whereStack.push(this.currentWhere)
    this.currentWhere = []

    // push 'or' onto and or elem stack
    this.andOrElemStack.push('elem')

    // push old match list onto match stack & set new ops match as current
    this.matchStack.push(this.currentMatch)
    this.currentMatch = op.match

    return this // enable chaining
  }

  mele () {

    // pop scope stack & validate that current scope is 'elem'
    const lastAndOrElem = this.andOrElemStack.pop()
    if (lastAndOrElem !== 'elem') {
      if (lastAndOrElem === undefined) {
        throw new Error('cant mele without eleming first!')
      }
      this.andOrElemStack.push(lastAndOrElem) // restore stack before throw
      throw new Error(`cant mele until ${lastAndOrElem} is closed`)
    }

    // pop where stack and restore last where to current
    this.currentWhere = this.whereStack.pop()

    // pop match stack and restore last match to current
    this.currentMatch = this.matchStack.pop()

    // validate restored match list
    if (this.currentMatch === undefined) {
      throw new Error('match stack underflow!')
    }

    return this // enable chaining
  }

  // matches a list that is a superset of given list
  all (...values) { // @leaf `{$all: [one, two, five]}`
    const op = { op: 'all', param: this.cloneWhere(), values: values }
    this.currentMatch.push(op)
    return this // enable chaining
  }

  // matches list with *exactly* count items
  size (count) { // @leaf `{$size: a}`
    const op = { op: 'size', param: this.cloneWhere(), value: count }
    this.currentMatch.push(op)
    return this // enable chaining
  }

  // *** helper functions ***

  cloneWhere () {
    if (!Array.isArray(this.currentWhere)) {
      throw new Error('where value not set!')
    }
    return cloneDeep(this.currentWhere)
  }

  // split parameter path on '.' if there are any
  static splitParam (param) {
    return param.split('.')
  }
}
