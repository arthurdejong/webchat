
class WebRTC {
  constructor(server, trackHandler) {
    this.configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}
    this.server = server
    this.trackHandler = trackHandler
    this.peerConnections = {}
    this.streams = []
    // generate an identity identifier
    const numbers = window.crypto.getRandomValues(new Uint8Array(4))
    const symbols = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    this.identity = Array.prototype.slice.call(numbers).map(x => symbols[x % 62]).join('')
    // announce ourselves via the channel
    server.sendMessage({announce: true, sender: this.identity})
  }

  addStream(stream) {
    this.streams.push(stream)
    // register stream with existing connections
    Object.keys(this.peerConnections).forEach(identity => {
      const peerConnection = this.peerConnections[identity]
      stream.getTracks().forEach(track => { this._addTrack(peerConnection, track, stream) })
    })
  }

  _addTrack(peerConnection, track, stream) {
    // send the track over the peer connection
    var sender = peerConnection.addTrack(track, stream)
    if (track.kind === 'video') {
      sender.setParameters({encodings: [{maxBitrate: 60000, scaleResolutionDownBy: 2}]})
    }
  }

  getPeerConnection(identity) {
    const self = this
    if (!(identity in self.peerConnections)) {
      const peerConnection = new RTCPeerConnection(self.configuration)
      // handle connection state changes
      peerConnection.addEventListener('connectionstatechange', event => {
      })
      // set up event handler to handled incoming tracks
      peerConnection.addEventListener('track', event => {
        this.trackHandler(event, peerConnection, identity)
      })
      // support delivering messages through the control channel for ICE
      peerConnection.addEventListener('icecandidate', event => {
        self.server.sendMessage({icecandidate: event.candidate, sender: self.identity, receipient: identity})
      })
      // re-send the offer if renegotiation is needed
      peerConnection.addEventListener('negotiationneeded', event => {
        peerConnection.createOffer().then(offer => {
          peerConnection.setLocalDescription(offer).then(x => {
            self.server.sendMessage({offer: offer, sender: self.identity, receipient: identity})
          })
        })
      })
      // add any existing streams to the connection
      this.streams.forEach(stream => {
        stream.getTracks().forEach(track => { this._addTrack(peerConnection, track, stream) })
      })
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
    } else if ('icecandidate' in msg && msg.receipient === self.identity && msg.sender in self.peerConnections) {
      // handle ICE candidate messages
      peerConnection = self.getPeerConnection(msg.sender)
      peerConnection.addIceCandidate(msg.icecandidate)
    }
  }
}

module.exports = WebRTC
