const fs = require('fs/promises')
const debug = require('debug')('test.local-db')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../dist/dataparty.js')

let local=null

async function getUser(name) {
  return (await local.find()
    .type('user')
    .where('name').equals(name)
    .exec())[0]
}


async function main(){
  const dbPath = await fs.mkdtemp('/tmp/tingo-party')

  debug('db location', dbPath)

  local = new Dataparty.TingoParty({
    path: dbPath,
    model: BouncerModel,
    config: new Dataparty.Config.MemoryConfig()
  })


  await local.start()

  let user = await getUser('tester')

  
  if(!user){
    debug('creating document')
    user = await local.createDocument('user', {name: 'tester', created: (new Date()).toISOString() })
  }
  else{
    debug('loaded document')
  }

  console.log(user.data)

  user.data.name = 'renamed-tester'
  user.data.invalideField = true
  await user.save()

  console.log(user.data)


  await user.remove()

  console.log(await getUser('renamed-tester'))


  process.exit()
}


main().catch(err=>{
  console.error(err)
})