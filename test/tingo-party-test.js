'use strict';

const fs = require('fs/promises')
const debug = require('debug')('test.local-db')
const ExampleModel = require('../examples/dataparty/@dataparty-api.dataparty-schema.json')
//const Dataparty = require('../dist/dataparty.js')
const Dataparty = require('../src/index')

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
    const dbPath = await fs.mkdtemp('/tmp/tingo-party')

    debug('db location', dbPath)
  
    local = new Dataparty.TingoParty({
      path: dbPath,
      model: ExampleModel,
      config: new Dataparty.Config.MemoryConfig(),
      noCache: false
    })
  
  
    await local.start()
    await local.db.compactDatabase()
  })

  test('create basic types', async ()=>{

    let list = []

    for(let i=0; i<10; i++){
      let now = (new Date()).toISOString()
      const item = await local.createDocument('basic_types',{
        number: i,
        string: ''+i,
        time: now,
        bool: i>5
      })

      expect(item).not.undefined()
      expect(item.data.number).equal(i)
      expect(item.data.string).equal(''+i)

      list.push(item)
    }


    let found = await local.find()
      .type('basic_types')
      .where('number').gt(3)
      .where('number').lt(7)
      .exec()
  })


  test('create user', async ()=>{
    let user = await getUser('tester')

    expect(user).undefined()

    debug('creating document')
    user = await local.createDocument('user', {name: 'tester', created: (new Date()).toISOString() })

    debug(user.data)

    expect(user).not.undefined()
    expect(user.data.name).equal('tester')

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
    await user.save()

    let oldUser = await getUser('tester')

    expect(oldUser).undefined()

    let renamedUser = await getUser('renamed-tester')

    expect(renamedUser).not.undefined()
    expect(renamedUser.data.name).equal('renamed-tester')

    await renamedUser.remove()

    let removedUser = await getUser('renamed-tester')
    expect(removedUser).undefined()
  })
})