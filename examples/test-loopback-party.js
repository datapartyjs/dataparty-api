const fs = require('fs/promises')
const debug = require('debug')('test.local-db')
const WRTC = require('wrtc')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src')

async function main(){
  const dbPath = await fs.mkdtemp('/tmp/tingo-party')
  const configPath = await fs.mkdtemp('/tmp/tingo-party-config')

  debug('db location', dbPath)

  let config = new Dataparty.Config.JsonFileConfig({basePath: configPath})

  let hostLocal = new Dataparty.TingoParty({
    path: dbPath,
    model: BouncerModel,
    config
  })

  let loopback = new Dataparty.Comms.LoopbackChannel()

  let comms1 = new Dataparty.Comms.LoopbackComms({
    host: true,
    channel: loopback.peer1
  })

  let peer1 = new Dataparty.PeerParty({
    comms: comms1,
    hostParty: hostLocal,
    model: BouncerModel,
    config
  })


  let comms2 = new Dataparty.Comms.LoopbackComms({ channel: loopback.peer2, session: 'foobar' })

  let peer2 = new Dataparty.PeerParty({
    comms: comms2,
    model: BouncerModel,
    config: new Dataparty.Config.MemoryConfig()
  })


  await config.start()


  await peer1.loadIdentity()
  await peer2.loadIdentity()

  peer1.comms.remoteIdentity = peer2.identity
  peer2.comms.remoteIdentity = peer1.identity

  await peer1.start()
  await peer2.start()


  debug('waiting for auth')
  await Promise.all([
    peer1.comms.authorized(),
    peer2.comms.authorized()
  ])
  
  debug('authed')


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
    

  console.log(user.data)
  process.exit()
}


try{

  main().catch(err=>{
    console.error(err)
  })

}
catch(err){
  console.log('crash')
  console.log(err)
}