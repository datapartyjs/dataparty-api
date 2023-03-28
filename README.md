# @dataparty/api
[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)[![license](https://img.shields.io/github/license/datapartyjs/api)](https://github.com/datapartyjs/dataparty-api/blob/master/LICENSE)

decentralized cloud framework for the Web3.0 generation.

 * Documentation - [datapartyjs.github.io/dataparty-api](https://datapartyjs.github.io/dataparty-api)
 * NPM - [npmjs.com/package/@dataparty/api](https://www.npmjs.com/package/@dataparty/api)
 * Code - [github.com/datapartyjs/dataparty-api](https://github.com/datapartyjs/dataparty-api)
 * Support - [ko-fi/dataparty](https://ko-fi.com/dataparty)

## Design Goal

Dataparty services are able to run on servers, edge devices, or even directly in the browser or app. This means users of dataparty based apps can frequently run their own backend from within an app. By building this peer-to-peer functionality directly into the database ORM, `dataparty/api` saves significant effort for app makers.

### Plugable
For many domains the exact performance characteristics of the database, communications, and security matter a lot. All major systems are fairly pluggable so that additional drivers(db, comms etc) can be developed.


## Features

![Feature Roadmap 2023](images/dataparty-overivew-full.svg)


A dataparty app/service typically consists of these parts:

 * [Comms](https://datapartyjs.github.io/dataparty-api/module-Comms.html)
   * We support everything from WebRTC, Websockets, HTTP to BLE and i2p/tor.
 * [Config](https://datapartyjs.github.io/dataparty-api/module-Config.html)
   * Persist configuration in a number of ways.
 * [Db](https://datapartyjs.github.io/dataparty-api/module-Db.html)
   * Select the database that makes sense for you, see [database selection](#database-selection)
   * Use one scheme across all db's
 * [Party](https://datapartyjs.github.io/dataparty-api/module-Party.html)
   * The primary query interface. Abstracts the DBs into a common realtime-db interface. Partys can interact with local, remote and even peer-to-peer hosted DBs. Select the type of party that makes sense for you. See [party selection](#party-selection)
 * [Service](https://datapartyjs.github.io/dataparty-api/module-Service.html)
   * RESTful endpoints and middleware, code once run everywhere. Expressjs style interface. Each endpoint can be run in its own sandbox, various types of isolation are supported and more are planned.
 * [Topics](https://datapartyjs.github.io/dataparty-api/module-Topics.html)
   * Streaming pub/sub that runs everywhere. Compatible with the ROS `rosbridge 2.0` protocol.



### Database Selection


Database | Browser | Cordova | Electron | Embedded Linux | Node 
-----|----|-|--|-|-
[Lokijs](https://datapartyjs.github.io/dataparty-api/module-Db.LokiDb.html) | y | y | y | NR* | NR*
[Zangodb](https://datapartyjs.github.io/dataparty-api/module-ZangoDb) | y | y | y | P* | P*
[Tingo](https://datapartyjs.github.io/dataparty-api/module-TingoDb) | n | P* | y | y | y 
[Mongo](https://datapartyjs.github.io/dataparty-api/module-MongoDb) | n | P* | y | y | y

*NR - Not Recommended, but supported
*P - Possibly. We're looking into it.

## Example

```

const Dataparty = require('@dataparty/api')


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
    model: MyServiceModel,
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

  await user.save()

  console.log(user.data)

  let userFind = await getUser('renamed-tester')

  console.log(userFind)


  console.log(dbPath)


  await user.remove()

  console.log(await getUser('renamed-tester'))

}
```