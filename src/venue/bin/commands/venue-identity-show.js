const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.identity-show')
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
  }
}


class VenueIdentityShow extends CmdTree.Command {
  constructor(context){
    super({...VenueIdentityShow.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'identity show'
  }
  
  static get Definition(){
    return {
      usage: `venue identity show [name]`,
      description: 'Show an identity',
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

    const phrase = await this.context.secureConfig.read('identity.'+keyName+'.phrase')

    if(!phrase){
      throw new CmdTree.Error.UsageError("Key doesn't exists!")
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

    return {...key.toJSON()}
  }
}

module.exports = VenueIdentityShow


