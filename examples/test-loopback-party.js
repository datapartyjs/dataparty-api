const fs = require('fs/promises')
const debug = require('debug')('test.local-db')
const WRTC = require('wrtc')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src')


async function getUser(party, name) {
  return (await party.find()
    .type('user')
    .where('name').equals(name)
    .exec())[0]
}


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

  hostLocal.topics = new Dataparty.LocalTopicHost()

  let loopback = new Dataparty.Comms.LoopbackChannel()

  let comms1 = new Dataparty.Comms.LoopbackComms({
    host: true,
    channel: loopback.port1
  })

  let peer1 = new Dataparty.PeerParty({
    comms: comms1,
    hostParty: hostLocal,
    model: BouncerModel,
    config
  })




  let comms2 = new Dataparty.Comms.LoopbackComms({ channel: loopback.port2, session: 'foobar' })

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
    console.log('peer2 creating document')
    user = await peer2.createDocument('user', {name: 'tester', created: (new Date()).toISOString() })
  }
  else{
    console.log('peer2 loaded document')
  }
  
    console.log(user.data)
    console.log('hash',user.hash)

  console.log('peer1 find document by new field value')
  let userFind = await getUser(peer1,'tester')
  console.log(userFind.data)
  console.log('hash',userFind.hash)

  user.on('change', (obj)=>{ console.log('peer2 remote event [document.on(change)]', obj ) })
  user.on('update', (obj)=>{ console.log('peer2 event [document.on(update)]')})
  user.on('value', (doc)=>{ console.log('peer2 event [document.on(value)]') })
  user.on('remove', (obj)=>{ console.log('peer2 event [document.on(remove)]') })

  await user.watch()

  console.log('\npeer1 changing document field')
  userFind.data.name = 'renamed-tester'
  await userFind.save()

  console.log(userFind.data)
  console.log('hash',userFind.hash)

  await userFind.remove()
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