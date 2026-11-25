import { qualityDimensions } from '../../../shared/capture'
import type { CaptureTarget, RecordingSettings } from '../../../shared/types'

interface ScreenCaptureResult {
  stream: MediaStream
  sourceTrack: MediaStreamTrack
  width: number
  height: number
  cleanup: () => void
}

function waitForVideo(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      resolve()
      return
    }
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('无法启动屏幕画面，请检查系统录屏权限'))
    }
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('error', onError)
  })
}

export async function captureScreen(target: CaptureTarget, settings: RecordingSettings): Promise<ScreenCaptureResult> {
  if (!target.sourceId) throw new Error('请先选择录制画面')

  const rawStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: 7680 },
      height: { ideal: 4320 },
      frameRate: { ideal: settings.fps, max: 60 },
    },
    audio: false,
  })

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = rawStream
  video.style.display = 'none'
  document.body.appendChild(video)

  try {
    await waitForVideo(video)
    await video.play()

    let sourceX = 0
    let sourceY = 0
    let sourceWidth = video.videoWidth
    let sourceHeight = video.videoHeight

    if (target.bounds) {
      const display = await window.recorder.getDisplay(target.bounds.displayId)
      const scaleX = video.videoWidth / display.bounds.width
      const scaleY = video.videoHeight / display.bounds.height
      sourceX = (target.bounds.x - display.bounds.x) * scaleX
      sourceY = (target.bounds.y - display.bounds.y) * scaleY
      sourceWidth = target.bounds.width * scaleX
      sourceHeight = target.bounds.height * scaleY
    }

    const dimensions = qualityDimensions(sourceWidth, sourceHeight, settings.quality)
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('当前设备无法创建录制画布')

    const canvasStream = canvas.captureStream(0)
    const canvasTrack = canvasStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
    const audioTracks = rawStream.getAudioTracks()
    const stream = new MediaStream([canvasTrack, ...audioTracks])
    let stopped = false

    const draw = () => {
      if (stopped) return
      context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
      canvasTrack.requestFrame()
    }
    draw()
    const frameTimer = setInterval(draw, 1000 / settings.fps)

    return {
      stream,
      sourceTrack: rawStream.getVideoTracks()[0],
      width: canvas.width,
      height: canvas.height,
      cleanup: () => {
        stopped = true
        clearInterval(frameTimer)
        canvasStream.getTracks().forEach((track) => track.stop())
        rawStream.getTracks().forEach((track) => track.stop())
        video.pause()
        video.removeAttribute('srcObject')
        video.remove()
      },
    }
  } catch (error) {
    rawStream.getTracks().forEach((track) => track.stop())
    video.removeAttribute('srcObject')
    video.remove()
    throw error
  }
}
