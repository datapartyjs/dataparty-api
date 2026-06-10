#!/usr/bin/env node

const Pkg = require('../../../package.json')
const debug = require('debug')('venue')
const CommandTree = require('command-tree').CommandTree
const prompt = require('prompt')
const argon2 = require('argon2')
const OS = require('os')
const Path = require('path')


const Dataparty = require('../../../')


const commandTree = new CommandTree({ usage: 'venue <global-options> [command] <command-options>\nVersion: ' + Pkg.version })

commandTree.addCommand(require('./commands/venue-identity-gen'))
commandTree.addCommand(require('./commands/venue-identity-list'))
commandTree.addCommand(require('./commands/venue-identity-show'))

commandTree.addCommand(require('./commands/venue-remote-add'))
commandTree.addCommand(require('./commands/venue-remote-list'))
commandTree.addCommand(require('./commands/venue-remote-show'))

const HOMEDIR = OS.homedir()
const DEFAULT_FOLDER = '.venue'
const DEFAULT_PATH = Path.join( HOMEDIR, DEFAULT_FOLDER )

let secureConfig = null

async function collectPassword(info=''){
  let password = ''

  while(1){
      let passes = await prompt.get({
          properties: {
              password1: {
                  message: 'Set'+info+' password',
                  hidden: true
              },
              password2: {
                  message: 'Confim'+info+' password',
                  hidden: true
              }
          }
      })

      if(passes.password1 == passes.password2){

          password = passes.password1
          break
      }

      console.log("passwords don't match")
  }

  return password
}

async function onSetupRequired(){

    console.log('setup-required')

    const password = await collectPassword(' keychain')

    await secureConfig.setPassword(password, {
      created: Date.now()
    })

    console.log('password set')


    await secureConfig.unlock(password)
}

let context = {
  exiting: true
}

async function main(){

  if(process.argv.length < 3 || process.argv[2] == 'help' || process.argv[2] == '--help'){
    console.log(commandTree.getHelp())
    if(process.send){ process.send(commandTree.getHelp()) }
    return
  }


  let config = new Dataparty.Config.JsonFileConfig({basePath: DEFAULT_PATH})
  secureConfig = new Dataparty.Config.SecureConfig({
    config,
    timeoutMs: 60*1000*5,
    argon: argon2
  })

  secureConfig.on('setup-required', onSetupRequired)

  console.log('starting')

  await config.start()
  await secureConfig.start()


  if(await secureConfig.isInitialized() && secureConfig.isLocked()){

    const {password} = await prompt.get({
        properties: {
            password: {
                message: 'Enter password',
                hidden: true
        }
    }})

    await secureConfig.unlock(password)
  }
  
  
  await secureConfig.waitForUnlocked('startup')
  
  const output = await commandTree.run({context: {
    secureConfig, collectPassword,
    ...context
  }})
  
  if(output){
    console.log(output)

    if(process.send){ process.send({output}) }
  }

}

// Run main
main().catch((error) => {
  console.log(error)
  console.error(error.message)
  debug(error)
  console.log(commandTree.getHelp())
  if(process.send){
    process.send({
      error: error,
      output: commandTree.getHelp()
    })
  }
  //process.exit()
}).finally(()=>{

  if(context.exiting){
    process.exit()
  }
})