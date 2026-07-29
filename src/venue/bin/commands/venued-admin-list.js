const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venued.admin-list')
const Path = require('path')
const OS = require('os')
const fs = require('fs')

const { execSync } = require('child_process')

const Dataparty = require('../../../../')

const HOMEDIR = OS.homedir()
const DEFAULT_FOLDER = (HOMEDIR.indexOf('opt')==-1) ? '.venued' : ''
const DEFAULT_PATH = Path.join( HOMEDIR, DEFAULT_FOLDER )


const DEFINITION = {
  h: {
    description: 'Show help',
    alias: 'help',
    type: 'help'
  },
  p: {
    alias: 'path',
    description: 'venued path',
    default: DEFAULT_PATH
  }
}


class VenuedAdminList extends CmdTree.Command {
  constructor(context){
    super({...VenuedAdminList.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'admin list'
  }
  
  static get Definition(){
    return {
      usage: `venued admin list [key-hash]`,
      description: 'List admin keys',
      definition: DEFINITION
    }
  }
  
  async run({parsed}){
    //debug('context -', this.context)
    //debug('parsed -', parsed)
    
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }

    let config = new Dataparty.Config.JsonFileConfig({basePath: parsed.path})

    await config.start()

    let admins = (await config.read('admins')) || []

    config=null

    return {admins}
  }
}

module.exports = VenuedAdminList