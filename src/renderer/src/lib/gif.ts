import { gifDimensions } from '../../../shared/capture'

interface GifOptions {
  fps: number
  width: number
  height: number
  duration: number
  onProgress: (progress: number) => void
  signal: AbortSignal
}

function waitForMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    if (video.readyState >= 1) {
      resolve()
      return
    }
    const onLoaded = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('无法读取录制视频'))
    }
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('error', onError)
  })
}

function seek(video: HTMLVideoElement, time: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('已取消', 'AbortError'))
      return
    }
    if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2) {
      resolve()
      return
    }
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('视频解码失败'))
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException('已取消', 'AbortError'))
    }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
    }
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    signal.addEventListener('abort', onAbort, { once: true })
    video.currentTime = time
  })
}

export async function encodeGif(blob: Blob, options: GifOptions) {
  const { fps, width, height, duration, onProgress, signal } = options
  const dimensions = gifDimensions(width, height)
  const url = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  const worker = new Worker(new URL('./gif.worker.ts', import.meta.url), { type: 'module' })
  const totalFrames = Math.max(1, Math.ceil(duration * fps))
  let frameId = 0
  const pendingFrames = new Map<number, { resolve: () => void; reject: (error: Error) => void }>()
  let finishFrame: { resolve: (buffer: ArrayBuffer) => void; reject: (error: Error) => void } | null = null

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
  worker.onerror = () => rejectPending(new Error('GIF 编码失败'))

  const encodeFrame = (id: number, buffer: ArrayBuffer) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('已取消', 'AbortError'))
      return
    }
    const onAbort = () => {
      pendingFrames.delete(id)
      reject(new DOMException('已取消', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    pendingFrames.set(id, {
      resolve: () => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      },
      reject,
    })
    worker.postMessage({
      type: 'frame',
      id,
      buffer,
      width: dimensions.width,
      height: dimensions.height,
      delay: Math.round(1000 / fps),
    }, [buffer])
  })

  const finish = () => new Promise<ArrayBuffer>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('已取消', 'AbortError'))
      return
    }
    const onAbort = () => {
      finishFrame = null
      reject(new DOMException('已取消', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    finishFrame = {
      resolve: (buffer) => {
        signal.removeEventListener('abort', onAbort)
        resolve(buffer)
      },
      reject,
    }
    worker.postMessage({ type: 'finish' })
  })

  try {
    await waitForMetadata(video)
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
    if (!context) throw new Error('当前设备无法创建 GIF 画布')

    const safeDuration = Math.max(0.01, Math.min(duration, Number.isFinite(video.duration) ? video.duration : duration))
    for (let frame = 0; frame < totalFrames; frame += 1) {
      if (signal.aborted) throw new DOMException('已取消', 'AbortError')
      const time = Math.min(frame / fps, Math.max(0, safeDuration - 0.001))
      await seek(video, time, signal)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const image = context.getImageData(0, 0, canvas.width, canvas.height)
      await encodeFrame(frameId, image.data.buffer as ArrayBuffer)
      frameId += 1
      onProgress(Math.round((frameId / totalFrames) * 100))
    }
    const result = await finish()
    return new Blob([result], { type: 'image/gif' })
  } catch (error) {
    worker.terminate()
    rejectPending(error instanceof Error ? error : new Error('GIF 编码失败'))
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('GIF 编码失败，请尝试降低帧率后重试', { cause: error })
  } finally {
    worker.terminate()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
