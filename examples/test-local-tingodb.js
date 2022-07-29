const fs = require('fs/promises')
const debug = require('debug')('example.tingo-db')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src/index.js')

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

  console.log('before', user.data)

  user.data.name = 'renamed-tester'
  //user.data.invalideField = true
  await user.save()

  console.log('after', user.data)

  let userFind = await getUser('renamed-tester')

  console.log(userFind.data)

  process.exit()


  await user.remove()

  console.log(await getUser('renamed-tester'))

}


main().catch(err=>{
  console.error(err)
})