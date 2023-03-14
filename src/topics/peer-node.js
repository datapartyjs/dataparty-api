'use strict'

const debug = require('debug')('dataparty.topics.peer-node')

class PeerNode {
  constructor(peer){
    debug('new peer', peer.uuid)
    this.peer = peer
    this.uuid = peer.uuid
    this.created = Date.now()

    this.subscriptions = new Map() //! path -> Topic
    this.advertisements = new Map() //! path -> Topic
  }

  async send(topic, data, sender=null){
    if(this.subscriptions.has(topic.path)){

      debug(' publish to node', this.uuid)

      await this.peer.send({
        op: 'publish',
        id: 'publish:'+this.peer.opId,
        topic: topic.path,
        sender: { uuid: this.uuid, identity: this.peer.remoteIdentity },
        msg: data
      })

    }
  }

  advertise(topic){
    if(!this.advertisements.get(topic.path)){
      this.advertisements.set(topic.path, topic)
    }
  }

  subscribe(topic){
    if(!this.subscriptions.get(topic.path)){
      this.subscriptions.set(topic.path, topic)
    }
  }

  unadvertise(topic){
    if(!this.advertisements.get(topic.path)){
      this.advertisements.delete(topic.path)
    }
  }

  unsubscribe(topic){
    if(!this.subscriptions.get(topic.path)){
      this.subscriptions.delete(topic.path)
    }
  }

  destroy(){

    for(let subscription of this.subscriptions){
      let topic = subscription[1]

      this.unsubscribe(topic)
      topic.unsubscribe(this)
    }

    for(let advertisement of this.advertisements){
      let topic = advertisement[1]

      this.unadvertise(topic)
      topic.unadvertise(this)
    }
  }
}

module.exports = PeerNode