const debug = require('debug')('test.local-db')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src')

async function main(){
  const dbPath = '/tmp/local-party-loki.db'

  debug('db location', dbPath)

  let local = new Dataparty.LokiParty({
    path: dbPath,
    model: BouncerModel,
    config: new Dataparty.Config.MemoryConfig()
  })


  await local.start()

  let user = (await local.find()
    .type('user')
    .where('name').equals('tester')
    .exec())[0]

  
  if(!user){
    debug('creating document')
    user = await local.createDocument('user', {name: 'tester', created: Date.now()})
  }
  else{
    debug('loaded document')
  }

  console.log(user.data)
  process.exit()
}


main().catch(err=>{
  console.error(err)
})