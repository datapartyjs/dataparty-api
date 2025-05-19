'use strict'

const Path = require('path')
const debug = require('debug')('dataparty.topics.LocalTopicHost')

const HostTopic = require('./host-topic')
const PeerNode = require('./peer-node')

class LocalTopicHost {

  /**
   * Implementation of ROS style pub/sub topics. This runs on a
   * single thread/peer and can be shared to other peers. However,
   * this is a centralized implementation. So if the hosting node
   * stops all topic traffic will halt as well.
   * @class module:Topics.LocalTopicHost
   * @link module:Topics
   */
  constructor(){
    debug('constructor')
    this.nodesByUuid = new Map()
    this.topicsByPath = new Map()
    this.party = null
  }

  getTopic(path, create=true){
    const normalized = Path.normalize(path)
    let topic = this.topicsByPath.get(normalized)

    //debug('get topic', topic, normalized)

    if(!topic && create == true){
      //topic = 
      this.topicsByPath.set(normalized, new HostTopic(normalized))

      //debug('set topic', this.topicsByPath.get(normalized), normalized)
      return this.topicsByPath.get(normalized)
    }

    return topic
  }

  getNodeByUuid(uuid, peer){
    let node = this.nodesByUuid.get(uuid)

    if(!node && peer){
      node = new PeerNode(peer)
      this.nodesByUuid.set(uuid, node)
    }

    return node
  }

  getNodeByPeer(peer){
    return this.getNodeByUuid(peer.uuid, peer)
  }

  async advertise(peer, path){
    const topic = this.getTopic(path)
    const node = this.getNodeByPeer(peer)

    debug('advertise', path, peer.uuid)

    topic.advertise(node)
    node.advertise(topic)
  }

  async subscribe(peer, path){
    debug('sub', path)
    const exists = this.getTopic(path, false)
    const topic = this.getTopic(path)
    const node = this.getNodeByPeer(peer)

    debug('subscribe', path, peer.uuid)

    topic.subscribe(node)
    node.subscribe(topic)

    if(topic.path.indexOf('/dataparty/document/') != -1 && !exists){
      const [arg0, arg1, docType, docId] = topic.path.substr(1).split('/')
      debug('is document watcher', docType+':'+docId)

      peer.party.hostParty.db.on(docType+':'+docId, async (event)=>{
        await this.handleDocChange(topic.path, event)
      })
    }
  }

  async handleDocChange(path, event){
    debug('handleDocChange', path)
    const topic = this.getTopic(path,false)

    debug('\ttopic',topic)

    if(!topic){return}

    const [arg0, arg1, docType, docId] = topic.path.substr(1).split('/')

    if(topic.subscribers.size > 0){
      await topic.publish({
        id: event.msg.id,
        type: event.msg.type,
        revision: event.msg.revision,
        operationType: event.event
      })
    }
  }

  async unadvertise(peer, path){
    const topic = this.getTopic(path)
    const node = this.getNodeByPeer(peer)

    debug('unadvertise', path, peer.uuid)

    topic.unadvertise(node)
    node.unadvertise(topic)
  }

  async unsubscribe(peer, path){
    const topic = this.getTopic(path)
    const node = this.getNodeByPeer(peer)

    debug('unsubscribe', path, peer.uuid)

    topic.unsubscribe(node)
    node.unsubscribe(topic)
  }

  async publish(peer, path, data){
    const topic = this.getTopic(path, false)
    const sender = this.getNodeByPeer(peer)

    debug('publish', path, peer.uuid)

    await topic.publish(data, sender)
  }

  async publishInternal(path, data){
    const topic = this.getTopic(path, false)

    debug('publishInternal', path)

    await topic.publish(data)
  }

  async destroyNode(peer){
    const node = this.getNodeByPeer(peer)

    debug('destroying node', node.uuid)

    node.destroy()

    this.nodesByUuid.delete(node.uuid)
  }

  async cleanUpTopics(){

  }
}

module.exports = LocalTopicHost