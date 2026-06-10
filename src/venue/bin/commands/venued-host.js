const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venued.host')
const Path = require('path')
const OS = require('os')
const fs = require('fs')

const { execSync } = require('child_process')

const Dataparty = require('../../../../')

const HOMEDIR = OS.homedir()
const DEFAULT_FOLDER = (HOMEDIR.indexOf('opt')==-1) ? '.venued' : ''
const DEFAULT_PATH = Path.join( HOMEDIR, DEFAULT_FOLDER )


const DEFINITION = {
  h: {
    description: 'Show help',
    alias: 'help',
    type: 'help'
  },
  p: {
    alias: 'path',
    description: 'venued path',
    default: DEFAULT_PATH
  },
  l: {
    alias: 'listen',
    description: 'listen uri this can be an https:// with any local IP or file:/// to use a Unix socket',
    default: 'https://0.0.0.0:3000'
  },
  k: {
    alias: 'ssl-key',
    description: 'SSL key in pem format',
    default: Path.join(DEFAULT_PATH, 'key.pem')
  },
  c: {
    alias: 'ssl-cert',
    description: 'SSL Certificate in pem format',
    default: Path.join(DEFAULT_PATH, 'cert.pem')
  },
  A: {
    alias: 'allow-ip',
    description: 'IP to add to allow list',
    multiple: true
  },
  'db-type': {
    description: 'Type of database',
    valid: ['tingo', 'loki', 'mongo', 'peer'],
    default: 'tingo'
  },
  'db-uri': {
    description: 'url to connect to database',
    default: Path.join(DEFAULT_PATH, 'db/')
  },
  'db-peer': {
    description: 'Peer database identity hash'
  },
  'service-code': {
    description: 'path to service implementation',
    default: Path.join(__dirname, '../../venue-service.js')
  },
  'service-build': {
    description: 'path to service build',
    default: Path.join(__dirname, '../../dataparty/@dataparty-venue.service.venue.json')
  },
  'full-errors': {
    description: 'full server side error messages sent to client',
    type:'boolean',
    default: false
  },
  i2p: {
    description: 'Enable i2p hosting',
    type: 'boolean',
    default: false
  },
  'i2p-host':{
    default: '127.0.0.1'
  },
  'i2p-port': {
    default: 7656
  },
  'trust-proxy': {
    type: 'boolean',
    default: false
  }
}

function getPartyByType(type){
  if(type == 'tingo'){
    return Dataparty.TingoParty
  }
}

class VenuedHost extends CmdTree.Command {
  constructor(context){
    super({...VenuedHost.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'host'
  }
  
  static get Definition(){
    return {
      usage: `venued host [options]`,
      description: 'Start the hosting venued',
      definition: DEFINITION
    }
  }
  
  async run({parsed}){
    //debug('context -', this.context)
    //debug('parsed -', parsed)
    
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }

    /*if (!parsed.name){
      throw new CmdTree.Error.UsageError('no name provided')
    }*/

    
    const ServiceCode = require(parsed['service-code'])
    const ServiceBuild = require(parsed['service-build'])
    const ServiceSchema = {
      package: ServiceBuild.package,
      ...ServiceBuild.schemas
    }
    
    const PARTY = getPartyByType(parsed['db-type'])

    const config = new Dataparty.Config.JsonFileConfig({basePath: parsed.path})

    await config.start()

    //if(parsed['db-uri'][0] == '/'){
      config.touchDir( 'db' )
    //}

    const party = new PARTY({
      path: parsed['db-uri'],
      model: ServiceSchema,
      config: config,
      noCache: false
    })

    const service = new ServiceCode( ServiceSchema.package, ServiceBuild )

    debug('loaded service')

    debug('party db location', parsed['db-uri'])

    const CustomIpFilter = {
      options: {
        mode: 'allow',
        //trustProxy: true
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
        '2c0f:f248::/32',
        '10.115.68.55/32' //!
      ]
    }

    if(parsed['allow-ip']){
      for(let ip of parsed['allow-ip']){
        CustomIpFilter.ips.push(ip)
      }
    }
    

    const runner = new Dataparty.ServiceRunnerNode({
      party, service,
      sendFullErrors: parsed['full-errors'],
      useNative: false,
      prefix: 'venue/'
    })
    

    let runnerRouter = new Dataparty.RunnerRouter(runner)

    if(!fs.existsSync(parsed['ssl-key'])){
      execSync('openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=example.com"',
        {cwd: parsed.path}
      )
    }

    const ssl_key  = fs.readFileSync( parsed['ssl-key'], 'utf8')
    const ssl_cert = fs.readFileSync( parsed['ssl-cert'], 'utf8')

   

    if(parsed.i2p && !await config.read('i2p.sam')){
      debug('i2p - creating key')

      const SAM = require('@diva.exchange/i2p-sam')

      const i2pSettings = {
        sam: {
          host: parsed['i2p-host'],
          portTCP: parsed['i2p-port'],
        },
        session: {
          options: 'i2cp.leaseSetEncType=6,4'
        }
      }

      let i2p = await SAM.createLocalDestination(i2pSettings)


      await Promise.all([
        config.write('i2p.address', i2p.address),
        config.write('i2p.sam.publicKey', i2p.public),
        config.write('i2p.sam.privateKey', i2p.private),
      ])

      await config.save()
    }

    const host = new Dataparty.ServiceHost({
      runner: runnerRouter,
      trust_proxy: parsed['trust-proxy/'],
      wsEnabled: true,
      ssl_key, ssl_cert,
      listenUri: parsed.listen,
      staticPath: Path.join(__dirname,'../../public'),
      staticPrefix: '/venue/',
      ipFilter: CustomIpFilter,
      i2pEnabled: parsed.i2p,
      i2pSamHost: parsed['i2p-host'],
      i2pSamPort: parsed['i2p-port'],
      i2pForwardHost: '127.0.0.1',
      i2pForwardPort: 3000,
      //i2pOptions: 'i2cp.leaseSetEncType=6,4',
      i2pOptions: 'i2cp.leaseSetEncType=4,0',
      i2pKey: await config.read('i2p.sam')
    })

    await party.start()
    await runner.start()
    await host.start()
  
    debug('started')
    console.log('partying')
    console.log('\t', parsed.listen)

    const i2pAddress = await config.read('i2p.address')
    if(i2pAddress){
      console.log('\t', i2pAddress)
    }

    //console.log(Path.join(__dirname,'../public'))

    this.context.exiting = false

    return
  }
}

module.exports = VenuedHost