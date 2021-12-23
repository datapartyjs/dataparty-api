
class ICrufler {
  constructor({db, context}){
    this.db = db
    this.context = context
  }


  /** override these functions in subclass */

  redactRead(msg){ throw new Error('not implemented') }
  redactWrite(msg){ throw new Error('not implemented') }

  isAllowedCollection(name){ throw new Error('not implemented') }

  async filterQuerySpec(spec){ throw new Error('not implemented') }

  async canCreate(msg){ throw new Error('not implemented') }
  async canRemove(msg){ throw new Error('not implemented') }
  async canUpdate(msg, newMsg){ throw new Error('not implemented') }
  async canRead(msg){ throw new Error('not implemented') }


  //

  async handleCrufl(){}

  async applyCreate(crufl){}
  async applyRemove(crufl){}
  async applyUpdate(crufl){}
  async applyFind(crufl, includeData = false){}
}