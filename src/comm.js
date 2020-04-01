/*
 * Webchat WebRTC application
 * https://arthurdejong.org/webchat/
 *
 * Copyright (C) 2020 Arthur de Jong
 *
 * Released under the GNU General Public License, either version 3, or
 * (at your option) any later version.
 */

function generateSalt() {
  var numbers = window.crypto.getRandomValues(new Uint8Array(4))
  const symbols = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  return Array.prototype.slice.call(numbers).map(x => symbols[x % 62]).join('')
}

async function getKey(hash) {
  var salt = hash.slice(0, 4)
  var key = await window.crypto.subtle.importKey(
    'jwk',
    {
      k: hash.slice(4),
      alg: 'A128GCM',
      ext: true,
      key_ops: ['encrypt', 'decrypt'],
      kty: 'oct'
    },
    {name: 'AES-GCM', length: 128},
    false, // extractable
    ['encrypt', 'decrypt']
  )
  return new Promise(resolve => {
    resolve([salt, key])
  })
}

async function generateKey() {
  const salt = generateSalt()
  const key = await window.crypto.subtle.generateKey(
    {name: 'AES-GCM', length: 128},
    true, // extractable
    ['encrypt', 'decrypt']
  )
  const exported = await window.crypto.subtle.exportKey('jwk', key)
  return new Promise(resolve => {
    resolve([salt, key, salt + exported.k])
  })
}

async function encryptMessage(key, msg) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await window.crypto.subtle.encrypt(
    {name: 'AES-GCM', iv: iv},
    key,
    new TextEncoder().encode(JSON.stringify(msg))
  )
  return new Promise(resolve => {
    resolve(new Blob([iv, new Uint8Array(encrypted)]))
  })
}

async function decryptMessage(key, encrypted) {
  const decrypted = await window.crypto.subtle.decrypt(
    {name: 'AES-GCM', iv: new Uint8Array(encrypted.slice(0, 12))},
    key,
    new Uint8Array(encrypted.slice(12))
  )
  return new Promise(resolve => {
    resolve(JSON.parse(new window.TextDecoder().decode(new Uint8Array(decrypted))))
  })
}

class Server {
  constructor() {
    var server = this
    // get key from URL
    getKey(window.location.hash.slice(1)).then(function ([salt, key]) {
      server.salt = salt
      server.key = key
      server.createSocket()
    }).catch((reason) => {
      console.log(reason)
      // generate a new key and store it in the URL
      generateKey().then(([salt, key, hash]) => {
        server.salt = salt
        server.key = key
        window.location.hash = '#' + hash
        server.createSocket()
      })
    })
  }

  async getChannel() {
    const symbols = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const encrypted = await window.crypto.subtle.encrypt(
      {name: 'AES-GCM', iv: new Uint8Array(12)},
      this.key,
      new TextEncoder().encode(this.salt)
    )
    return new Promise(resolve => {
      resolve(Array.prototype.slice.call(new Uint8Array(encrypted), 0, 16).map(x => symbols[x % 62]).join(''))
    })
  }

  createSocket() {
    this.getChannel().then(channel => {
      const url = `wss://${window.location.hostname}:${window.location.port}${window.location.pathname}channel/${channel}`
      this.socket = new WebSocket(url)
      const server = this
      this.socket.addEventListener('open', function (event) {
        server.setupHandlers()
      })
    })
  }

  sendMessage(msg) {
    encryptMessage(this.key, msg).then((encrypted) => {
      this.socket.send(encrypted, {type: 'application/octet-stream'})
    })
  }

  onMessage(handler) {
    this.messageHandler = handler
    this.setupHandlers()
  }

  ready(handler) {
    this.readyHandler = handler
    this.setupHandlers()
  }

  setupHandlers() {
    // ensure the message handler is registered with the socket
    if (this.socket && this.messageHandler) {
      const messageHandler = this.messageHandler
      this.messageHandler = undefined
      const key = this.key
      this.socket.onmessage = function (event) {
        const reader = new FileReader()
        reader.addEventListener('loadend', (e) => {
          decryptMessage(key, e.srcElement.result).then((msg) => {
            messageHandler(msg)
          })
        })
        reader.readAsArrayBuffer(event.data)
      }
    }
    // ensure the ready handler is called once
    if (this.socket && this.readyHandler) {
      const readyHandler = this.readyHandler
      this.readyHandler = undefined
      readyHandler(this)
    }
  }
}

module.exports = Server
