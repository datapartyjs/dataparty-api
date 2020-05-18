const tmp = require('tmp')
const debug = require('debug')('test.local-db')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src')


async function main(){
  //console.log(Dataparty)

  const temp = tmp.dirSync()
  const dbPath = temp.name + '/local-party-loki.db'

  debug('temp location', temp.name)

  debug(BouncerModel.IndexSettings)


  let local = new Dataparty.LocalParty({
    path: dbPath,
    model: BouncerModel
  })


  await local.start()

  //console.log(db)
}


main().catch(err=>{
  console.error(err)
})