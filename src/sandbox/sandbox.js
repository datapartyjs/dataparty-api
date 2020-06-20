const debug = require('debug')('dataparty.Sandbox')
const {VM, NodeVM, VMScript} = require('vm2')
const {SourceMapConsumer} = require('source-map')

const SandboxError = require('./sandbox-error')

class Sandbox {
  constructor(code, map, offsetToken='    let Lib = '){
    debug('compiling code', typeof code)
    this.code = code
    this.map = map

    this.payloadLines = 0
    this.offsetToken = offsetToken
    this.offset = code.split(this.offsetToken)[0].split('\n').length-1
    this.script = new VMScript(code)
    debug('compiled')  
  }

  async run(context, sandbox){
    debug('running')
    try{
      
      let vm = new NodeVM({
        sandbox,
        require: {
          external: {
            modules: ['debug', '@dataparty/crypto', '@hapi/joi', '@hapi/hoek']
          },
          //builtin: ['*']
        }
      })

      let fn = vm.run(this.script)
      const retVal = await fn(context)
      return retVal

    } catch(err) {

      debug('CodeVM.run - catch')
      debug('offset', this.offset)
      debug('payloadLength', this.payloadLines)
      //debug('error',err)
      //debug('map', JSON.parse(this.map))
      const sbError = new SandboxError(err,this)

      debug(sbError.locations)

      let mappings = await new SourceMapConsumer(this.map)
      mappings.computeColumnSpans()

      //debug(mapping)

      for(let idx in sbError.locations){
        const loc = sbError.locations[idx]
        debug('\t','loc',loc)

        const adjustedLoc = {
          line: parseInt(loc.line - this.offset),
          column: loc.column - (this.offsetToken.length+1)
        }

        if(adjustedLoc.line < 1 || adjustedLoc.line > this.payloadLines){
          continue
        }

        debug('\t','adjusted', adjustedLoc)

        const mapping = mappings.originalPositionFor(adjustedLoc)
        const spans = mappings.allGeneratedPositionsFor(mapping)

        let lastColumn = 0

        spans.map(span=>{
          if(span.lastColumn > lastColumn){
            lastColumn = span.lastColumn
          }
        })

        const code = this.code.split('\n')[this.offset]
          .substr(this.offsetToken.length)
          .substring(adjustedLoc.column, lastColumn)


        debug('\t','mapping', mapping)
        debug('\t','spans', spans)

        sbError.locations[idx] = {
          line: mapping.line,
          columne: mapping.column,
          source: mapping.source,
          code: code
        }
      }

      debug(sbError.locations)
      throw sbError
    }
  }
}

module.exports = Sandbox