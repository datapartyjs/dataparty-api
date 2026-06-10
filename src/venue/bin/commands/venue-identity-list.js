const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.identity-list')
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
  }
}


class VenueIdentityList extends CmdTree.Command {
  constructor(context){
    super({...VenueIdentityList.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'identity list'
  }
  
  static get Definition(){
    return {
      usage: `venue identity list [name]`,
      description: 'List identity nicknames',
      definition: DEFINITION
    }
  }
  
  async run({parsed}){
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }

    const names = Object.keys(await this.context.secureConfig.read('identity'))

    return {names}
  }
}

module.exports = VenueIdentityList


