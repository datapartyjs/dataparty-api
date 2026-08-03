const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.package-build')
const Path = require('path')
const OS = require('os')
const fs = require('fs')
const mkdirp = require('mkdirp')

const prompt = require('prompt')
const argon2 = require('argon2')

const { execSync } = require('child_process')
const findUp = require('find-up-json').default


const Dataparty = require('../../../../')
const dataparty_crypto = require('@dataparty/crypto')

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
    //require: true
  },
  name: {
    description: 'package name'
  },
  version: {
    description: 'package version'
  },
  remote: {
    type: 'string',
    description: 'name of remote to build project for'
  },
  deploy: {
    type: 'boolean',
    default: false
  }
}


class VenuePackageBuild extends CmdTree.Command {
  constructor(context){
    super({...VenuePackageBuild.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'package build'
  }
  
  static get Definition(){
    return {
      usage: `venue package build [service-code.js]`,
      description: 'Build a package',
      definition: DEFINITION
    }
  }
  
  async run({parsed}){
    //debug('context -', this.context)
    //console.log('parsed -', parsed)
    
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }

    if (parsed._.length != 3){
      console.log('must supply service code')
      throw new CmdTree.Error.UsageError('You must supply service code')
    }

    const keyName = parsed.identity || process.env.VENUE_IDENTITY

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

    const serviceClassPath =  Path.resolve(parsed._[2])

    let foundUp = findUp('package.json', Path.dirname(serviceClassPath))

    let pkgJson = foundUp.content

    const ServiceClass = require( serviceClassPath )

    const service = new ServiceClass({
      name: parsed.name ? parsed.name : pkgJson.name,
      version: parsed.version ? parsed.version : pkgJson.version,
    })

    await mkdirp(parsed.output)

    const builder = new Dataparty.ServiceBuilder(service)
    const build = await builder.compile(parsed.output, true, key)

    const remoteName = parsed.remote || process.env.VENUE_REMOTE

    const pkgConfigPath = 'packages.'+build.build.package.name

    const pkgInfo = {
      package: build.build.package,
      files: build.files,
      remote: remoteName,
      deploy: parsed.deploy && remoteName
    }

    await this.context.secureConfig.write(pkgConfigPath, pkgInfo)

    if(parsed.deploy && remoteName){
      console.log('uploading...')
      
      const remote = await this.context.secureConfig.read('remote.'+remoteName)

      if(!remote){
        throw 'invalid remote ['+remoteName+']'
      }

      let staticTar = null

      if(build.files.length == 3){
        staticTar = fs.readFileSync(build.files[ build.files.length - 1 ])
      }
      
      await this.pushPackage(key, remote, build.build, staticTar)
    }

    return {files: build.files}
  }


  async pushPackage(devId, remote, build, staticTar=null){

    let client = new Dataparty.EphemeralClient({
      identity: devId,
      urlOrParty: remote.url,
      wsUrlOrParty: remote.ws,
      allowSelfSigned: remote.allowSelfSigned
    })

    await client.start()


    let uploadResult = await client.restParty.comms.call('create-package', {build, staticTar}, {
      expectClearTextReply: false,
      sendClearTextRequest: false,
      useSessions: true
    })

    console.log('result', uploadResult)
  }
}

module.exports = VenuePackageBuild


