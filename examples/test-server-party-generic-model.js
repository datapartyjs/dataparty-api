const debug = require('debug')('test.server-db')
const BouncerClientModels = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src')

async function main(){

  const uri = 'mongodb://localhost:27017/server-party-generics-test'
  debug('db location', uri)

  let party = new Dataparty.MongoParty({
    uri,
    model: BouncerClientModels,
    config: new Dataparty.Config.MemoryConfig()
  })


  await party.start()

  let user = (await party.find()
    .type('user')
    .where('name').equals('tester')
    .exec())[0]



  if(!user){
    debug('creating document')
    user = await party.createDocument('user', {
      name: 'tester',
      'created': (new Date()).toISOString(),
      profile: {
        'created': (new Date()).toISOString()
      }
    })
    debug('created document')
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