/*
 * Webchat WebRTC application
 * https://arthurdejong.org/webchat/
 * Parts of this file were part of the Simple volume meter
 * https://github.com/cwilso/volume-meter/
 *
 *
 * Copyright (c) 2014 Chris Wilson
 * Copyright (C) 2020 Arthur de Jong
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE
 */

(function (root, factory) {
  /* if (typeof define === 'function' && define.amd) {
    // AMD: register as an anonymous module
    define(['jquery'], function (jquery) { return (root.volumeindicator = factory(jquery)) })
  } else */ if (typeof module === 'object' && module.exports) {
    // Node: only works with CommonJS-like environments that support module.exports
    module.exports = factory(require('jquery'))
  } else {
    // Browser globals
    root.volumeindicator = factory(root.jQuery)
  }
}(typeof self !== 'undefined' ? self : this, function ($) {
  class VolumeIndicator {
    constructor(element, stream, options) {
      this.element = $(element)
      element.volumeindicator = this

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
      // connect the stream to the meter
      var audioCtx = new AudioContext()
      var source = audioCtx.createMediaStreamSource(stream)
      var meter = createAudioMeter(audioCtx)
      source.connect(meter)
      this.meter = meter
    }
  }

  // update the volume indicator on regular intervals
  setInterval(function () {
    $('video').each(function () {
      var volume = $(this).siblings('.volume')
      var volumeindicator = $(this).data('volumeindicator')
      if (volumeindicator) {
        // check if we're currently clipping
        if (volumeindicator.meter.checkClipping()) {
          volume.removeClass('bg-info')
          volume.addClass('bg-warning')
          $(this).removeClass('border-dark')
          $(this).addClass('border-warning')
        } else {
          volume.removeClass('bg-warning')
          volume.addClass('bg-info')
          $(this).removeClass('border-warning')
          if (volumeindicator.meter.volume > 0.1) {
            $(this).removeClass('border-dark')
            $(this).addClass('border-info')
          } else {
            $(this).removeClass('border-info')
            $(this).addClass('border-dark')
          }
        }
        volume.css('height', Math.round(volumeindicator.meter.volume * 140 + 5) + '%')
      } else {
        volume.css('height', 0)
      }
    })
  }, 500)

  $.fn.volumeindicator = function (stream, options) {
    this.each(function () {
      var element = $(this)
      if (element.data('volumeindicator')) { element.data('volumeindicator').remove() }
      element.data('volumeindicator', new VolumeIndicator(element, stream, options))
    })
    return this
  }

  return VolumeIndicator
}))
