const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.remote-show')
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


class VenueRemoteShow extends CmdTree.Command {
  constructor(context){
    super({...VenueRemoteShow.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'remote show'
  }
  
  static get Definition(){
    return {
      usage: `venue remote show [name]`,
      description: 'Show a remote party',
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
      throw new CmdTree.Error.UsageError('You must supply a name for the remote')
    }

    const remoteName = parsed._[2]

    const remote = await this.context.secureConfig.read('remote.'+remoteName)


    return {remote}
  }
}

module.exports = VenueRemoteShow


