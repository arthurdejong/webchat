
class WebRTC {
  constructor(server) {
    this.configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}
    this.server = server
    this.peerConnections = {}
    // generate an identity identifier
    const numbers = window.crypto.getRandomValues(new Uint8Array(4))
    const symbols = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    this.identity = Array.prototype.slice.call(numbers).map(x => symbols[x % 62]).join('')
    // announce ourselves via the channel
    server.sendMessage({announce: true, sender: this.identity})
  }

  getPeerConnection(identity) {
    if (!(identity in this.peerConnections)) {
      const peerConnection = new RTCPeerConnection(this.configuration)
      this.peerConnections[identity] = peerConnection
    }
    return this.peerConnections[identity]
  }

  handleMessage(msg) {
    const self = this
    var peerConnection
    // ignore our own messages
    if (msg.sender === self.identity || !msg.sender) { return }
    if (msg.announce && !(msg.sender in self.peerConnections)) {
      // handle new announce message by sending an offer
      peerConnection = self.getPeerConnection(msg.sender)
      peerConnection.createOffer().then(offer => {
        peerConnection.setLocalDescription(offer).then(x => {
          self.server.sendMessage({offer: offer, sender: self.identity, receipient: msg.sender})
        })
      })
    } else if (msg.offer && msg.receipient === self.identity) {
      // handle offers for us and answer
      peerConnection = self.getPeerConnection(msg.sender)
      peerConnection.setRemoteDescription(new RTCSessionDescription(msg.offer))
      peerConnection.createAnswer().then(answer => {
        peerConnection.setLocalDescription(answer).then(function () {
          self.server.sendMessage({answer: answer, sender: self.identity, recipient: msg.sender})
        })
      })
    } else if (msg.answer && msg.recipient === self.identity && msg.sender in self.peerConnections) {
      // handle answers to offers
      peerConnection = self.getPeerConnection(msg.sender)
      peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer)).then(x => {})
    }
  }
}

module.exports = WebRTC
