#!/usr/bin/env -S node --trace-warnings

const Pkg = require('../../../package.json')
const debug = require('debug')('venue')
const CommandTree = require('command-tree').CommandTree


const commandTree = new CommandTree({ usage: 'venued <global-options> [command] <command-options>\nVersion: ' + Pkg.version })

commandTree.addCommand(require('./commands/venued-host'))
commandTree.addCommand(require('./commands/venued-admin-add'))
commandTree.addCommand(require('./commands/venued-admin-list'))

/*commandTree.addCommand(require('./project/project-init'))
commandTree.addCommand(require('./project/project-show'))
commandTree.addCommand(require('./project/project-mount'))
commandTree.addCommand(require('./developer/developer-add'))
commandTree.addCommand(require('./team/team-add'))
commandTree.addCommand(require('./cloud/cloud-add'))
commandTree.addCommand(require('./cloud/cloud-list'))
commandTree.addCommand(require('./package/package-add'))
commandTree.addCommand(require('./service/service-add'))*/


/*
venued host --path /opt/venue
venued get version/identity/config
venued admin add/rm/list

venue remote add --url [] --ws [] --identity <>
venue remote rm
venue remote switch

venue package build --output [] <service-implementation>
venue package deploy 

venue project build
venue project deploy
*/

let context = {
  exiting: true
}

async function main(){

  if(process.argv.length < 3 || process.argv[2] == 'help' || process.argv[2] == '--help'){
    console.log(commandTree.getHelp())
    if(process.send){ process.send(commandTree.getHelp()) }
    return
  }
  
  
  const output = await commandTree.run({context})
  
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
