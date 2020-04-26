'use strict'

var DataPartyMessageSequence = 0

class BLEMessage {
  constructor(options){
    this.created = Date.now()
    this.lastChanged = Date.now()
    this.data = (options.msg) ? Buffer.from(JSON.stringify(options.msg)) : undefined
    this.packetCount = options.packetCount || ((options.msg) ? Math.ceil(this.data.length / 16) : undefined)
    this.commandSeq = options.commandSeq || DataPartyMessageSequence++
    this.mtu = options.mtu || 20
    this.dataMap = {}
    this.rxComplete = false

    // console.log(`new message with seq=${this.commandSeq}`)
    // console.log(this.data)
    // console.log(this.data.length)
    // console.log(this.packetCount)
    // console.log(JSON.stringify(options.msg))
  }

  get text(){
    const str = new TextDecoder('utf-8').decode(this.data)
    return str
  }

  static fromPacket(packet){
    const seq = packet[0]
    const pktCount = packet[2]

    const message = new BLEMessage({
      packetCount: pktCount,
      commandSeq: seq
    })

    message.parsePacket(packet)
    return message
  }

  static parseHeader(pkt){
    return {
      seq: pkt[0],
      idx: pkt[1],
      pktCount: pkt[2],
      flags: (pkt[3] >> 5) & 0xf,
      dataLen: pkt[3] & 0x1f
    }
  }

  parsePacket(packet){
    const seq = packet[0]
    const idx = packet[1]
    const pktCount = packet[2]
    const flags = (packet[3] >> 5) & 0xf
    const dataLen = packet[3] & 0x1f

    console.log('parsing', seq, idx, 'of', pktCount, 'with', dataLen, 'bytes')

    if (!this.packetCount){
      this.packetCount = pktCount
      this.commandSeq = seq
    }

    if (!this.data){
      this.data = new Uint8Array(this.packetCount * (this.mtu - 4))
    }

    const startOffset = idx * (this.mtu - 4)
    const endOffset = (dataLen + startOffset) - 1

    for (let i = 0; i < dataLen; i++){
      this.data[startOffset + i] = packet[4 + i]
    }
    this.dataMap[idx] = true

    let readAll = true

    for (let p = 0; p < this.packetCount; p++){
      if (!this.dataMap[p]){
        readAll = false
        break
      }
    }

    if (idx == this.packetCount - 1){
      // Account for last packet's length
      console.log(this.data)
      console.log(typeof this.data)
      const actualEndOffset = this.data.length - ((this.mtu - 4) - dataLen)
      this.data = this.data.slice(0, actualEndOffset)
    }

    this.lastChanged = Date.now()
    this.rxComplete = readAll
    return readAll
  }

  getPacket(idx){
    if (idx > -1 && idx < this.packetCount){

      const packet = Buffer.alloc(20)
      packet.fill(0x0)

      const startOffset = idx * (this.mtu - 4)
      const endOffset = Math.min((startOffset + (this.mtu - 4) - 1), this.data.length - 1)
      const dataLen = (endOffset - startOffset) + 1

      packet[0] = this.commandSeq
      packet[1] = idx
      packet[2] = this.packetCount
      packet[3] = dataLen & 0x1f

      if (dataLen > this.mtu - 4) { throw new Error('Buffer bounds error data length=' + dataLen) }

      const buf = []

      for (let i = 0; i < dataLen; i++){
        const val = this.data[i + startOffset]
        packet[4 + i] = val
      }

      return packet
    }
  }
}

module.exports = BLEMessage
