const debug = require('debug')('bouncer.crufler-admin')

const MongoQuery = require('./mongo-query')

const ICrufler = require('./icrufler')

module.exports = class AdminCrufler extends ICrufler {

  constructor({db, context}){
    super({db, context})
  }

  async handleCall(ask){
    debug('handleCall')
    //debug('\task', JSON.stringify(ask,null,2))

    let complete = true
    let results = []

    for(let crufl of ask.crufls){
      let result = {
        op: crufl.op,
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
        debug(err)
        result.error = err

        debug(crufl)
        debug(result)

        process.exit()
      }

      results.push(result)
    }

    let freshness = {
      uuid: ask.uuid,
      results,
      complete
    }

    //debug('replying', JSON.stringify(freshness,null,2))

    return {freshness: results }
  }


  async applyFind(crufl, includeData = false){
    debug('find', JSON.stringify(crufl,null,2))
    let mongoQuery = new MongoQuery(crufl.spec)

    let query = mongoQuery.getQueryDoc()

    let resultSet = await this.db.find(crufl.type, query)

    debug(resultSet)

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

    debug(msgs)
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
      
      await this.db.findAndRemove(crufl.type, rmMsg)
      msgs.push(msg)
    }

    return msgs
  }

  async applyUpdate(crufl){
    return await this.db.update(crufl.type, crufl.msgs)
  }
}