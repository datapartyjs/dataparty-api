
const debug = require('debug')('dataparty.service.IService')

module.exports = class IService {
  /**
   *  A service with schema, documents, endpoints, middleware and tasks.
   * Provide either paths to source files for compilation or provided a 
   * pre-built service to import.
   *
   * @class module:Service.IService
   * @link module:Service
   * 
   * @param {*} options.name
   * @param {*} options.version
   * @param {*} options.githash
   * @param {*} options.branch
   * @param {*} build 
   */
  constructor({
    name, version, githash='', branch=''
  }, build){

    this.constructors = {
      schemas: {},
      documents: {},
      endpoints: {},
      middleware: {
        pre: {},
        post: {}
      },
      tasks: {},
      topics: {},
      auth: {}
    }

    this.middleware_order = {
      pre: [],
      post: []
    }

    this.sources = {
      schemas: {},
      documents: {},
      endpoints: {},
      middleware: {
        pre: {},
        post: {}
      },
      tasks: {},
      topics: {},
      auth: {}
    }

    this.compiled = {
      package: { name, version, githash, branch },
      schemas: {
        IndexSettings: {},
        JSONSchema: [],
        Permissions: {}
      },
      documents: {},
      endpoints: {},
      middleware: {
        pre: {},
        post: {}
      },
      middleware_order: {
        pre: [],
        post: []
      },
      tasks: {},
      topics: {},
      auth: {}
    }

    this.compileSettings = {
      // provide a custom cache path or disable caching
      cache: false,
      // externals to leave as requires of the build
      externals: ['debug', '@dataparty/crypto', '@dataparty/tasker', 'joi', '@hapi/hoek'],
      // directory outside of which never to emit assets
      //filterAssetBase: process.cwd(), // default
      minify: false, // default
      sourceMap: true, // default
      //sourceMapBasePrefix: '../', // default treats sources as output-relative
      // when outputting a sourcemap, automatically include
      // source-map-support in the output file (increases output by 32kB).
      sourceMapRegister: false, // default
      watch: false, // default
      v8cache: false, // default
      quiet: false, // default
      debugLog: false, // default
      //target: 'es2015'
      esm: false,
      moduleType: 'self',
      libraryName: 'Lib'
    }

    if(build){
      this.importBuild(build)
    }
   }

   /**
    * Import a pre-build service
    * @method module:Service.IService.importBuild
    * @param {Object} buildOutput 
    */
  importBuild(buildOutput){
    this.compiled = buildOutput
  }

}
