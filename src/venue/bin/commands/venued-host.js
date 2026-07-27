const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venued.host')
const Path = require('path')
const OS = require('os')
const fs = require('fs')
const zlib = require('zlib')
const { execSync } = require('child_process')

const Router = require('origin-router').Router

const Dataparty = require('../../../../')
const reach = require('../../../utils/reach')

const dataparty_crypto = require('@dataparty/crypto')
const {Routines} = dataparty_crypto
const express = require('express')

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
  'iot': {
    type: 'boolean',
    default: false
  },
  'cloud': {
    type: 'boolean',
    default: false
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
  } else if (type == 'zango'){
    return Dataparty.ZangoParty
  } else if (type == 'loki'){
    return Dataparty.LokiParty
  } else if (type == 'peer'){
    return Dataparty.PeerClient
  } else if (type == 'mongo'){
    return Dataparty.MongoParty
  }

  return null
}

async function constructParty(type, projectPartyDesc, config, model){
  debug('constructParty', type)
  const PARTY_CLASS = getPartyByType(type)
  if(type == 'loki'){

    const LokiAdapterTypes = {
      'memory': Dataparty.LokiParty.Loki.LokiMemoryAdapter,
      'fs': Dataparty.LokiParty.Loki.LokiFsAdapter,
      'lfsa': Dataparty.LokiParty.Loki.LokiFsStructuredAdapter,
      'localstorage': Dataparty.LokiParty.Loki.LokiLocalStorageAdapter // this probably doesn't work in nodejs
    }

    let {path, dbAdapter, ...otherOptions} = projectPartyDesc.loki
    let dbAdapterImpl = LokiAdapterTypes[dbAdapter || 'lfsa']

    if(dbAdapter == 'fs' || dbAdapter == 'lfsa'){
      await config.touchDir('db')
      path = config.filePath( Path.join('db', path || 'data.loki.db') )
    }
    

    return new PARTY_CLASS({
      path,
      dbAdapter: dbAdapterImpl,
      config,
      model,
      ...otherOptions,
      ...projectPartyDesc.settings
    })
  } else if (type == 'zango'){
    const {dbname, ...otherOptions} = projectPartyDesc.zango

    return new PARTY_CLASS({
      dbname,
      config,
      model,
      ...otherOptions,
      ...projectPartyDesc.settings
    })
  } else if (type == 'tingo'){
    const {path, ...otherOptions} = projectPartyDesc.tingo || { path: 'db'}

    await config.touchDir(path)

    return new PARTY_CLASS({
      path: config.filePath(path ),
      config,
      model,
      ...otherOptions,
      ...projectPartyDesc.settings
    })
  } else if (type == 'peer'){
    return Dataparty.PeerClient
  } else if (type == 'mongo'){
    const {uri, secureUri, ...otherOptions} = projectPartyDesc.mongo

    return new PARTY_CLASS({
      uri,
      config,
      model,
      ...otherOptions,
      ...projectPartyDesc.settings
    })
  }
}

class VenuedHost extends CmdTree.Command {
  constructor(context){
    super({...VenuedHost.Definition, context})
    debug('constructor')

    this.active_projects = {}

    this.party = null
    this.config = null
    this.runner = null
    this.runnerRouter = null
    this.host = null
    this.mode = 'cloud'
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

    this.parsed = parsed
    
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }

    if (parsed.cloud == true && parsed.iot == true){
      throw new CmdTree.Error.UsageError('cannot specify both --cloud and --iot at the same time')
    }

    if (!parsed.cloud && !parsed.iot){
      throw new CmdTree.Error.UsageError('you must specifiy an operating mode using --cloud or --iot')
    }

    if(parsed.cloud){
      this.mode = 'cloud'
    } else if(parsed.iot){
      this.mode = 'iot'
    }

    
    const ServiceCode = require(parsed['service-code'])
    const ServiceBuild = require(parsed['service-build'])
    const ServiceSchema = {
      package: ServiceBuild.package,
      ...ServiceBuild.schemas
    }
    
    const PARTY = getPartyByType(parsed['db-type'])

    this.config = new Dataparty.Config.JsonFileConfig({basePath: parsed.path})

    await this.config.start()

    //if(parsed['db-uri'][0] == '/'){
      this.config.touchDir( 'db' )
    //}

