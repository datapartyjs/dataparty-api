const debug = require('debug')('bouncer.crufler-admin')

const MongoQuery = require('./mongo-query')

const ICrufler = require('./icrufler')

module.exports = class AdminCrufler extends ICrufler {

  constructor({db, context}){
    super({db, context})
  }

  async handleCall(ask){
    debug('handleCall', ask)
    //debug('\task', JSON.stringify(ask,null,2))

    let complete = true
    let results = []

    for(let crufl of ask.crufls){
      let result = {
        op: crufl.op,
        type: crufl.type,
        uuid: crufl.uuid,
        msgs: [],
        complete: true,
        error: null
      }

      debug('\tcrufl->', crufl.type)

      try{
        switch(crufl.op){
          case 'create':
            result.msgs = await this.applyCreate(crufl)
            break
          case 'remove':
            result.msgs = await this.applyRemove(crufl)
            break
          case 'update':
            result.msgs = await this.applyUpdate(crufl)
            break
          case 'find':
            result.msgs = await this.applyFind(crufl, false)
            break
          case 'lookup':
            result.msgs = await this.applyFind(crufl, true)
            break
          
          default:
            break
        }
      }
      catch(err){
        debug('crufl error')
        debug(err)
        result.error = err

        debug(crufl)
        debug(result)

        //process.exit()
      }

      debug('completed', crufl)
      debug('result', result)

      results.push(result)
    }

    let freshness = {
      uuid: ask.uuid,
      results,
      complete
    }

    debug('replying', JSON.stringify(freshness,null,2))


    return freshness
  }


  async applyFind(crufl, includeData = false){
    debug('find', JSON.stringify(crufl,null,2))

    let spec = crufl.spec ? crufl.spec : {
      ids: crufl.msgs.map(m=>{ debug(typeof m.$meta.id); return m.$meta.id}),
      type: crufl.type
    }

    let mongoQuery = new MongoQuery(spec)



    let resultSet = await this.db.find(crufl.type, mongoQuery)

    debug('resultSet',resultSet)

    let msgs = []

    for(const result of resultSet){

      if(includeData){

        msgs.push(result)

      } else{

        msgs.push({
          $meta:{
            id: result.$meta.id,
            type: result.$meta.type,
            revision: result.$meta.revision
          }
        })

      }
    }

    debug('applyFind found msgs', msgs)
    return msgs
  }

  async applyCreate(crufl){
    return await this.db.insertMany(crufl.type, crufl.msgs)
  }

  async applyRemove(crufl){
    let msgs = []


    for(let rmMsg of crufl.msgs){
      let msg = { $meta: {
        removed: true,
        id: rmMsg.$meta.id,
        type: rmMsg.$meta.type
      }}
      
      let obj = await this.db.findAndRemove(crufl.type, rmMsg)
      msgs.push(obj)
    }

    return msgs
  }

  async applyUpdate(crufl){
    return await this.db.update(crufl.type, crufl.msgs)
  }
}