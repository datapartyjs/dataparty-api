const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.project-build')
const Path = require('path')
const OS = require('os')
const fs = require('fs')
const mkdirp = require('mkdirp')
const createCert = require('create-cert')

const prompt = require('prompt')
const argon2 = require('argon2')
const SAM = require('@diva.exchange/i2p-sam')

const reach = require('../../../utils/reach')

const { execSync } = require('child_process')

const {
  globSync
} = require('glob')
const tar = require('tar')


const Dataparty = require('../../../../src/index')
const dataparty_crypto = require('@dataparty/crypto')
const Joi = require('joi')

const {Routines} = dataparty_crypto

const DEFINITION = {
  h: {
    description: 'Show help',
    alias: 'help',
    type: 'help'
  },
  o: {
    alias: 'output',
    type: 'string',
    default: Path.join(process.cwd(), 'dist/')
  },
  nopassword: {
    type: 'boolean',
    default: false
  },
  identity: {
    type: 'string',
    description: 'developer release identity',
    require: true
  },
  name: {
    description: 'project name'
  },
  version: {
    description: 'project version'
  },
  remote: {
    type: 'string',
    description: 'name of remote to build project for'
  },
  deploy: {
    type: 'boolean',
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
}


async function compressFiles(projectName, root, fileList, outputPath, writeFile){

  if(!fileList){ return }

  let fileMap={}

  let files = fileList.map(file=>{
    //
    const content = fs.readFileSync(file)
    const hash = dataparty_crypto.Routines.Utils.base64.encode(
      dataparty_crypto.Routines.Utils.hash(content)
    )

    fileMap[file] = { hash, size: content.length }

    return hash
  })

  if(!files || files.length < 1){ return }

  const tarFileName = projectName.replace('/', '-')+'.project.files.venue.tgz'
  const tarPath = Path.join(outputPath, tarFileName)

  await tar.create({
    cwd: root,
    gzip: true,
    file: tarPath
  }, fileList)

  const staticTar = fs.readFileSync(tarPath)

  let tarHash = dataparty_crypto.Routines.Utils.hash( staticTar )
  let tarHash64 = dataparty_crypto.Routines.Utils.base64.encode(tarHash)

  const fileInfo = {
    [tarFileName]: {
      tar: tarFileName,
      hash:tarHash64,
      size: staticTar.length,
      files: fileMap
    }
  }

  return {tarPath, files: fileInfo}
}


class VenueProjectBuild extends CmdTree.Command {
  constructor(context){
    super({...VenueProjectBuild.Definition, context})
    debug('constructor')

    this.project = {}
    this.project_sources = []

    this.parsed = null
  }
  
  static get Command(){
    return 'project build'
  }
  
  static get Definition(){
    return {
      usage: `venue project build [project.json]`,
      description: 'Build a project',
      definition: DEFINITION
    }
  }

  async encryptToBase64(from, to, value){
    const msg = new dataparty_crypto.Message({msg: value})
    await msg.encrypt(from, to.key)

    const bsonMsg = msg.toBSON()
    const base64Msg = dataparty_crypto.Routines.Utils.base64.encode( bsonMsg )

    return base64Msg
  }

  async decryptFromBase64(privateIdentity, from, secureContentBase64OrBSON){
    const securePrivateBSON = (typeof secureContentBase64OrBSON) == 'string' ? Routines.Utils.base64.decode( secureContentBase64OrBSON ) : secureContentBase64OrBSON
    const securePrivateMsg = new dataparty_crypto.Message({})
    
    securePrivateMsg.fromBSON( securePrivateBSON )

    const securePrivateContent = await securePrivateMsg.decrypt( privateIdentity )


    if(securePrivateMsg.from.hash != from.key.hash){
      throw new Error('not expected sender')
    }

    return securePrivateContent
  }
  
  async saveSecret(path, from, to, value){
    debug('saveSecret - ', path)
    const secretB64 = await this.encryptToBase64(from, to, value)
    await this.context.secureConfig.write( path, secretB64 )

    return secretB64
  }

  async getOrGenerateSSLKey(owner, venue, projectName){
    const kvKey = 'secrets.' + owner.key.hash + '.' + venue.key.hash + '.' + projectName + '.ssl'
    

    let value = await this.context.secureConfig.read(kvKey)


    if(!value || true){
      // generate SSL secrets
      debug('creating ssl cert')
      // generate EC certificate with P-521 curve and SHA-512
      /*const pems = await selfsigned.generate([
          { name: 'commonName', value: 'localhost' }
        ], 
        {
          days: 365,
          keySize: 2048,
          algorithm: 'sha256'
        }
      )*/
      //const pems = require('openssl-self-signed-certificate')

      ///let sslGenCmd = 'openssl req -x509 -newkey rsa:2048 -keyout dist/'+projectName+'-key.pem -out dist/'+projectName+'-cert.pem -days 365 -nodes -addext "subjectAltName=DNS:localhost,DNS:10.88.200.159,IP:127.0.0.1"    '

      //let sslGenCmd = 'openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout dist/'+projectName+'-key.pem -out dist/'+projectName+'-cert.pem'
      ///sslGenCmd += ' -subj "/C=AU/ST=NSW/L=Sydney/O=DataParty/OU=root/emailAddress=self@localhost"'

      //console.log(sslGenCmd)

      //const output = execSync(sslGenCmd, { encoding: 'utf8' })
      execSync('openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout dist/'+projectName+'-key.pem -out dist/'+projectName+'-cert.pem  -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=example.com"')

      //console.log(output)

      const sslKey = fs.readFileSync('dist/'+projectName+'-key.pem', 'utf8')
      const sslCert = fs.readFileSync('dist/'+projectName+'-cert.pem', 'utf8')


      value = await this.saveSecret(kvKey, owner, owner, {
        key: sslKey,
        cert: sslCert,
        //fingerprint: pems.fingerprint,
        //public: pems.public

      })
    } else {
      debug('found ssl cert')
    }
  

    return await this.decryptFromBase64(owner, owner, value)
  }

  async getOrGenerateIdentity(owner, venue, projectName, partyName){
    const kvKey = 'secrets.' + owner.key.hash + '.' + venue.key.hash + '.' + projectName + '.' + partyName + '.identity'

    let value = await this.context.secureConfig.read(kvKey)

    if(true){
      // generate secret
      const identity = await dataparty_crypto.Identity.fromRandomSeed({id: projectName +'.'+partyName })

      value = await this.saveSecret(kvKey, owner, owner, identity.toBSON(true))
    }

    return dataparty_crypto.Identity.fromBSON(await this.decryptFromBase64(owner, owner, value))
  }

  async getOrStoreMongoUri(owner, venue, projectName, partyName, uri){
    const kvKey = 'secrets.' + owner.key.hash + '.' + venue.key.hash + '.' + projectName + '.' + partyName + '.mongo'

    let value = await this.context.secureConfig.read(kvKey)

    if(!value){
      value = await this.saveSecret(kvKey, owner, owner, uri)
    }

    return await this.decryptFromBase64(owner, owner, value)
  }

  async getOrGenerateI2PKey(owner, venue, projectName){
    const kvKey = 'secrets.' + owner.key.hash + '.' + venue.key.hash + '.' + projectName + '.i2p'

    let value = await this.context.secureConfig.read(kvKey)

    if(!value){
      // generate secret

      const i2pSettings = {
        sam: {
          host: this.parsed['i2p-host'],
          portTCP: this.parsed['i2p-port'],
        },
        session: {
          options: 'i2cp.leaseSetEncType=6,4'
        }
      }

      let i2p = await SAM.createLocalDestination(i2pSettings)

      value = await this.saveSecret(kvKey, owner, owner, {
        address: i2p.address,
        public: i2p.public,
        private: i2p.private,
        session_options: 'i2cp.leaseSetEncType=6,4'
      })

      i2p.close()
    }

    return await this.decryptFromBase64(owner, owner, value)
  }
  
  async run({parsed}){
    //debug('context -', this.context)
    //console.log('parsed -', parsed)
    this.parsed = parsed
    
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }

    if (parsed._.length != 3){
      throw new CmdTree.Error.UsageError('You must supply project json/js')
    }

    const keyName = parsed.identity

    const phrase = await this.context.secureConfig.read('identity.'+keyName+'.phrase')

    if(!phrase){
      throw new CmdTree.Error.UsageError("Key doesn't exist!")
    }

    const {password} = parsed.nopassword ? {password:null} : await prompt.get({
            properties: {
                password: {
                    message: 'Enter password for identity['+keyName+']',
                    hidden: true
            }
        }})

    let key = await dataparty_crypto.Identity.fromMnemonic(phrase, password, argon2)

    key.id = keyName

    const projectJsonPath =  Path.resolve(parsed._[2])

    /*let foundUp = findUp('package.json', Path.dirname(serviceClassPath))

    let pkgJson = foundUp.content*/

    let projectJson = require( projectJsonPath )

    
    const remoteName = parsed.remote || projectJson.venue
    const remote = await this.context.secureConfig.read('remote.'+remoteName)

    if(!remote){
      throw new CmdTree.Error.UsageError('Invalid remote ['+remoteName+']')
    }

    const project = {
      owner: key.key.hash,
      //created: Date.now(),

      name: parsed.name ? parsed.name : projectJson.name,
      version: parsed.version ? parsed.version : projectJson.version,

      venue: remote.identity.key.hash,
      domain: projectJson.domain,

      data: {
        copyPrevious: reach(projectJson, 'data.copyPrevious', true)
      },

      hosting: {
        http: undefined,
        i2p: undefined,
        p2p: reach(projectJson, 'hosting.p2p'),
        ble: reach(projectJson, 'hosting.ble')
      },

      party: [],
      routes: projectJson.routes,
      files: projectJson.files

    }

    if(reach(projectJson, 'hosting.http', false)){
      let { generateSSLKey, ...httpConfig } = reach(projectJson, 'hosting.http')

      if((generateSSLKey && !httpConfig.secureSSL) || true){
        httpConfig.secureSSL = await this.encryptToBase64(
          key,
          remote.identity,
          await this.getOrGenerateSSLKey( key, key, projectJson.name )
        )
      }

      project.hosting.http = httpConfig
    }

    if(reach(projectJson, 'hosting.i2p', false)){
      let { generateSSLKey, ...i2pConfig } = reach(projectJson, 'hosting.i2p')

      if(generateSSLKey && !i2pConfig.secureKey){
        i2pConfig.secureKey = await this.encryptToBase64(
          key,
          remote.identity,
          await this.getOrGenerateI2PKey( key, key, projectJson.name )
        )
      }

      project.hosting.i2p = i2pConfig
    }

    reach(projectJson, 'party', []).forEach( async partyDesc=>{
      let needsKey = reach(partyDesc, 'key.generateKey', false) || reach(partyDesc, 'key', null) == null || true
      let needsSecureMongo = reach(partyDesc, 'mongo.uri', null) != null

      let obj = {...partyDesc}

      if(needsKey){
        debug('creating party key [', partyDesc.name, ']')

        const partyPrivateId = await this.getOrGenerateIdentity( key, key, projectJson.name, partyDesc.name )
        
        obj.key = {
          hash: partyPrivateId.key.hash,
          securePrivate: await this.encryptToBase64(
            key,
            remote.identity,
            partyPrivateId.toJSON(true)
          )
        }

      }

      if(needsSecureMongo){
        debug('securing mongo.uri [', partyDesc.name, ']')
        obj.mongo = {
          mongoOptions: reach(partyDesc, 'mongo.options', null),
          secureUri: await this.encryptToBase64(
            key,
            remote.identity,
            await this.getOrStoreMongoUri(key, key, projectJson.name, partyDesc.name, reach(partyDesc, 'mongo.uri', null))
          )
        }
      }

      project.party.push( obj )
    })

    await mkdirp(parsed.output)

    const buildOutput = parsed.output+'/'+ project.name.replace('/', '-') +'.project.venue.json'


    let prjFiles = []
    prjFiles.push(buildOutput)

    if(project.files){
      this.addProjectFiles(
        Path.dirname(projectJsonPath),
        projectJson.files,
        { nodir: true, follow: true }
      )

      const {tarPath, files} = await compressFiles(project.name,Path.dirname(projectJsonPath), this.project_sources.files, parsed.output, true)
      
      project.files = files

      if(tarPath){prjFiles.push(tarPath)}

      
    }

    const ownerSig = await key.sign( project, true )

    project.signatures = {
      [key.key.hash]: dataparty_crypto.Routines.Utils.base64.encode(ownerSig.sig)
    }
    
    fs.writeFileSync(buildOutput, JSON.stringify(project, null,2))

    let staticTar = undefined
    
    if(prjFiles.length == 2){
      staticTar = fs.readFileSync(prjFiles[ prjFiles.length - 1 ])
    }

    await this.pushProject(key, remote, project, staticTar)

    return {files: prjFiles, project}
  }


  addProjectFiles(root, pattern, options){

    let result = globSync(pattern, {
      dotRelative: true,
      cwd:root,
      ...options
    })

    if(!this.project_sources.files){
      this.project_sources.files = result
    } else {
      this.project_sources.files = this.project_sources.files.concat(result)
    }
    
    this.project_sources.files_root = root

    debug('addFiles',result)

  }

  async pushProject(devId, remote, build, staticTar=null){
  
      let client = new Dataparty.EphemeralClient({
        identity: devId,
        urlOrParty: remote.url,
        wsUrlOrParty: remote.ws,
        allowSelfSigned: remote.allowSelfSigned
      })
  
      await client.start()
  
  
      let uploadResult = await client.restParty.comms.call('create-project', {project:build, staticTar}, {
        expectClearTextReply: false,
        sendClearTextRequest: false,
        useSessions: true
      })
  
      console.log('result', uploadResult)
    }
}

module.exports = VenueProjectBuild


