const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.remote-list')
const Path = require('path')
const OS = require('os')
const fs = require('fs')

const prompt = require('prompt')
const argon2 = require('argon2')

const Dataparty = require('../../../../')
const dataparty_crypto = require('@dataparty/crypto')

const DEFINITION = {
  h: {
    description: 'Show help',
    alias: 'help',
    type: 'help'
  },
  i2p: {
    type: 'string',
    description: 'i2p address'
  },
  ws: {
    type: 'string',
    description: 'websocket url'
  },
  url: {
    type: 'string',
    description: 'api base url'
  },
  hash: {
    type: 'string',
    description: 'key hash of remote'
  },
  force: {
    type: 'boolean',
    default: false
  }
}


class VenueRemoteList extends CmdTree.Command {
  constructor(context){
    super({...VenueRemoteList.Definition, context})
  }
  
  static get Command(){
    return 'remote list'
  }
  
  static get Definition(){
    return {
      usage: `venue remote list [name]`,
      description: 'List remote parties',
      definition: DEFINITION
    }
  }
  
  async run({parsed}){
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }

    const names = Object.keys(await this.context.secureConfig.read('remote'))

    return { names }
  }
}

module.exports = VenueRemoteList
