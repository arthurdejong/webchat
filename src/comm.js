
class Server {
  constructor() {
    var wsURL = `wss://${window.location.hostname}:${window.location.port}${window.location.pathname}channel/test`
    this.socket = new WebSocket(wsURL)
  }

  sendMessage(msg) {
    this.socket.send(new Blob([JSON.stringify(msg)], {type: 'application/json'}))
  }

  onMessage(handler) {
    this.socket.onmessage = function (event) {
      const reader = new FileReader()
      reader.addEventListener('loadend', (e) => {
        var msg = JSON.parse(e.srcElement.result)
        handler(msg)
      })
      reader.readAsText(event.data)
    }
  }
}

module.exports = Server