    this.party = new PARTY({
      path: parsed['db-uri'],
      model: ServiceBuild,
      config: this.config,
      noCache: false
    })

    this.party.topics = new Dataparty.LocalTopicHost()

    this.party.helpers = {
      unloadProject: this.unloadProject.bind(this),
      loadProject: this.loadProject.bind(this)
    }

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
   
    
    if(!fs.existsSync(parsed['ssl-key'])){
      execSync('openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=example.com"',
        {cwd: parsed.path}
      )
    }

    const ssl_key  = fs.readFileSync( parsed['ssl-key'], 'utf8')
    const ssl_cert = fs.readFileSync( parsed['ssl-cert'], 'utf8')


    this.runner = new Dataparty.ServiceRunnerNode({
      party: this.party, service,
      sendFullErrors: parsed['full-errors'],
      useNative: false,
      prefix: this.mode == 'cloud' ? 'venue/' : '/'
    })
    

    this.runnerRouter = new Dataparty.RunnerRouter(this.runner)


   

    if(parsed.i2p && !await this.config.read('i2p.sam')){
      debug('i2p - creating key')

      const SAM = require('@diva.exchange/i2p-sam')

      const i2pSettings = {
        sam: {
          host: parsed['i2p-host'],
          portTCP: parsed['i2p-port'],
        },
        session: {
          options: 'i2cp.leaseSetEncType=6,4'
          //options: 'i2cp.leaseSetEncType=4'
        }
      }

      let i2p = await SAM.createLocalDestination(i2pSettings)


      await Promise.all([
        this.config.write('i2p.address', i2p.address),
        this.config.write('i2p.sam.publicKey', i2p.public),
        this.config.write('i2p.sam.privateKey', i2p.private),
      ])

      await this.config.save()
    }

    this.host = new Dataparty.ServiceHost({
      runner: this.runnerRouter,
      trust_proxy: parsed['trust-proxy/'],
      wsEnabled: true,
      wsUpgradePath: '/ws',
      ssl_key, ssl_cert,
      listenUri: parsed.listen,
      staticPath: Path.join(__dirname,'../../public'),
      staticPrefix: this.mode =='cloud' ? '/venue/' : '/',
      ipFilter: this.mode == 'cloud' ? CustomIpFilter : null,
      i2pEnabled: parsed.i2p,
      i2pSamHost: parsed['i2p-host'],
      i2pSamPort: parsed['i2p-port'],
      i2pForwardHost: '127.0.0.1',
      i2pForwardPort: '3000',
      i2pOptions: 'i2cp.leaseSetEncType=6,4',
      //i2pOptions: 'i2cp.leaseSetEncType=4',
      i2pKey: await this.config.read('i2p.sam')
    })

    await this.party.start()
    await this.runner.start()
    await this.host.start()
  
    debug('started')
    console.log('partying')
    console.log('\t', parsed.listen)

    const i2pAddress = await this.config.read('i2p.address')
    if(i2pAddress){
      console.log('\t', i2pAddress)
    }

    /**
     * config section
     * 
     * projects: {
     *    [name]: latest-hash
     * }
     */

    const projects = await this.config.read('projects')

    if(projects){
      for(let name in projects){

        const hash = projects[name]
        console.log('\tloading project', name, hash)
        
        await this.loadProject(hash, name)
      }
    }

    

    this.context.exiting = false

