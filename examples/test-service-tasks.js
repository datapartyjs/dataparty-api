const Path = require('path')
const debug = require('debug')('test.server-db')
const Dataparty = require('../src')

const BouncerServerModels = require('@dataparty/bouncer-model')
const BouncerClientModels = require('@dataparty/bouncer-model/dist/bouncer-model.json')

class ExampleTaskService extends Dataparty.IService {
  constructor(opts){
    super(opts)

    this.addTask(Path.join(__dirname,'./tasks/status-display.js'))
  }

}

async function main(){

  
  //const uri = 'mongodb://localhost:27017/server-party-test'
  //debug('db location', uri)

  const path = '/data/datparty/srv-party'

  let party = new Dataparty.TingoParty({
    path,
    model: BouncerClientModels,
    serverModels: BouncerServerModels,
    config: new Dataparty.Config.JsonFileConfig({basePath: '/data/datparty/'})
  })

  const service = new ExampleTaskService({ name: '@dataparty/task-example', version: '0.0.1' })

  const build = await service.compile(Path.join(__dirname,'/dataparty'), true)

  debug('built', Object.keys(build))

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
  
  //process.exit()
}



main().catch(err=>{
  console.error(err)
})
