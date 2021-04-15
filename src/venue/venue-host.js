const Path = require('path')
const debug = require('debug')('venue.host')
const Dataparty = require('../index')

const BouncerServerModels = require('@dataparty/bouncer-model')
const BouncerClientModels = require('@dataparty/bouncer-model/dist/bouncer-model.json')

const VenueService = require('./venue-service')


class ExampleService extends Dataparty.IService {
  constructor(opts){
    super(opts)

    this.addMiddleware(Dataparty.middleware_paths.pre.decrypt)
    this.addMiddleware(Dataparty.middleware_paths.pre.validate)

    this.addMiddleware(Dataparty.middleware_paths.post.validate)
    this.addMiddleware(Dataparty.middleware_paths.post.encrypt)

    this.addEndpoint(Dataparty.endpoint_paths.echo)
    this.addEndpoint(Dataparty.endpoint_paths.secureecho)
    this.addEndpoint(Dataparty.endpoint_paths.identity)
    this.addEndpoint(Dataparty.endpoint_paths.version)
  }

}



async function main(){

  const uri = 'mongodb://localhost:27017/venue-test'
  debug('db location', uri)



  const exampleSrv = new ExampleService({ name: '@dataparty/nested-example', version: '0.0.1' })
  const compiledExampleSrv = await exampleSrv.compile(Path.join(__dirname,'../../dataparty'), true)


  const service = new VenueService({ name: '@dataparty/venue', version: '0.0.1' })


  const build = await service.compile(Path.join(__dirname,'../../dataparty'), true)


  debug('compiled')

  console.log(Object.keys(BouncerServerModels))

  const serverModels = {
    Utils: BouncerServerModels.Utils,
    Model: BouncerServerModels.Model,
    Types: {
      ...BouncerServerModels.Types,
      BanList: require('./schema/ban_list'),
      VenueSrv: require('./schema/venue_service')
    }
  }

  let party = new Dataparty.MongoParty({
    uri,
    model: build.schemas,
    serverModels,
    config: new Dataparty.Config.MemoryConfig()
  })

  debug('partying')

  const runner = new Dataparty.ServiceRunner({
    party, service,
    sendFullErrors: true
  })
  
  const host = new Dataparty.ServiceHost({runner, trust_proxy: true})

  await party.start()
  await runner.start()
  await host.start()

  console.log('started')
  
  //process.exit()
}



main().catch(err=>{
  console.error(err)
})