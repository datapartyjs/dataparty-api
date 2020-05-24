const debug = require('debug')('test.server-db')
const BouncerServerModels = require('@dataparty/bouncer-model')
const BouncerClientModels = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src')

async function main(){

  const uri = 'mongodb://localhost:27017/server-party-test'
  debug('db location', uri)

  let party = new Dataparty.ServerParty({
    uri,
    model: BouncerClientModels,
    serverModels: BouncerServerModels,
    config: new Dataparty.Config.MemoryConfig()
  })


  await party.start()

  let user = (await party.find()
    .type('user')
    .where('name').equals('tester')
    .exec())[0]

  
  if(!user){
    user = await party.createDocument('user', {name: 'tester'})
  }
    

  console.log(user.data)
  process.exit()
}


main().catch(err=>{
  console.error(err)
})