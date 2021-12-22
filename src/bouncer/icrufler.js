
class ICrufler {
  constructor({context}){

  }
  //

  async handleCrufl(){}

  async applyCreate(){}
  async applyRemove(){}
  async applyUpdate(){}
  async applyFind(){}
  async applyLookup(){}


  /** override these functions in subclass */

  redactRead(msg){}
  redactWrite(msg){}

  isAllowedCollection(name){}

  async filterQuerySpec(spec){}

  async canCreate(msg){}
  async canRemove(msg){}
  async canUpdate(msg, newMsg){}
  async canRead(msg){}
}