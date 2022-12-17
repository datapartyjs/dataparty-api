const debug = require('debug')('test.local-db')
const WRTC = require('wrtc')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src')

async function main(){
  const dbPath = '/tmp/local-peer-party-loki.db'

  debug('db location', dbPath)

  let hostLocal = new Dataparty.LokiParty({
    path: dbPath,
    model: BouncerModel,
    config: new Dataparty.Config.MemoryConfig()
  })

  let peer1 = new Dataparty.PeerParty({
    comms: new Dataparty.Comms.RTCSocketComms({
      host: true,
      wrtc: WRTC,
      trickle: true,
      discoverRemoteIdentity: true
    }),
    hostParty: hostLocal,
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


main().catch(err=>{
  console.error(err)
})