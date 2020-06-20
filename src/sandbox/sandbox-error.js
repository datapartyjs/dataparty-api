class SandboxError extends Error {
  constructor(err){
    super()
    this.message = err.message


    this.code = err.code || err.name || 'SandboxError'
    this.name = this.code
    this.stack = err.stack
    this.locations = null
  }

  async resolveLocations(accessor){
    this.locations = await this.filterStackForModuleLines(this.stack, accessor)
  }
  



  async filterStackForModuleLines(stack, accessor){

    let founds = []

    if(!stack){
      return founds
    }
  
    const prefix = '(vm.js:'
    const resolvedStack = await Promise.all(stack.split('\n').map(async line=>{

      console.log('STACK:',line)
      
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
        found.source = 'vm.js'

        const resolvedFound = await accessor.getSourceMapLocation(found)

        resolvedFound.source = `${resolvedFound.source}:${resolvedFound.line}:${resolvedFound.column}`

        founds.push(resolvedFound)

        return `     at ${resolvedFound.code} (${resolvedFound.source})`
      }
      else{
        return line
      }
    }))
    
    this.stack = resolvedStack.join('\n')

    return founds
  }
}

module.exports = SandboxError