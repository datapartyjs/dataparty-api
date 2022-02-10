
class ICrufler {
  constructor({db, context}){
    this.db = db
    this.context = context
  }


  /** override these functions in subclass */



  //

  async handleCrufl(){ throw new Error('not implemented') }

  async applyCreate(crufl){ throw new Error('not implemented') }
  async applyRemove(crufl){ throw new Error('not implemented') }
  async applyUpdate(crufl){ throw new Error('not implemented') }
  async applyFind(crufl, includeData = false){ throw new Error('not implemented') }
}