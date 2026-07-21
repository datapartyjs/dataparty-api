const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.remote-add')
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
  },
  ble: {
    type: 'string',
    description: 'ble address of device or set to "random" for devices with address randomization'
  },
  i2p: {
    type: 'string',
    description: 'i2p address of the remote'
  },
  mdns: {
    type: 'boolean',
    default: false
  },
  mmhash: {
    type: 'string',
    description: 'match maker server identtiy hash',
    multiple: true
  }
}


class VenueRemoteAdd extends CmdTree.Command {
  constructor(context){
    super({...VenueRemoteAdd.Definition, context})
  }
  
  static get Command(){
    return 'remote add'
  }
  
  static get Definition(){
    return {
      usage: `venue remote add [name]`,
      description: 'Add remote party',
      definition: DEFINITION
    }
  }
  
  async run({parsed}){
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }

    if (parsed._.length != 3){
      throw new CmdTree.Error.UsageError('You must supply a name for the remote')
    }

    const remoteName = parsed._[2]

    if(await this.context.secureConfig.read('remote.'+remoteName) && !parsed.force){
      throw new CmdTree.Error.UsageError('Remote already exists!')
    }

    const identityUrl = parsed.url+'/identity'
    const versionUrl = parsed.url+'/version'

    const identity = await Dataparty.Comms.RestComms.HttpGet(identityUrl)
    const version = await Dataparty.Comms.RestComms.HttpGet(versionUrl)

    const remote = {
      identity, version,
      url: parsed.url,
      ws: parsed.ws,
      i2p: parsed.i2p,  // { address, publicKey}
      mmhash: parsed.mmhash, // [ mmhash ]
      ble: parsed.ble, //  address | 'random'
      mdns: parsed.mdns
    }

    await this.context.secureConfig.write('remote.'+remoteName, remote)

    return { remote }
  }
}

module.exports = VenueRemoteAdd
