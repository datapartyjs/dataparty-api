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
    this.addSchema(Path.join(__dirname, './party/schema/user.js'))
  }

}

async function main(){

  const socketFilePath = '/tmp/party.sock'

  
  const service = new ExampleService({ name: '@dataparty/example', version: '0.0.1' })
  const build = await service.compile(Path.join(__dirname,'/dataparty'), true)
  
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

  const live = new Dataparty.IService(build.package, build)

  
  const runner = new Dataparty.ServiceRunnerNode({
    party,
    service: live,
    sendFullErrors: false,
    useNative: false
  })

  const runnerRouter = new Dataparty.RunnerRouter(runner)
  
  
  const host = new Dataparty.ServiceHost({
    runner: runnerRouter,
    trust_proxy: true,
    wsEnabled: true,
    listenUri: 'file://'+socketFilePath,
    wsUpgradePath: '/'
  })
  
  debug(runner.party.identity)
  await party.start()
  await runnerRouter.start()
  await host.start()

  console.log('started')


  const remoteIdentity = party.identity

  debug('remoteIdentity', remoteIdentity)

  let clientParty = new Dataparty.PeerParty({
    comms: new Dataparty.Comms.WebsocketComms({
      uri: 'ws+unix://'+socketFilePath,
      remoteIdentity,
      session: 'foobar'
    }),
    model: build,
    config: new Dataparty.Config.MemoryConfig()
  })

  async function exitHandler(){

    //! We must explictly stop server to clean up socket file

    await clientParty.stop()

    await host.stop()
    process.exit()
  }

  process.on('exit', exitHandler)
  process.on('SIGINT', exitHandler)



  await clientParty.start()

  debug('client waiting for auth')
  await clientParty.comms.authorized()
  debug('client authorized')

  const remoteVersion = await clientParty.comms.call('version')
  const remoteId = await clientParty.comms.call('identity')

  debug('version', remoteVersion)
  debug('identity', remoteId)

  let user = (await clientParty.find()
  .type('user')
  .where('name').equals('tester')
  .exec())[0]


  if(!user){
    debug('client creating document')
    user = await clientParty.createDocument('user', {name: 'tester', created: (new Date()).toISOString() })
  }
  else{
    debug('client loaded document')
  }

  console.log(user.data)

  user.on('change', (obj)=>{ console.log('client remote event [document.on(change)]', obj.operationType ) })
  user.on('update', (obj)=>{ console.log('client event [document.on(update)]')})
  user.on('value', (doc)=>{ console.log('client event [document.on(value)]') })
  user.on('remove', (obj)=>{ console.log('client event [document.on(remove)]') })

  await user.watch()

  let localUser = (await party.find()
  .type('user')
  .where('name').equals('tester')
  .exec())[0]

  console.log('\nserver changing document field')
  localUser.data.name = 'renamed-tester'
  await localUser.save()

  console.log(localUser.data)
  console.log('hash',localUser.hash)

  await localUser.remove()
}



main().catch(err=>{
  console.error(err)
})
