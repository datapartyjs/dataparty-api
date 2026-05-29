const Path = require('path')
const debug = require('debug')('build')

 
const Dataparty = require('../index.js')

const dataparty_crypto = require('@dataparty/crypto')

const Pkg = require('../../package.json')
const VenueService = require('./venue-service')

/**
 * build/
 *    - service.venue.json
 *    - schema.venue.json
 *    - client.venue.json
 *    - staticFiles.venue.tgz
 *    - package.venue.json
 *        { author, venue, files[], signatures{} }
 */


/*

venue: {
  url,
  publicKey,

}

.venue-admin/
  - config/config.json
  - db/
  - packages/
    - AUTHOR/PACKAGE-NAME
        - package.venue.json
        - service.venue.json
        - static-files.venue.tgz
  - parties/
    - PARTY_PUBLIC/
        - config/config.json  (optional)
        - db/                 (optional)
        - static-files.venue.tgz
  - projects/
    - AUTHOR/PROJECT_PUBLIC
      - project.venue.json
      - static-files.venue.tgz
      - party/
        - PARTY_NAME/
          - static-files.venue.tgz


~/code/my_venue_project/
  - package.json
  - build.js
  - public/
  - party/NAME
      - default-config.json
      - public/
  - package/NAME
  - venue.json
    {
      projects: {
        NAME: {
          name: string
          domain, (optional)
          venue,  (optional)
          parties: [NAME],
          routes: {
            PREFIX: [ { PACKAGE(owner,name,version), party } ]
          }
        }
      },
      packages: {
        NAME: {
          name: String
          version: String, (optional)
          service: localPathToService.js OR built service.json
        }
      }
    }

*/

async function buildVenuePackage({authorIdentity, venueIdentity, outputPath, existingBuildPath, staticFilePaths}){

  /*

    0. create service.venue.json
    1. create schema.venue.json
    2. create client.venue.json
    3. create staticFiles.venue.tgz
    4. create package.venue.json

    6. upload to venue
        - create-package
          * service.venue.json
          * package.venue.json

    7. upload files to venue
        - create-files
          * staticFiles.venue.tgz
          * schema.venue.json
          * client.venue.json

    8. 

  */

}


/**
 * 
 * 1. generate admin/developer key
 * 2. add venue identity (by url)
 * 3. venue package build - build a package at some path
 * 4. venue package push - c
 */

async function main(){
  const service = new VenueService({
    name: '@dataparty/venue',
    version: Pkg.version
  })

  let a = await dataparty_crypto.Identity.fromRandomSeed();

  const builder = new Dataparty.ServiceBuilder(service)
  const build = await builder.compile(Path.join(__dirname,'./dataparty'), true, a)

  debug('compiled')
}

main().catch(err=>{
  console.error('CRASH')
  console.error(err)
})