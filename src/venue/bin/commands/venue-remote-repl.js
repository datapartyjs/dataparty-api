const CmdTree = require('command-tree')
const Hoek = require('@hapi/hoek')
const debug = require('debug')('venue.remote-repl')
const Path = require('path')
const OS = require('os')
const fs = require('fs')
const repl = require("repl");

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
  remote: {
    type: 'string',
    require: true
  },
  identity: {
    type: 'string',
    description: 'admin identity',
    require: true
  }
}


class VenueRemoteRepl extends CmdTree.Command {
  constructor(context){
    super({...VenueRemoteRepl.Definition, context})
    debug('constructor')
  }
  
  static get Command(){
    return 'remote repl'
  }
  
  static get Definition(){
    return {
      usage: `venue remote repl`,
      description: 'Run a repl with access to a remote party',
      definition: DEFINITION
    }
  }
  
  async run({parsed}){
    //debug('context -', this.context)
    //console.log('parsed -', parsed)
    
    if (parsed.h) {
      throw new CmdTree.Error.HelpRequest('help request')
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

    const remote = await this.context.secureConfig.read('remote.'+parsed.remote)

    const client = new Dataparty.EphemeralClient({
      identity: key,
      urlOrParty: remote.url,
      wsUrlOrParty: remote.ws,
      allowSelfSigned: remote.allowSelfSigned
    })

    client.on('session',(id)=>{
      console.log('session', id)
    })

    client.on('session-end',(id)=>{
      console.log('session-end', id)
    })

    client.on('connecting',(info)=>{
      console.log('connecting', info)
    })

    client.on('connected',(info)=>{
      console.log('connected', info)
    })

    client.on('disconnected',(info)=>{
      console.log('disconnected', info)
    })

    client.on('reconnected',(info)=>{
      console.log('reconnected', info)
    })

    client.on('reconnecting',(info)=>{
      console.log('reconnecting',info)
    })

    await client.start()
    console.log('client started')



    const replSrv = repl.start({
      prompt: parsed.identity +'@'+ parsed.remote+'> '
    })

    replSrv.context.remote = remote
    replSrv.context.client = client


    this.context.exiting = false

    return // {remote, client, replSrv}
  }
}

module.exports = VenueRemoteRepl


