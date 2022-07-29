'use strict';

const fs = require('fs/promises')
const debug = require('debug')('test.local-db')
const BouncerModel = require('@dataparty/bouncer-model/dist/bouncer-model.json')
const Dataparty = require('../src/index.js')

const Lab = require('@hapi/lab')
const { expect } = require('@hapi/code');
const { before, afterEach, beforeEach, describe, test, it } = exports.lab = Lab.script();

let local=null

async function getUser(name) {
  return (await local.find()
    .type('user')
    .where('name').equals(name)
    .exec())[0]
}




describe('tingo party test', ()=>{
  //
  before(async ()=>{
    const dbPath = (await fs.mkdtemp('/tmp/loki-party')) + '/loki.db'

    debug('db location', dbPath)
  
    local = new Dataparty.LokiParty({
      path: dbPath,
      model: BouncerModel,
      config: new Dataparty.Config.MemoryConfig()
    })
  
  
    await local.start()
  })


  test('create user', async ()=>{
    let user = await getUser('tester')

    expect(user).undefined()

    debug('creating document')
    user = await local.createDocument('user', {name: 'tester', created: (new Date()).toISOString() })

    await user.remove()
  })


  test('create and rename user', async ()=>{

    let user = await getUser('tester')

    expect(user).undefined()

    debug('creating document')
    user = await local.createDocument('user', {name: 'tester', created: (new Date()).toISOString() })

    expect(user).not.undefined()
    expect(user.data.name).equal('tester')

    user.data.name = 'renamed-tester'
    //user.data.invalideField = true
    await user.save()

    user = await getUser('renamed-tester')


    expect(user).not.undefined()
    expect(user.data.name).equal('renamed-tester')

    await user.remove()
  })
})