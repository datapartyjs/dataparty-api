const Path = require('path')
const debug = require('debug')('test.server-db')
const Dataparty = require('../src')

class ExampleTaskService extends Dataparty.IService {
  constructor(opts){
    super(opts)

    this.addTask(Path.join(__dirname,'./tasks/status-display.js'))
  }

}

async function main(){

  
  const service = new ExampleTaskService({ name: '@dataparty/task-example', version: '0.0.1' })

  const build = await service.compile(Path.join(__dirname,'/dataparty'), true)

  debug('built', Object.keys(build))

  const path = '/data/dataparty/srv-party'

  let party = new Dataparty.TingoParty({
    path,
    model: build,
    config: new Dataparty.Config.JsonFileConfig({basePath: path})
  })


  const runner = new Dataparty.ServiceRunnerNode({
    party, service,
    sendFullErrors: false,
    useNative: true
  })
  
  const host = new Dataparty.ServiceHost({
    runner,
    trust_proxy: true,
    wsEnabled: true,
    listenUri: 'http://localhost:8080'
  })

  await party.start()
  await runner.start()
  await host.start()

  console.log('started')
  
}



main().catch(err=>{
  console.error(err)
})
