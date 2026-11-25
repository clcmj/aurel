/// <reference lib="webworker" />

import { GIFEncoder, applyPalette, quantize } from 'gifenc'

interface EncodeFrameMessage {
  type: 'frame'
  id: number
  buffer: ArrayBuffer
  width: number
  height: number
  delay: number
}

const gif = GIFEncoder()

self.onmessage = (event: MessageEvent<EncodeFrameMessage | { type: 'finish' }>) => {
  if (event.data.type === 'finish') {
    gif.finish()
    const bytes = gif.bytes()
    self.postMessage({ type: 'done', buffer: bytes.buffer }, { transfer: [bytes.buffer] })
    return
  }

  const { id, buffer, width, height, delay } = event.data
  const rgba = new Uint8ClampedArray(buffer)
  const palette = quantize(rgba, 256)
  const index = applyPalette(rgba, palette)
  gif.writeFrame(index, width, height, { palette, delay, repeat: 0 })
  self.postMessage({ type: 'frame', id })
}
