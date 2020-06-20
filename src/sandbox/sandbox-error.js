class SandboxError extends Error {
  constructor(err, accessor){
    super()
    this.message = err.message


    this.code = err.code || err.name || 'SandboxError'
    this.name = this.code
    this.stack = err.stack
    this.locations = SandboxError.filterStackForModuleLines(err.stack, accessor)
  }

  static filterStackForModuleLines(stack, accessor){

    let founds = []

    if(!stack){
      return founds
    }
  
    const prefix = '(vm.js:'
    stack.split('\n').map(line=>{
      
      let idx = line.indexOf(prefix)
  
      if(idx > -1){
        const found = {
          line: null,
          column: null,
          code: null
        }
  
        let start = idx+prefix.length
        let end = line.indexOf(')')
  
        const [l, c] = line.substr(start, end-start).split(':')
  
        found.column = c
        found.line = l
        found.code = accessor.code.split('\n')[found.line-1]

        founds.push(found)
      }
    })
    
    return founds
  }
}

module.exports = SandboxError