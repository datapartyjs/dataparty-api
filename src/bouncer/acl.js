class Acl {
  constructor({db}){}

  async aclByResource(type, id){}
  async aclResourcesByActors(actors, resourceType, action){}

  isOwner(resource, field, actor){}
  isMember(resource, field, actor){}

  isAllowed(acl, actor, action, field)

  /** override these functions in subclass */

  redactRead(msg){ throw new Error('not implemented') }
  redactWrite(msg){ throw new Error('not implemented') }

  isAllowedCollection(name){ throw new Error('not implemented') }

  async filterQuerySpec(spec){ throw new Error('not implemented') }

  async canCreate(msg){ throw new Error('not implemented') }
  async canRemove(msg){ throw new Error('not implemented') }
  async canUpdate(msg, newMsg){ throw new Error('not implemented') }
  async canRead(msg){ throw new Error('not implemented') }
}