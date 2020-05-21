const debug = require('debug')('test.local-db')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src')

async function main(){
  const dbPath = '/tmp/local-party-loki.db'

  debug('db location', dbPath)

  let local = new Dataparty.LocalParty({
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
    user = await local.createDocument('user', {name: 'tester'})
  }
    

  console.log(user.data)
  process.exit()
}


main().catch(err=>{
  console.error(err)
})