/*
 * Webchat WebRTC application
 * https://arthurdejong.org/webchat/
 *
 * Copyright (C) 2020 Arthur de Jong
 *
 * Released under the GNU General Public License, either version 3, or
 * (at your option) any later version.
 */

class WebRTC {
  constructor(server, trackHandler, peerHandler) {
    this.server = server
    this.trackHandler = trackHandler
    this.peerHandler = peerHandler
    this.peerConnections = {}
    this.streams = []
    // generate an identity identifier
    const numbers = window.crypto.getRandomValues(new Uint8Array(4))
    const symbols = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    this.identity = Array.prototype.slice.call(numbers).map(x => symbols[x % 62]).join('')
    // announce ourselves via the channel
    server.sendMessage({announce: true, sender: this.identity})
  }

  /**
   * Send the specified stream to all peers.
   */
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
      const peerConnection = new RTCPeerConnection(self.server.RTCConfiguration)
      // handle connection state changes
      peerConnection.addEventListener('connectionstatechange', event => {
        this.peerHandler(event, peerConnection, identity)
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
          peerConnection.close()
          delete this.peerConnections[identity]
        }
      })
      // set up event handler to handled incoming tracks
      peerConnection.addEventListener('track', event => {
        this.trackHandler(event, peerConnection, identity)
      })
      // support delivering messages through the control channel for ICE
      peerConnection.addEventListener('icecandidate', event => {
        self.server.sendMessage({icecandidate: event.candidate, sender: self.identity, recipient: identity})
      })
      // re-send the offer if renegotiation is needed
      peerConnection.addEventListener('negotiationneeded', event => {
        peerConnection.createOffer().then(offer => {
          peerConnection.setLocalDescription(offer).then(x => {
            self.server.sendMessage({offer: offer, sender: self.identity, recipient: identity})
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

  /**
   * Handle an incoming message on the control channel.
   */
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
          self.server.sendMessage({offer: offer, sender: self.identity, recipient: msg.sender})
        })
      })
    } else if (msg.offer && msg.recipient === self.identity) {
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
    } else if ('icecandidate' in msg && msg.recipient === self.identity && msg.sender in self.peerConnections) {
      // handle ICE candidate messages
      peerConnection = self.getPeerConnection(msg.sender)
      peerConnection.addIceCandidate(msg.icecandidate)
    }
  }
}

module.exports = WebRTC
