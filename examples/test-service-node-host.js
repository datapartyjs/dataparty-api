const fs = require('fs')
const Path = require('path')
const debug = require('debug')('test.server-db')
const Dataparty = require('../src')
const dataparty_crypto = require('@dataparty/crypto')

class ExampleService extends Dataparty.IService {
  constructor(opts){
    super(opts)

    let builder = new Dataparty.ServiceBuilder(this)

    builder.addMiddleware(Dataparty.middleware_paths.pre.decrypt)
    builder.addMiddleware(Dataparty.middleware_paths.pre.validate)

    builder.addMiddleware(Dataparty.middleware_paths.post.validate)
    builder.addMiddleware(Dataparty.middleware_paths.post.encrypt)

    builder.addEndpoint(Dataparty.endpoint_paths.echo)
    builder.addEndpoint(Dataparty.endpoint_paths.secureecho)
    builder.addEndpoint(Dataparty.endpoint_paths.identity)
    builder.addEndpoint(Dataparty.endpoint_paths.version)

    builder.addSchema(Path.join(__dirname, './party/schema/basic_types.js'))
    builder.addTopic(Path.join(__dirname, './party/topics/time-topic.js'))
  }

}

async function main(){

  
  //const uri = 'mongodb://localhost:27017/server-party-test'
  //debug('db location', uri)

  
  const service = new ExampleService({ name: '@dataparty/example', version: '0.0.1' })
  const builder = new Dataparty.ServiceBuilder(service)
  const build = await builder.compile(Path.join(__dirname,'/dataparty'), true)
  
  const serviceName = build.package.name
  const basePath = '/data/dataparty/'
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

  const ssl_key  = fs.readFileSync( Path.join(__dirname,'key.pem'), 'utf8')
  const ssl_cert = fs.readFileSync( Path.join(__dirname,'cert.pem'), 'utf8')
  
  
  const host = new Dataparty.ServiceHost({
    listenUri: 'http://0.0.0.0:4000',
    runner: runnerRouter,
    trust_proxy: true,
    wsEnabled: true,
    //ssl_key, ssl_cert
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
