'use strict'

const ObjectId = require('bson-objectid')
const debug = require('debug')('bouncer.mongo-query')

// mongoose adapter for data party query specification
module.exports = class MongoQuery {

  /**
   * generates a mongodb query doc from a roshub query spec
   *
   * @constructor
   * @param spec - roshub query spec (wire format for data party queries)
   */
  constructor (spec) {
    this.spec = Object.assign({}, spec)
  }

  hasTypes () {
    return typeof this.spec.type === 'string'
      || Array.isArray(this.spec.types)
  }

  getTypes () {
    if (typeof this.spec.type === 'string') {
      return [this.spec.type]
    }
    if (Array.isArray(this.spec.types)) {
      return this.spec.types
    }
    return []
  }

  hasLimit () {
    return typeof this.spec.limit === 'number'
  }

  getLimit () {
    return this.spec.limit
  }

  hasSort () {
    return this.spec.sort !== null && typeof this.spec.sort === 'object'
  }

  getSort () {
    return { [this.spec.sort.param.join('.')]: this.spec.sort.direction }
  }

  /**
   * build mongo query doc from spec match tree
   * - explicitly 'and' top level of match tree
   * - search only returns msg metadata
   */
  getQueryDoc () {

    // add acl restrictions to beginning of root match nodes
    const rootMatch = this.spec.match ? this.spec.match.slice() : []

    debug('getting query doc with raw match ->', JSON.stringify(rootMatch))

    if (this.spec.owner !== null && typeof this.spec.owner === 'object') {
      debug('non-null spec owner')
      rootMatch.unshift({
        op: 'equals',
        param: ['owner', 'id'],
        value: (new ObjectId(this.spec.owner.id)).id
      })
      rootMatch.unshift({
        op: 'equals',
        param: ['owner', 'type'],
        value: this.spec.owner.type
      })
    }

    // if specified add id or ids to root match
    if (this.spec.id) {
      this.spec.ids = [this.spec.id]
    }
    if (this.spec.ids) {
      const oids = []
      for (const oid of this.spec.ids) {
        if (ObjectId.isValid(oid)) {
          debug('is valid')
          let id = (new ObjectId(oid)).id
          oids.push(id)
        }
        else{
          debug('is not valid')
        }
      }
      if (oids.length > 0) {
        rootMatch.unshift({
          op: 'in',
          param: ['_id'],
          values: oids
        })
      }
    }

    // mongodb will choke on empty and node
    // if root match list has no child nodes return empty object
    if (rootMatch.length < 1) {
      debug('returning empty query doc!')
      return {}
    }

    

    // pass recursive build query doc call root 'and' node & cursor list
    // * root 'and' node will be first element in query cursor list
    const queryCursor = []
    /*if(Array.isArray(rootMatch) && rootMatch.length == 1){
      debug('building query doc from root ->', JSON.stringify(rootMatch[0]))
      buildQueryDoc({ op: 'or', match: rootMatch }, queryCursor)
    }
    else{*/
      debug('building query doc from match ->', JSON.stringify(rootMatch))
      buildQueryDoc({ op: 'and', match: rootMatch }, queryCursor)
    //}

    return queryCursor[0]
  }
}

// recursively build mongo query msg from spec match tree
const buildQueryDoc = (node, cursor) => {
  switch (node.op) {

    // 'and' & 'or' nodes recurse into child nodes
    // -> { '$op': [child0 .. childN] }
    case 'and':
    case 'or': {
      const newCursor = []
      cursor.push({
        ['$' + node.op]: newCursor
      })

      // recurse over child nodes
      for (const childNode of node.match) {
        buildQueryDoc(childNode, newCursor)
      }
      return
    }

    // elem recurses into child nodes below path spec
    // -> { 'param.path': { '$elemMatch': [child0 .. childN] } }
    case 'elem': {
      const newCursor = []
      cursor.push({
        [node.param.join('.')]: { '$elemMatch': newCursor }
      })

      // recurse over child nodes
      for (const childNode of node.match) {
        buildQueryDoc(childNode, newCursor)
      }
      return
    }

    // single value leaf ops insert op node below given path
    // -> { 'param.path': { '$op': value } }    case 'exists':
    case 'gt':
    case 'lt':
    case 'size':
      cursor.push({
        [node.param.join('.')]: { ['$' + node.op]: node.value }
      })
      return

    // if op is equals just use node value
    // -> { 'param.path': value }
    case 'equals':
      cursor.push({
        [node.param.join('.')]: node.value
      })
      return

    // multiple value leaf ops insert op node below given path
    // -> { 'param.path': { '$op': [value0 .. valueN] } }
    case 'in':
    case 'all':
      cursor.push({
        [node.param.join('.')]: { ['$' + node.op]: node.values }
      })
      return
  }
  throw new Error(`unrecognized query op: ${node.op}`)
}