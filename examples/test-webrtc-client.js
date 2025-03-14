const fs = require('fs')
const path = require('path')
const debug = require('debug')('test.local-db')
const WRTC = require('wrtc')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src')

function waitForUserInput (text) {
  return new Promise((resolve, reject) => {
    process.stdin.resume()
    process.stdout.write(text)
    process.stdin.once('data', data => resolve(data.toString().trim()))
    process.stdin.once('error', reject)
  })
}

async function main(){
  const offerPath = path.join( process.env.HOME, 'host.offer.json' )
  const answerPath = path.join( process.env.HOME, 'client.answer.json')
  let peer2 = new Dataparty.PeerParty({
    comms: new Dataparty.Comms.RTCSocketComms({
      wrtc: WRTC,
      trickle: false,
      session: 'foobar'
    }),
    model: BouncerModel,
    config: new Dataparty.Config.MemoryConfig()
  })

  await waitForUserInput("please place host offer in: "+offerPath)

  await peer2.loadIdentity()

  let offer = JSON.parse( fs.readFileSync(offerPath, 'utf8') )

  console.log('read offer')

  peer2.comms.remoteIdentity = offer[0]

  await peer2.start()

  peer2.comms.socket.on('signal', data=>{
    console.log('p1 << p2', data)

    fs.writeFileSync(answerPath, JSON.stringify(data))
    console.log('wrote client answer file to:', answerPath)
  })

  peer2.comms.socket.signal(offer[1])


  debug('waiting for auth')
  await peer2.comms.authorized()
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


setTimeout( ()=>{
main().catch(err=>{
  console.error(err)
})
}, 2000)
