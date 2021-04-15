const debug = require('debug')('dataparty.Sandbox')
const {VM, NodeVM, VMScript} = require('vm2')
const {SourceMapConsumer} = require('source-map')

const SandboxError = require('./sandbox-error')

class Sandbox {
  constructor(code, map, offsetToken='    let Lib = '){
    debug('compiling code', code.length, 'Bytes')
    this.code = code
    this.map = map

    this.mappings = null
    this.payloadLines = 0
    this.offsetToken = offsetToken
    this.offset = code.split(this.offsetToken)[0].split('\n').length-1
    this.script = new VMScript(code).compile()
  }

  async loadSourceMap(){
    if(!this.mappings && this.map){
      debug('loading source map')
      this.mappings = await new SourceMapConsumer(this.map)
      this.mappings.computeColumnSpans()
    }
  }

  async run(context, sandbox){
    //debug('running')
    try{
      
      let vm = new NodeVM({
        sandbox,
        require: {
          external: {
            modules: ['debug', '@dataparty/crypto', '@hapi/joi', '@hapi/hoek', ]
          },
          builtin: ['*'], //! This should be empty typically
          import: ['fs', 'readline', 'stream']
        }
      })

      let fn = vm.run(this.script)
      const retVal = await fn(context)
      return retVal

    } catch(err) {

      debug('CodeVM.run - catch')
      const sbError = new SandboxError(err)

      await sbError.resolveLocations(this)

      throw sbError
    }
  }

  async getSourceMapLocation(loc){

    if(!this.map){ return loc }

    await this.loadSourceMap()

    const adjustedLoc = {
      line: parseInt(loc.line - this.offset),
      column: loc.column - (this.offsetToken.length+1)
    }

    if(adjustedLoc.line < 1 || adjustedLoc.line > this.payloadLines){
      return loc
    }

    debug('\t','adjusted', adjustedLoc)

    const mapping = this.mappings.originalPositionFor(adjustedLoc)
    const spans = this.mappings.allGeneratedPositionsFor(mapping)

    let lastColumn = 0

    spans.map(span=>{
      if(span.lastColumn > lastColumn){
        lastColumn = span.lastColumn
      }
    })

    const code = this.code.split('\n')[this.offset]
      .substr(this.offsetToken.length)
      .substring(adjustedLoc.column, lastColumn)


    return {
      line: mapping.line,
      column: mapping.column,
      source: mapping.source,
      code: code
    }
  }
}

module.exports = Sandbox