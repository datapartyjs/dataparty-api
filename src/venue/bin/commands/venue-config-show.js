const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.config-show')
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


class VenueConfigShow extends CmdTree.Command {
  constructor(context){
    super({...VenueConfigShow.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'config show'
  }
  
  static get Definition(){
    return {
      usage: `venue config show]`,
      description: 'Show config',
      definition: DEFINITION
    }
  }
  
  async run({parsed}){
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }

    debug('context -', this.context)

    const configContent = await this.context.secureConfig.readAll()

    console.log(JSON.stringify(configContent,null,2))

    //await this.context.secureConfig.writeAll(configContent)


    return {...configContent}
  }
}

module.exports = VenueConfigShow


