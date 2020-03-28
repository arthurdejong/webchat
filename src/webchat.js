require('bootstrap')
require('bootstrap/scss/bootstrap.scss')
require('@fortawesome/fontawesome-free/js/all')
require('./webchat.css')

const Server = require('./comm.js')
const WebRTC = require('./webrtc.js')

$(document).ready(function () {
  // do not close the dropdown when selecting a mic or camera
  $(document).on('click', '.dropdown-menu', function (e) {
    if ($(this).hasClass('keep-open-on-click')) { e.stopPropagation() }
  })

  // update the list of mics and cameras
  $('#settings').on('show.bs.dropdown', function () {
    $('#mics').empty()
    $('#cams').empty()
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        devices.forEach(function (device, idx) {
          if (device.kind === 'audioinput') {
            var radio = $(`
                  <div class="custom-control custom-radio">
                    <input type="radio" id="audioinput${idx}" name="audioinput" class="custom-control-input">
                    <label class="custom-control-label" for="audioinput${idx}"></label>
                  </div>
              `)
            radio.find('input').attr('value', device.deviceId)
            radio.find('label').text(device.label || 'Unknown')
            radio.find('label').prepend('<i class="fa fa-microphone small"></i> ')
            $('#mics').append(radio)
          } else if (device.kind === 'videoinput') {
            radio = $(`
                  <div class="custom-control custom-radio">
                    <input type="radio" id="videoinput${idx}" name="videoinput" class="custom-control-input">
                    <label class="custom-control-label" for="videoinput${idx}"></label>
                  </div>
              `)
            radio.find('input').attr('value', device.deviceId)
            radio.find('label').text(device.label || 'Unknown')
            radio.find('label').prepend('<i class="fa fa-video small"></i> ')
            $('#cams').append(radio)
          }
        })
      })
  })

  function volumeAudioProcess(event) {
    var buf = event.inputBuffer.getChannelData(0)
    var bufLength = buf.length
    var sum = 0
    var x

    // Do a root-mean-square on the samples: sum up the squares...
    for (var i = 0; i < bufLength; i++) {
      x = buf[i]
      if (Math.abs(x) >= this.clipLevel) {
        this.clipping = true
        this.lastClip = window.performance.now()
      }
      sum += x * x
    }

    // ... then take the square root of the sum.
    var rms = Math.sqrt(sum / bufLength)

    // Now smooth this out with the averaging factor applied
    // to the previous sample - take the max here because we
    // want "fast attack, slow release."
    this.volume = Math.max(rms, this.volume * this.averaging)
  }

  function createAudioMeter(audioCtx, clipLevel, averaging, clipLag) {
    var processor = audioCtx.createScriptProcessor(512)
    processor.onaudioprocess = volumeAudioProcess
    processor.clipping = false
    processor.lastClip = 0
    processor.volume = 0
    processor.clipLevel = clipLevel || 0.98
    processor.averaging = averaging || 0.95
    processor.clipLag = clipLag || 750

    // this will have no effect, since we don't copy the input to the output,
    // but works around a current Chrome bug.
    processor.connect(audioCtx.destination)

    processor.checkClipping =
      function () {
        if (!this.clipping) { return false }
        if ((this.lastClip + this.clipLag) < window.performance.now()) { this.clipping = false }
        return this.clipping
      }

    processor.shutdown =
      function () {
        this.disconnect()
        this.onaudioprocess = null
      }

    return processor
  }

  function showStream(video, stream) {
    // play the video
    console.log('showStream', stream)
    video.volume = 0
    if ('srcObject' in video) {
      video.srcObject = stream
    } else {
      video.src = URL.createObjectURL(stream)
    }
    video.onloadedmetadata = function (e) {
      video.play()
      video.muted = true
    }
    // set up the volume meter
    var audioCtx = new AudioContext()
    var source = audioCtx.createMediaStreamSource(stream)
    var meter = createAudioMeter(audioCtx)
    source.connect(meter)
    video.meter = meter
  }

  // update the volume bars
  setInterval(function () {
    $('video').each(function () {
      var volume = $(this).siblings('.volume')
      if (this.meter) {
        // check if we're currently clipping
        if (this.meter.checkClipping()) { volume.css('background', '#ffc107') } else { volume.css('background', '#28a745') }
        volume.css('height', Math.round(this.meter.volume * 140 + 5) + '%')
      } else {
        volume.css('height', 0)
      }
    })
  }, 500)

  navigator.mediaDevices.getUserMedia({audio: true, video: true})
    .then(stream => {
      console.log('Got MediaStream:', stream)
      showStream($('#me')[0], stream)
    })
    .catch(error => {
      alert('Error accessing media devices: ' + error)
    })

  var server = new Server()
  server.ready(function () {
    var webrtc = new WebRTC(server)

    server.onMessage(function (msg) {
      if (msg.message) {
        $('#messages').append($('<div class="alert alert-primary">').text(msg.message))
        // scroll to bottom
        var messagesDiv = document.getElementById('messages')
        messagesDiv.scrollTop = messagesDiv.scrollHeight
      } else {
        webrtc.handleMessage(msg)
      }
    })

    $('#message-input').submit(function (event) {
      var message = $(this).find('input').val()
      if (message) {
        var msg = {message: message, sender: webrtc.identity}
        server.sendMessage(msg)
      }
      $(this).find('input').val('')
      event.preventDefault()
    })
  })
})
