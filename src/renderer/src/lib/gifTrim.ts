import { decompressFrames, parseGIF } from 'gifuct-js'

interface TrimGifOptions {
  start: number
  end: number
  onProgress: (progress: number) => void
  signal: AbortSignal
}

export async function trimGif(blob: Blob, options: TrimGifOptions) {
  const { start, end, onProgress, signal } = options
  const parsed = parseGIF(await blob.arrayBuffer())
  const frames = decompressFrames(parsed, true)
  if (frames.length === 0) throw new Error('GIF 中没有可用的画面帧')

  const width = parsed.lsd.width
  const height = parsed.lsd.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('当前设备无法创建 GIF 画布')
  const patchCanvas = document.createElement('canvas')
  const patchContext = patchCanvas.getContext('2d')
  if (!patchContext) throw new Error('当前设备无法创建 GIF 画布')

  const totalDuration = frames.reduce((total, frame) => total + Math.max(10, frame.delay || 100), 0)
  const startMs = Math.max(0, Math.min(start * 1000, totalDuration))
  const endMs = Math.max(startMs + 10, Math.min(end * 1000, totalDuration))
  const worker = new Worker(new URL('./gif.worker.ts', import.meta.url), { type: 'module' })
  const pendingFrames = new Map<number, { resolve: () => void; reject: (error: Error) => void }>()
  let finishFrame: { resolve: (buffer: ArrayBuffer) => void; reject: (error: Error) => void } | null = null
  let frameId = 0
  let exportedFrames = 0

  const rejectPending = (error: Error) => {
    for (const frame of pendingFrames.values()) frame.reject(error)
    pendingFrames.clear()
    finishFrame?.reject(error)
    finishFrame = null
  }
  worker.onmessage = (event: MessageEvent<{ type: 'frame'; id: number } | { type: 'done'; buffer: ArrayBuffer }>) => {
    if (event.data.type === 'frame') {
      pendingFrames.get(event.data.id)?.resolve()
      pendingFrames.delete(event.data.id)
    } else {
      finishFrame?.resolve(event.data.buffer)
      finishFrame = null
    }
  }
  worker.onerror = () => rejectPending(new Error('GIF 剪切编码失败'))

  const encodeFrame = (data: Uint8ClampedArray, delay: number) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('已取消', 'AbortError'))
      return
    }
    const id = frameId
    const buffer = data.buffer as ArrayBuffer
    pendingFrames.set(id, { resolve, reject })
    worker.postMessage({ type: 'frame', id, buffer, width, height, delay }, [buffer])
  })
  const finish = () => new Promise<ArrayBuffer>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('已取消', 'AbortError'))
      return
    }
    finishFrame = { resolve, reject }
    worker.postMessage({ type: 'finish' })
  })

  try {
    let timeline = 0
    for (const frame of frames) {
      if (signal.aborted) throw new DOMException('已取消', 'AbortError')
      const delay = Math.max(10, frame.delay || 100)
      const frameEnd = timeline + delay
      const previous = frame.disposalType === 3 ? context.getImageData(0, 0, width, height) : null
      patchCanvas.width = frame.dims.width
      patchCanvas.height = frame.dims.height
      patchContext.putImageData(new ImageData(frame.patch, frame.dims.width, frame.dims.height), 0, 0)
      context.drawImage(patchCanvas, frame.dims.left, frame.dims.top)

      if (frameEnd > startMs && timeline < endMs) {
        const visibleDelay = Math.max(10, Math.round(Math.min(frameEnd, endMs) - Math.max(timeline, startMs)))
        await encodeFrame(context.getImageData(0, 0, width, height).data, visibleDelay)
        exportedFrames += 1
        frameId += 1
        onProgress(Math.min(99, Math.round((Math.min(frameEnd, endMs) - startMs) / (endMs - startMs) * 100)))
      }

      if (frame.disposalType === 2) {
        context.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height)
      } else if (frame.disposalType === 3 && previous) {
        context.putImageData(previous, 0, 0)
      }
      timeline = frameEnd
    }

    if (exportedFrames === 0) throw new Error('剪切范围内没有可用的 GIF 画面')
    const result = await finish()
    onProgress(100)
    return new Blob([result], { type: 'image/gif' })
  } catch (error) {
    worker.terminate()
    rejectPending(error instanceof Error ? error : new Error('GIF 剪切失败'))
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('GIF 剪切失败，请调整起止时间后重试', { cause: error })
  } finally {
    worker.terminate()
  }
}
