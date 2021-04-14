const Path = require('path')
const debug = require('debug')('venue.host')
const Dataparty = require('../index')

const BouncerServerModels = require('@dataparty/bouncer-model')
const BouncerClientModels = require('@dataparty/bouncer-model/dist/bouncer-model.json')

const VenueService = require('./venue-service')

async function main(){

  const uri = 'mongodb://localhost:27017/server-party-test'
  debug('db location', uri)

  let party = new Dataparty.MongoParty({
    uri,
    model: BouncerClientModels,
    serverModels: BouncerServerModels,
    config: new Dataparty.Config.MemoryConfig()
  })

  const service = new VenueService({ name: '@dataparty/venue', version: '0.0.1' })

  const build = await service.compile(Path.join(__dirname,'../../dataparty'), true)

  debug('built')

  const runner = new Dataparty.ServiceRunner({
    party, service,
    sendFullErrors: true
  })
  
  const host = new Dataparty.ServiceHost({runner})

  await party.start()
  await runner.start()
  await host.start()

  console.log('started')
  
  //process.exit()
}



main().catch(err=>{
  console.error(err)
})