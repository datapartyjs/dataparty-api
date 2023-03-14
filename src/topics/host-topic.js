'use strict'

const Path = require('path')
const debug = require('debug')('dataparty.topics.peer-node')

class HostTopic {
  constructor(path, type){
    this.path = Path.normalize(path)
    this.type = type
    this.created = Date.now()

    this.lastMessage = null
    this.lastMessageTime = null

    this.subscribers = new Map()
    this.advertisers = new Map()
  }

  subscribe(node){
    if(!this.subscribers.get(node.uuid)){
      this.subscribers.add(node.uuid, node)
    }
  }

  unsubscribe(node){
    if(this.subscribers.get(node.uuid)){
      this.subscribers.delete(node.uuid)
    }
  }

  advertise(node){
    if(!this.advertisers.get(node.uuid)){
      this.advertisers.add(node.uuid, node)
    }
  }

  unadvertise(node){
    if(this.advertisers.get(node.uuid)){
      this.advertisers.delete(node.uuid)
    }
  }

  canPublish(sender){
    return this.advertisers.has(sender.uuid)
  }

  async publish(data, sender=null){

    let sends = []

    if(sender!=null && !this.canPublish(sender)){
      throw new Error('published called before advertise')
    }

    this.lastMessage = data
    this.lastMessageTime = Date.now()

    for(let node of this.subscribers){
      sends.push(node[1].send(this, data, sender))
    }

    if(sends.length > 0){
      debug('publishing', this.path)
      await Promise.all(sends)
    }
  }
}

module.exports = HostTopic