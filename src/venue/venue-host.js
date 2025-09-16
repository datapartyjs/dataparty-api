const fs = require('fs')
const Path = require('path')
const debug = require('debug')('venue.host')
const Dataparty = require('../index')

const VenueService = require('./venue-service')

const VenueServiceSchema = require('./dataparty/@dataparty-venue.dataparty-schema.json')
const VenueSrv = require('./dataparty/@dataparty-venue.dataparty-service.json')


async function loadService(runnerRouter, settings, serviceFilePath){

  debug('addService', settings, serviceFilePath)

  const { enabled, workspace, domain, prefix, sendFullErrors, useNative, defaultConfig } = settings

  if(!enabled){ return }

  const serviceFile = JSON.parse( fs.readFileSync( serviceFilePath ) )

  let party = new Dataparty.TingoParty({
    path: workspace+'/db',
    model: serviceFile.schemas,
    config: new Dataparty.Config.JsonFileConfig({basePath: workspace+'/config', ...defaultConfig}),
    noCache: false
  })
  
  party.topics = new Dataparty.LocalTopicHost()
  
  const service = new Dataparty.IService(serviceFile.package, serviceFile)

  debug('loaded service')

  debug('party db location', workspace)

  let runner = new Dataparty.ServiceRunnerNode({
    party, service,
    sendFullErrors,
    useNative,
    prefix
  })

  await party.start()
  await runner.start()
  
  await runnerRouter.addRunner({domain, runner})

}


async function main(){

  const path = '/data/dataparty/venue-service'

  const CloudFlareIpFilter = {
    options: {
      mode: 'allow'
    },
    ips: [
      '173.245.48.0/20',
      '103.21.244.0/22',
      '103.22.200.0/22',
      '103.31.4.0/22',
      '141.101.64.0/18',
      '108.162.192.0/18',
      '190.93.240.0/20',
      '188.114.96.0/20',
      '197.234.240.0/22',
      '198.41.128.0/17',
      '162.158.0.0/15',
      '104.16.0.0/13',
      '104.24.0.0/14',
      '172.64.0.0/13',
      '131.0.72.0/22',
      '2400:cb00::/32',
      '2606:4700::/32',
      '2803:f800::/32',
      '2405:b500::/32',
      '2405:8100::/32',
      '2a06:98c0::/29',
      '2c0f:f248::/32'
    ]
  }

  let party = new Dataparty.TingoParty({
    path: path+'/db',
    model: VenueServiceSchema,
    config: new Dataparty.Config.JsonFileConfig({basePath: path+'/config'}),
    noCache: false
  })

  const service = new VenueService(VenueServiceSchema.package, VenueSrv)


  debug('loaded service')

  debug('party db location', path)

  const runner = new Dataparty.ServiceRunnerNode({
    party, service,
    sendFullErrors: true,
    useNative: false,
    prefix: 'api/'
  })
  
  let runnerRouter = new Dataparty.RunnerRouter(runner)

  const ssl_key  = fs.readFileSync( Path.join(__dirname,'key.pem'), 'utf8')
  const ssl_cert = fs.readFileSync( Path.join(__dirname,'cert.pem'), 'utf8')
  
  const host = new Dataparty.ServiceHost({
    runner: runnerRouter,
    trust_proxy: true,
    wsEnabled: true,
    ssl_key, ssl_cert,
    listenUri: 'https://0.0.0.0:443',
    staticPath: Path.join(__dirname,'public'),
    staticPrefix: '/venue/',
    ipFilter: CloudFlareIpFilter
  })

  await party.start()
  await runner.start()
  await host.start()

  debug('started')
  console.log('partying')

  await loadService(runnerRouter, {
    enabled: true,
    domain: 'postquantum.one',
    prefix: 'api',
    workspace: '/data/dataparty/match-maker-service',
    sendFullErrors: true,
    useNative: false

  }, '/home/ubuntu/match-maker/dataparty/@datapartyjs-match-maker.dataparty-service.json')
}



main().catch(err=>{
  console.error(err)
})
