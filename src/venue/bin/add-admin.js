#!/usr/bin/env node

const Dataparty = require('../../index')


async function main(){

  const path = '/data/dataparty/venue-service'

  let config = new Dataparty.Config.JsonFileConfig({
    basePath: path+'/config'
  })

  await config.start()

  console.log(process.argv)

  let admins = (await config.read('admins')) || []

  const newAdmin = process.argv[2]

  console.log(await config.readAll())
  console.log(admins)

  if(admins.indexOf(newAdmin) != -1){ return }

  admins.push(newAdmin)

  await config.write('admins', admins)

  console.log('admin added -', newAdmin)

}


main().catch(err=>{
  console.error(err)
}).finally(()=>{
  process.exit()
})
