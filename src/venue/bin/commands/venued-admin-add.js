const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venued.admin-add')
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


class VenuedAdminAdd extends CmdTree.Command {
  constructor(context){
    super({...VenuedAdminAdd.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'admin add'
  }
  
  static get Definition(){
    return {
      usage: `venued admin add [key-hash]`,
      description: 'Add admin key',
      definition: DEFINITION
    }
  }
  
  async run({parsed}){
    //debug('context -', this.context)
    //console.log('parsed -', parsed)
    
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
    }

    const config = new Dataparty.Config.JsonFileConfig({basePath: parsed.path})

    await config.start()


    let admins = (await config.read('admins')) || []

    
    let newAdmins = []


    for(let admin of parsed._.slice(2)){
      if(admins.indexOf(admin) != -1){ continue }

      newAdmins.push(admin)
    }

    admins = admins.concat(newAdmins)

    await config.write('admins', admins)
    await config.save()

    //console.log('admin added -', newAdmins)

    return {newAdmins}
  }
}

module.exports = VenuedAdminAdd