'use strict'

const cloneDeep = require('lodash/cloneDeep')
const Loki = require('lokijs')
const EventEmitter = require('last-eventemitter')
const debug = require('debug')('dataparty.loki-cache')


module.exports = class LokiCache extends EventEmitter {

  constructor () {
    super()
    this.db = new Loki('app.dataparty.io/cache')
  }

  async start(){
    return Promise.resolve()
  }

  _emitChange(msg, change){
    const { type, id, revision } = msg.$meta
    this.emit(
      `${type}:${id}`,
      {
        event: change,
        msg: { type, id, revision }
      }
    )
  }

  remove(type, id){
    debug('remove', type, id)
    var collection = this.db.getCollection(type)

    collection.chain().find({
      '$meta.id': id
    }).remove()

    var found = collection.findOne({'$meta.id': id})

    debug(found)
    if(found){ 
    
      try{
        collection.remove(found)  
      }
      catch(exception){
        debug('remove CATCH -', exception)
        collection.findAndRemove({'$meta.id': id})
      }
    }

    var item = this.findById(type, id)

    debug(item)

    if(!item){
      debug('remove, TEST - no item found')
    }
    else{
      debug('remove, TEST - found item')
      //throw 'remove failed'
    }
  }

  findById(type, id){
    const cachedMsg = this.db.getCollection(type).findOne({ '$meta.id': id })

    if(cachedMsg){
      delete cachedMsg.$loki
      delete cachedMsg.meta
    }

    return cachedMsg
  }

  // insert list of msgs (& msg invalidations) into cache
  // * messages are inserted into collection indicated by required _type field
  // * requires unique msg.$meta.id field for each msg
  // * if inserted msg.$meta.error or msg.$meta.removed is truthy delete
  insert (msgs) {
    return new Promise((resolve, reject) => {

      for (const msg of msgs) {
        debug('inserting msg ->', msg)

        const { type, id, error, removed } = msg.$meta

        // if collection for msg type isnt in cache, add it
        if ( !this.db.getCollection(type) ) {

          // create new table & index on unique $meta.id
          // TODO -> index { unique: ['$meta.id'] }
          this.db.addCollection(type)
        }
        const collection = this.db.getCollection(type)

        // check for cached version of message
        const cachedMsg = collection.findOne({ '$meta.id': id })

        // if backend set error or removed flag invalidate cache
        if (error || removed) {
          debug('invalidating msg!')

          if (cachedMsg) {
            try{
              //collection.remove(cachedMsg)
              collection.findAndRemove({
                '$meta.id': id,
              })
            }
            catch(err){
              debug('WARN', err)
            }
            this._emitChange(msg, 'remove')
          }

        // otherwise insert new message (remove old message if it exists)
        } else {

          debug('inserting msg')

          // check if msg is already in cache
          if (cachedMsg) {
            collection.findAndRemove({
              '$meta.id': id,
            })
          }

          // clone msg on insert - cache should follow backend
          collection.insert(cloneDeep(msg))
          

          if(cachedMsg){
            this._emitChange(msg, 'update')
          }
          else {
            this._emitChange(msg, 'create')
          }
        }
      }
      resolve(true)
    })
  }

  // takes list of metadata msgs to populate with params
  // * reads metadata -> msg.$meta.type & msg.$meta.id
  // * resolves to -> { hits: [populated msgs], misses: [original msgs] }
  populate (msgs) {
    return new Promise((resolve, reject) => {
      debug('populating msgs ->', msgs)

      const hits = []
      const misses = []
      for (const msg of msgs) {
        const { type, id, revision } = msg.$meta || {}

        const collection = this.db.getCollection(type)
        if (collection) {

          // get msg by id & strip loki metadata
          const cachedMsg = Object.assign(
            {},
            collection.findOne({ '$meta.id': id})
          )
          delete cachedMsg.$loki
          delete cachedMsg.meta
          if (cachedMsg && cachedMsg.$meta && cachedMsg.$meta.id) {

            if(revision > -1 && cachedMsg.$meta.revision != revision){
              misses.push(msg)
            }
            else{
              hits.push(cachedMsg)
            }
          } else {
            misses.push(msg)
          }
        } else {
          misses.push(msg)
        }
      }

      debug('hits & misses ->', { hits, misses })

      resolve({ hits, misses })
    })
  }
}
