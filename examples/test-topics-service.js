const Path = require('path')
const debug = require('debug')('test.topics-service')
const Dataparty = require('../src')
const dataparty_crypto = require('@dataparty/crypto')


function makeid(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}



async function main(){

  let config = new Dataparty.Config.MemoryConfig({
    basePath:'demo',
    cloud: {
      uri: 'http://10.36.158.251:4000'
    }
  })


  const remoteIdentity = await Dataparty.Comms.RestComms.HttpGet(  await config.read('cloud.uri') + '/identity')

  console.log('cloud.uri -',config.read('cloud.uri'))
  console.log('\tremoteIdentity', remoteIdentity)

  let party = new Dataparty.PeerParty({
    comms: new Dataparty.Comms.WebsocketComms({
      uri:'ws://10.36.158.251:4000/ws',
      discoverRemoteIdentity: false,
      remoteIdentity: remoteIdentity,
      session: Math.random().toString(36).slice(2)
    }),
    config: config
  })

  //window.party = party
  await party.start()

  console.log('started')

  await party.comms.authorized()

  console.log('authed')

  timeTopic = new party.ROSLIB.Topic({
    ros : party.comms.ros,
    name : '/time/abc123',
    messageType: 'number'
  })


  timeTopic.subscribe((msg)=>{
    console.log(timeTopic.name, msg)
  })


  let text = makeid(50*1024)

  let first = true

  async function onTimeout(){

    let num = first ? 2:1

    first = false

    let statusId = 'publish:'+timeTopic.name+':'+ (party.comms.ros.idCounter+num)

    
    party.comms.once(statusId,(status)=>{
      
      setTimeout(onTimeout, 0)
    })

    console.log('publishing')
    
    await timeTopic.publish({number: Date.now(), text:text})
    

  }

  //window.onTimeout = onTimeout

  onTimeout()

}



main().catch(err=>{
  console.error(err)
})
