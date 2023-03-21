'use strict'

const Path = require('path')
const debug = require('debug')('dataparty.topics.peer-node')

class HostTopic {
  constructor(path, type){
    this.path = Path.normalize(path)
    this.type = type
    this.created = Date.now()

    debug('new topic', path, '(', type, ')')

    this.lastMessage = null
    this.lastMessageTime = null

    this.subscribers = new Map()
    this.advertisers = new Map()

    this.sending = false
    this.sendRequest = false
  }

  subscribe(node){
    if(!this.subscribers.get(node.uuid)){
      this.subscribers.set(node.uuid, node)
    }
  }

  unsubscribe(node){
    if(this.subscribers.get(node.uuid)){
      this.subscribers.delete(node.uuid)
    }
  }

  advertise(node){
    if(!this.advertisers.get(node.uuid)){
      this.advertisers.set(node.uuid, node)
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

    if(!this.sending && this.sendRequest){
      
      this.sendRequest=false

    }else  if(this.sending){
      if(!this.sendRequest){
        this.sendRequest = true
      }

      debug('throttle')
      this.lastMessage = data
      this.lastMessageTime = Date.now()

      return

    }else if(!this.sendRequest && !this.sending) {

      this.lastMessage = data
      this.lastMessageTime = Date.now()
    }

    

    for(let node of this.subscribers){

      if(sender && node[0] == sender.uuid){
        debug('publish skip', node[0])
        continue
      }

      //await node[1].send(this, this.lastMessage, sender)

      sends.push(node[1].send(this, this.lastMessage, sender))
    }

    if(sends.length > 0){
      debug('publishing', this.path)
      this.sending = true

      try{
        await Promise.all(sends)
        this.sending = false

        if(this.sendRequest){
          debug('send requested')
          //setTimeout(this.publish.bind(this),1)
        }
      }
      catch(err){
        this.sending = false
        throw err
      }
    }
  }
}

module.exports = HostTopic