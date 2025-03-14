const fs = require('fs')
const path = require('path')
const debug = require('debug')('test.local-db')
const WRTC = require('wrtc')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src')

let offer=[]

function waitForUserInput (text) {
  return new Promise((resolve, reject) => {
    process.stdin.resume()
    process.stdout.write(text)
    process.stdin.once('data', data => resolve(data.toString().trim()))
    process.stdin.once('error', reject)
  })
}

async function main(){
  const dbPath = '/tmp/local-peer-party-loki.db'

  const offerPath = path.join( process.env.HOME, 'host.offer.json' )
  const answerPath = path.join( process.env.HOME, 'client.answer.json')

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
      trickle: false,
      discoverRemoteIdentity: true
    }),
    hostParty: hostLocal,
    model: BouncerModel,
    config: new Dataparty.Config.MemoryConfig()
  })


  await peer1.loadIdentity()

  offer.push(peer1.identity)

  console.log('host identity', peer1.identity.key.public.sign)


  await peer1.start()

  peer1.comms.socket.on('signal', async (data)=>{
    //console.log('p1 >> p2', JSON.stringify(data))



    if(offer.length == 2){
       fs.writeFileSync(offerPath, JSON.stringify(offer))
       console.log('wrote host offer to:', offerPath)

       await waitForUserInput("please place client answer in: "+ answerPath)
       let answer = JSON.parse( fs.readFileSync(answerPath, 'utf8') )

       peer1.comms.socket.signal(answer)
    }

  })


  debug('waiting for auth')
  await  peer1.comms.authorized()
  debug('authed')

  setInterval(()=>{
  }, 2000)

}


main().catch(err=>{
  console.error(err)
})
