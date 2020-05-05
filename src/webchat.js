/*!
 * Webchat WebRTC application
 * https://arthurdejong.org/webchat/
 *
 * Copyright (C) 2020 Arthur de Jong
 *
 * Released under the GNU General Public License, either version 3, or
 * (at your option) any later version.
 */

require('bootstrap')
require('bootstrap/scss/bootstrap.scss')
require('@fortawesome/fontawesome-free/js/all')
require('./webchat.css')
require('webrtc-adapter')

const Server = require('./comm.js')
const WebRTC = require('./webrtc.js')
require('./volumeindicator')

/**
 * Return the size of each item to fit the specified container.
 */
function optimalSize(count, width, height, ratio) {
  var currentWaste = width * height
  var currentR = 0
  count = Math.max(count, 2)
  for (var cols = 1; cols <= count; cols++) {
    var rows = Math.ceil(count / cols)
    const r = Math.min(width / ratio / cols, height / rows)
    const waste = width * height - count * ratio * r * r
    if (waste <= currentWaste) {
      currentWaste = waste
      currentR = r
    }
  }
  return {width: currentR * ratio, height: currentR}
}

function updateGrid() {
  var container = $('#video-container')
  var res = optimalSize(container.children().length, container.width(), container.height(), 4 / 3)
  container.children().css('width', res.width)
  container.children().css('height', res.height)
}

$(document).ready(function () {
  // do not close the dropdown when selecting a mic or camera
  $(document).on('click', '.dropdown-menu', function (e) {
    if ($(this).hasClass('keep-open-on-click')) { e.stopPropagation() }
  })

  // re-layout the video grid on screen size changes
  $(window).resize(function () {
    updateGrid()
  })
  updateGrid()
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

  function showStream(video, stream, identity) {
    // play the video
    console.log('showStream', stream)
    video.stream = stream
    video.identity = identity
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
    $(video).volumeindicator(stream)
  }

  // show video and connection information
  $('#video-container').on('show.bs.dropdown', '.video-info', function () {
    var video = $(this).siblings('video')
    var peerConnection = video[0].peerConnection
    var identity = video[0].identity
    var menu = $(this).find('.dropdown-menu')
    menu.empty()
    if (peerConnection) {
      menu.append($('<span class="dropdown-item-text"></span>').text('connection:' + peerConnection.connectionState))
      menu.append($('<span class="dropdown-item-text"></span>').text('ICE: ' + peerConnection.iceConnectionState))
      menu.append($('<span class="dropdown-item-text"></span>').text('signaling: ' + peerConnection.signalingState))
    }
    if (identity) {
      menu.append($('<span class="dropdown-item-text"></span>').text('ID: ' + identity))
    }
  })

  // set up a connection with the back-end server for message passing
  var server = new Server()
  server.ready(function () {
    // set up addition and removal of peer connections
    var webrtc = new WebRTC(server, function (event, peerConnection, identity) {
      if (event.track.kind === 'video') {
        var clone = $('#videotemplate>:first-child').clone()
        clone.prop('id', 'peer-' + identity)
        $('#video-container').prepend(clone)
        var video = clone.find('video')[0]
        var stream = event.streams[0]
        video.stream = stream
        video.peerConnection = peerConnection
        video.identity = identity
        if ('srcObject' in video) {
          video.srcObject = stream
        } else {
          video.src = URL.createObjectURL(stream)
        }
        video.onloadedmetadata = function (e) {
          video.play()
        }
        $(video).volumeindicator(stream)
        updateGrid()
      }
    }, function (event, peerConnection, identity) {
      if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        $('#peer-' + identity).remove()
        updateGrid()
      }
    })

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

    var constraints = {
      audio: true,
      video: {width: 640, height: 480},
      resizeMode: 'crop-and-scale'
    }

    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        console.log('Got MediaStream:', stream)
        stream.getVideoTracks().forEach(track => { track.applyConstraints({frameRate: {max: 10}}) })
        showStream($('#me video')[0], stream, webrtc.identity)
        webrtc.addStream(stream)
      })
      .catch(error => {
        alert('Error accessing media devices: ' + error)
      })

    // send chat messages across the channel
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
