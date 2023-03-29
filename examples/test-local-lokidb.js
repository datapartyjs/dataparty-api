const fs = require('fs/promises')
const debug = require('debug')('example.loki-db')
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
  const dbPath = (await fs.mkdtemp('/tmp/loki-party')) + '/loki.db'

  debug('db location', dbPath)

  local = new Dataparty.LokiParty({
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

  user.on('update', (obj)=>{ console.log('update') })
  user.on('value', (obj)=>{ console.log('value') })

  user.data.name = 'renamed-tester'
  await user.save()

  console.log(user.data)

  let userFind = await getUser('renamed-tester')

  console.log(userFind.data)


  console.log(dbPath)


  await userFind.remove()


  console.log(await getUser('renamed-tester'))

}


main().catch(err=>{
  console.error(err)
})