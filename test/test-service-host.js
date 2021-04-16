const Path = require('path')
const debug = require('debug')('test.server-db')
const Dataparty = require('../src')

const BouncerServerModels = require('@dataparty/bouncer-model')
const BouncerClientModels = require('@dataparty/bouncer-model/dist/bouncer-model.json')

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

  const uri = 'mongodb://localhost:27017/server-party-test'
  debug('db location', uri)

  let party = new Dataparty.MongoParty({
    uri,
    model: BouncerClientModels,
    serverModels: BouncerServerModels,
    config: new Dataparty.Config.MemoryConfig()
  })

  const service = new ExampleService({ name: '@dataparty/example', version: '0.0.1' })

  const build = await service.compile(Path.join(__dirname,'../dataparty'), true)

  debug('built', Object.keys(build))

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