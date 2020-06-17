const debug = require('debug')('dataparty.Sandbox')
const {VM, NodeVM, VMScript} = require('vm2')

const SandboxError = require('./sandbox-error')

class Sandbox {
  constructor(code){
    debug('compiling code', typeof code)
    this.code = code
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
      debug('',err)
      throw new SandboxError(err,this)
    }
  }
}

module.exports = Sandbox