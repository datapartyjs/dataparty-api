class Acl {
  constructor({db}){}

  async aclByResource(type, id){}
  async aclResourcesByActors(actors, resourceType, action){}

  isOwner(resource, field, actor){}
  isMember(resource, field, actor){}

  isAllowed(actor, action, field)
}