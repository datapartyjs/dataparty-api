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
    require: true
  },
  name: {
    description: 'package name'
  },
  version: {
    description: 'package version'
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
      throw new CmdTree.Error.UsageError('You must supply service code')
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

    return {files: build.files}
  }
}

module.exports = VenuePackageBuild


