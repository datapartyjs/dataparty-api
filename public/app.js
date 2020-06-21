const config = new DataParty.Config.LocalStorageConfig({
  cloud: {
    uri: 'http://localhost:4001'
  }
})

const party = new DataParty.CloudParty({
  config, 
})

class DeltaTime {
  constructor(){
    this.startMs = null
    this.endMs = null
    this.deltaMs = null
  }

  start(){
    this.startMs = (new Date).getTime()
  }

  end(){
    this.endMs = (new Date).getTime()

    this.deltaMs = this.endMs - this.startMs 
  }

}

async function main(){

  try{
    await party.start()
    console.log('party started')
  }
  catch(err){
    console.log('crash', err)
  }

  //const identityReply = await party.comms.call('identity', undefined, true)
  
  let firstCallTime = new DeltaTime()

  firstCallTime.start()

  const echoReply = await party.comms.call('echo', {t:(new Date()).getTime()}, {
    expectClearTextReply: true,
    sendClearTextRequest: true,
    useSessions: false
  })

  firstCallTime.end()

  console.log('server key', party.comms.remoteIdentity)
  console.log('echo response', echoReply)
  console.log('first call time', firstCallTime)

  let complete = 0

  setInterval(async ()=>{
    //console.log('send')


    let callTime2 = new DeltaTime()

    callTime2.start()

    const echoReply2 = await party.comms.call('secure-echo', {t:(new Date()).getTime()}, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: false
    })

    callTime2.end()
    complete++

    const text = `call deltaMs=<i>${callTime2.deltaMs}</i>ms complete ${complete}` 
    document.getElementById("secure-echo-speed").innerHTML = text    

  }, 250)

  
  setInterval(async ()=>{
    //console.log('send')


    let callTime2 = new DeltaTime()

    callTime2.start()

    const echoReply2 = await party.comms.call('echo', {t:(new Date()).getTime()}, {
      expectClearTextReply: true,
      sendClearTextRequest: true,
      useSessions: false
    })

    callTime2.end()
    complete++

    const text = `call deltaMs=<i>${callTime2.deltaMs}</i>ms complete ${complete}` 
    document.getElementById("echo-speed").innerHTML = text    

  }, 100)
  
}


main().then(console.log).catch(console.log)