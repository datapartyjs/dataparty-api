'use strict'

const Path = require('path')
const debug = require('debug')('dataparty.topics.LocalTopicHost')

const HostTopic = require('./host-topic')
const PeerNode = require('./peer-node')

class LocalTopicHost {
  constructor(){
    debug('constructor')
    this.nodesByUuid = new Map()
    this.topicsByPath = new Map()
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
    const topic = this.getTopic(path)
    const node = this.getNodeByPeer(peer)

    debug('subscribe', path, peer.uuid)

    topic.subscribe(node)
    node.subscribe(topic)
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

    debug('destroying node', node.uuid, node)

    node.destroy()

    this.nodesByUuid.delete(node.uuid)
  }

  async cleanUpTopics(){

  }
}

module.exports = LocalTopicHost