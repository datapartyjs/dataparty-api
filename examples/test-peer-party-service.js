const debug = require('debug')('test.peer-party-service')
const WRTC = require('wrtc')
const Path = require('path')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src')

const BouncerServerModels = require('@dataparty/bouncer-model')

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
  const dbPath = '/tmp/local-peer-party-service'

  debug('db location', dbPath)

  let hostLocal = new Dataparty.TingoParty({
    path: dbPath,
    model: BouncerModel,
    serverModels: BouncerServerModels,
    config: new Dataparty.Config.JsonFileConfig({basePath: dbPath})
  })

  const service = new ExampleService({ name: '@dataparty/example', version: '0.0.1' })

  const build = await service.compile(Path.join(__dirname,'/dataparty'), true)

  debug('built', Object.keys(build))

  const runner = new Dataparty.ServiceRunnerNode({
    party: hostLocal, service,
    sendFullErrors: false
  })

  /*let hostLocal = new Dataparty.LokiParty({
    path: dbPath,
    model: BouncerModel,
    config: new Dataparty.Config.MemoryConfig()
  })*/

  let peer1 = new Dataparty.PeerParty({
    comms: new Dataparty.Comms.RTCSocketComms({
      host: true,
      wrtc: WRTC,
      trickle: true,
      discoverRemoteIdentity: true
    }),
    hostParty: hostLocal,
    hostRunner: runner,
    model: BouncerModel,
    config: new Dataparty.Config.MemoryConfig()
  })


  let peer2 = new Dataparty.PeerParty({
    comms: new Dataparty.Comms.RTCSocketComms({
      wrtc: WRTC,
      trickle: true,
      session: 'foobar'
    }),
    model: BouncerModel,
    config: new Dataparty.Config.MemoryConfig()
  })



  await peer1.loadIdentity()
  await peer2.loadIdentity()

  //peer1.comms.remoteIdentity = peer2.identity
  peer2.comms.remoteIdentity = peer1.identity

  await peer1.start()
  await runner.start()

  await peer2.start()

  peer1.comms.socket.on('signal', data=>{
    debug('p1 >> p2', data)
    peer2.comms.socket.signal(data)
  })

  peer2.comms.socket.on('signal', data=>{
    debug('p1 << p2', data)
    peer1.comms.socket.signal(data)
  })

  debug('waiting for auth')
  await Promise.all([
    peer1.comms.authorized(),
    peer2.comms.authorized()
  ])
  
  debug('authed')

  const remoteVersion = await peer2.comms.call('version')
  const remoteId = await peer2.comms.call('identity')

  

  let user = (await peer2.find()
    .type('user')
    .where('name').equals('tester')
    .exec())[0]

  
  if(!user){
    debug('creating document')
    user = await peer2.createDocument('user', {name: 'tester', created: (new Date()).toISOString() })
  }
  else{
    debug('loaded document')
  }


  console.log(remoteId)
  console.log(remoteVersion)
  
  console.log(user.data)
  process.exit()
}


main().catch(err=>{
  console.error(err)
})