    return
  }

  async unloadProject(hash){

    debug('unloadProject', hash)

    if(!this.active_projects[hash]){
      debug('\t','project already unloaded')
      return
    }

    // stop mmClient
    // stop p2pHost
    // stop host
    // stop runner[ * ]
    // stop party[ * ]

    if(this.mode == 'cloud' && this.active_projects[hash].project.data.project.domain){
      this.runnerRouter.removeRunnerByDomain( this.active_projects[hash].project.data.project.domain )
    }

    if(this.active_projects[hash].mmClient){
      debug('\t','stopping mmClient')
      await this.active_projects[hash].mmClient.stop()

      this.active_projects[hash].mmClient = null
    }

    if(this.active_projects[hash].p2pHost){
      debug('\t','stopping p2pHost')
      await this.active_projects[hash].p2pHost.stop()

      this.active_projects[hash].p2pHost = null
    }

    if(this.active_projects[hash].host){
      debug('\t','stopping http host')
      await this.active_projects[hash].host.stop()

      this.active_projects[hash].host = null
    }

    for(let runnerPrefix in this.active_projects[hash].runner){
      debug('\t','stopping route [', runnerPrefix ,']')
      await this.active_projects[hash].runner[runnerPrefix].stop()

      this.active_projects[hash].runner[runnerPrefix] = null
      delete this.active_projects[hash].runner[runnerPrefix]
    }

    for(let partyName in this.active_projects[hash].party){
      debug('\t','stopping party [', partyName ,']')
      const partyId = this.active_projects[hash].party[partyName].identity.key.hash
      await this.active_projects[hash].party[partyName].stop()

      this.active_projects[hash].party[partyName] = null
      delete this.active_projects[hash].party[partyName]

      if(this.mode == 'cloud'){
        this.runnerRouter.removeRunnerByHostIdentity( partyId )
      }
    }

    this.active_projects[hash] = null
    delete this.active_projects[hash]
  }

  async loadProject(hash, name){
    // if first run
    //   if previosHash exists && data.copyPrevious==true copy previous party config's & db's
    //   setup project
    //   if previous.isRunning then previous.unload()
    // launch

    const safeProjectHash = hash.replace(/\//g, "-").replace(/=/g, "_")


    const project = (await this.party.find()
        .type('venue_project')
        .where('project.name').equals(name)
        .where('hash').equals(safeProjectHash).exec())[0]


    if(!project){
      return
    }
    const workspace = project.data.workspace

    if(project.data.hash != safeProjectHash){
      console.log(`wrong hash got [ ${project.data.hash} ] when expecting [ ${safeProjectHash} ]`)
      throw 'project hash mix up'
    }

    console.log('workspace', workspace)

    //process.exit()

    let projectRouter = new Router()

    const projectSSL = await this.decryptSecret(reach(project, 'data.project.hosting.http.secureSSL'))
    const projecti2pKey = await this.decryptSecret(reach(project, 'data.project.hosting.i2p.secureKey'))

    console.log(projectSSL)

    let projectRunner = null
    this.active_projects[hash] = {
      project,
      party: {},
      runner: {},
      host: null
    }

    //! load parties and put them in projectParties map
    let projectParties = {}
    let projectPartiesDescs = {}
    for(let projectPartyDesc of project.data.project.party){
      const partyWorkspace = Path.join(workspace, 'party', projectPartyDesc.name)
      const partyConfig = new Dataparty.Config.JsonFileConfig({basePath: partyWorkspace})

      let configFirstRun = !fs.existsSync( partyWorkspace+'/config.json' )

      await partyConfig.start()

      if(configFirstRun){
        if(projectPartyDesc.defaultConfig) { await partyConfig.writeAll(projectPartyDesc.defaultConfig) }
      }

      await partyConfig.touchDir( 'db' )

      const payload = await this.decryptSecret( projectPartyDesc.key.securePrivate )

      debug('payload', payload)

      const projectPartyIdentity = dataparty_crypto.Identity.fromJSON( payload )

      let projectParty = await constructParty( projectPartyDesc.db, projectPartyDesc, partyConfig )

      await projectParty.setIdentity( projectPartyIdentity )

      projectParties[ projectPartyDesc.name ] = projectParty
      projectPartiesDescs[ projectPartyDesc.name ] = projectPartyDesc

      await projectParty.start()

    }

    this.active_projects[hash].party = projectParties
    
    for(let route of project.data.project.routes){

      if(!route.package){continue}
      console.log('route', route.package.name)
      let pkgDoc = (await this.party.find()
        .type('venue_pkg')
        .or()
        .where('package.name').equals(route.package.name)
        .where('package.githash').equals(route.package.githash)
        .sort('-created')
        .limit(1)
        .exec())[0]
      
      if(!pkgDoc){
        throw new Error(`package ${JSON.stringify(route.package)} not found. required by ${route.prefix}`)
      }

      const {compressedBuild, ...printablePkg} = pkgDoc.data

      console.log('found package', printablePkg)

      const serviceFile = JSON.parse(
        zlib.brotliDecompressSync(
          Routines.Utils.base64.decode( compressedBuild )
        )
      )

      const ServiceSchema = {
        package: serviceFile.package,
        ...serviceFile.schemas
      }

      console.log('decompressed', serviceFile.package)

      let serviceParty = null;


      if(route.party == 'SYSTEM'){
        serviceParty = this.party
      } else if( projectParties[route.party] ){
        serviceParty = projectParties[route.party]

        await serviceParty.factory.addModels(ServiceSchema)

        debug('patching in validators')
        const partyType = projectPartiesDescs[route.party].db

        if(['loki','tingo'].indexOf(partyType) > -1){
          
          for(const collectionName of serviceParty.factory.getValidators()){

            debug('creating collection', collectionName)
            
            const indexSettings = reach(serviceParty.factory, 'schemas.IndexSettings.'+collectionName)
            await serviceParty.db.createCollection(collectionName, indexSettings)
          }
        } else if('mongo' == partyType){
          serviceParty.db.addBouncerModels(serviceParty.factory.model)
        } 
      }

      if(!serviceParty.topics){
        serviceParty.topics = new Dataparty.LocalTopicHost()
      }

      

      debug('loading service')
      const service = new Dataparty.IService(serviceFile.package, serviceFile)
      debug('loaded service')

      let routeRunner = new Dataparty.ServiceRunnerNode({
        party: serviceParty, service,
        router: projectRouter,
        sendFullErrors: route.settings.sendFullErrors,
        useNative: route.settings.useNative,
        prefix: route.prefix
      })

      if(route.party == 'SYSTEM'){
        //routeRunner.router = runner.router
      }

      
      await routeRunner.start()

      console.log('workspace', workspace)

      if(route.staticPath){
        const projectStaticPath = Path.join(workspace, route.staticPath)

        let handler =  (req,res)=>{
          
          let staticHandler = express.static(projectStaticPath, { index: ['index.html']})

          let results = staticHandler(req.request,req.response, req.request.next)

          console.log('returning results', Object.keys(req.request))

        

          console.log('sent already - headers?', req.response.headersSent)
          console.log('sent already - date?', req.response.sendDate)
          console.log('sent already - outputSize?', req.response.outputSize)

        }

        projectRouter.add('static-files1', Path.join(route.prefix, '/:path*'), handler)
        projectRouter.add('static-files2', Path.join(route.prefix, '/'), handler)
      }

      if(!projectRunner){
        projectRunner = routeRunner
      }

      this.active_projects[hash].runner[route.prefix] = routeRunner
      
    }

    if(this.mode == 'cloud'){

      debug('domain', project.data.project.domain, 'is null', projec==null)

      await this.runnerRouter.addRunner({
        domain: project.data.project.domain,
        runner: projectRunner
      })

    } else if(this.mode == 'iot'){

      this.active_projects[hash].host = new Dataparty.ServiceHost({
        cors: project.data.project.hosting.http.cors || {},
        runner: projectRunner,
        trust_proxy: project.data.project.hosting.http.trust_proxy,
        mdnsEnabled: project.data.project.hosting.http.mdnsEnabled,
        wsEnabled: project.data.project.hosting.http.wsEnabled,
        ssl_key: projectSSL.key,
        ssl_cert: projectSSL.cert,
        listenUri: project.data.project.hosting.http.listenUri,
        i2pEnabled: this.parsed.i2p,
        i2pSamHost: this.parsed['i2p-host'],
        i2pSamPort: this.parsed['i2p-port'],
        i2pForwardHost: '127.0.0.1',
        i2pForwardPort: '3000',
        i2pOptions: 'i2cp.leaseSetEncType=6,4',
        i2pKey: projecti2pKey
      })

      await this.active_projects[hash].host.start()
    }


  }

  async decryptSecret(secureContentBase64OrBSON, privateIdentity = null){

    if(!secureContentBase64OrBSON){ return null }

    if(!privateIdentity){ privateIdentity = this.party.privateIdentity }

    const securePrivateBSON = (typeof secureContentBase64OrBSON == 'string') ? Routines.Utils.base64.decode( secureContentBase64OrBSON ) : secureContentBase64OrBSON
    const securePrivateMsg = new dataparty_crypto.Message({})
    securePrivateMsg.fromBSON( securePrivateBSON )

    const securePrivateContent = await securePrivateMsg.decrypt( privateIdentity )
    return securePrivateContent
  }
}

module.exports = VenuedHost
