const Path = require('path')
const debug = require('debug')('test.server-db')
const Dataparty = require('../src')
const dataparty_crypto = require('@dataparty/crypto')

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

    this.addSchema(Path.join(__dirname, './party/schema/basic_types.js'))
  }

}

async function main(){

  
  //const uri = 'mongodb://localhost:27017/server-party-test'
  //debug('db location', uri)

  
  const service = new ExampleService({ name: '@dataparty/example', version: '0.0.1' })
  const build = await service.compile(Path.join(__dirname,'/dataparty'), true)
  
  const serviceName = build.package.name
  const basePath = '/data/datparty/'
  const servicePath = Path.join(basePath, serviceName.replace('/','-'))

  let config = new Dataparty.Config.JsonFileConfig({ basePath: servicePath })
  config.touchDir('/tingo')

  const dbPath = Path.join(servicePath, '/tingo')

  let party = new Dataparty.TingoParty({
    config,
    path: dbPath,
    model: build
  })

  party.topics = new Dataparty.LocalTopicHost()

  const live = new Dataparty.IService(build.package, build)

  
  const runner = new Dataparty.ServiceRunnerNode({
    party,
    //prefix: 'foo',
    service: live,
    sendFullErrors: false,
    useNative: false
  })

  
  
  
  const runnerRouter = new Dataparty.RunnerRouter(runner)
  
  
  const host = new Dataparty.ServiceHost({
    runner: runnerRouter,
    trust_proxy: true,
    wsEnabled: true,
  })
  
  debug(runner.party.identity)
  await party.start()
  await runnerRouter.start()
  await host.start()

  console.log('started')
  
  //process.exit()
}



main().catch(err=>{
  console.error(err)
})
