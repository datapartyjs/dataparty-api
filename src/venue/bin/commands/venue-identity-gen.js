const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.identity-gen')
const Path = require('path')
const OS = require('os')
const fs = require('fs')

const prompt = require('prompt')
const argon2 = require('argon2')

const { execSync } = require('child_process')

const Dataparty = require('../../../../')
const dataparty_crypto = require('@dataparty/crypto')

const DEFINITION = {
  h: {
    description: 'Show help',
    alias: 'help',
    type: 'help'
  },
  nopassword: {
    type: 'boolean',
    default: false
  },
  force: {
    type: 'boolean',
    default: false
  }
}


class VenueIdentityGen extends CmdTree.Command {
  constructor(context){
    super({...VenueIdentityGen.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'identity gen'
  }
  
  static get Definition(){
    return {
      usage: `venue identity gen [name]`,
      description: 'Create an identity',
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
      throw new CmdTree.Error.UsageError('You must supply a name for the identity')
    }

    const keyName = parsed._[2]

    if(await this.context.secureConfig.read('identity.'+keyName+'.phrase') && !parsed.force){
      throw new CmdTree.Error.UsageError('Key already exists!')
    }

    const phrase = await dataparty_crypto.Routines.generateMnemonic()

    const password = parsed.nopassword ? null : await this.context.collectPassword()

    let key = await dataparty_crypto.Identity.fromMnemonic(phrase, password, argon2)

    key.id = keyName

    await this.context.secureConfig.write('identity.'+keyName+'.phrase', phrase)

    return {...key.toJSON()}
  }
}

module.exports = VenueIdentityGen


