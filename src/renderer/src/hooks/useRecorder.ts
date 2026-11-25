import { useCallback, useEffect, useRef, useState } from 'react'
import fixWebmDuration from 'fix-webm-duration'
import { MAX_GIF_SECONDS, createOutputName, gifDimensions, selectRecordingMimeType } from '../../../shared/capture'
import type { CaptureTarget, RecordedAsset, RecordingSettings, RecordingStatus } from '../../../shared/types'
import { encodeGif } from '../lib/gif'
import { captureScreen } from '../lib/screen'

export type RecorderStatus = RecordingStatus

interface StartOptions {
  target: CaptureTarget
  settings: RecordingSettings
  hideWindow: boolean
}

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [progress, setProgress] = useState(0)
  const [asset, setAsset] = useState<RecordedAsset | null>(null)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cleanupCaptureRef = useRef<(() => void) | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const dimensionsRef = useRef({ width: 1920, height: 1080 })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedAtRef = useRef(0)
  const pausedAtRef = useRef(0)
  const accumulatedRef = useRef(0)
  const stopPromiseRef = useRef<Promise<RecordedAsset> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const assetRef = useRef<RecordedAsset | null>(null)
  const statusRef = useRef<RecorderStatus>('idle')

  const updateStatus = useCallback((next: RecorderStatus) => {
    statusRef.current = next
    setStatus(next)
    void window.recorder?.sendRecordingStatus(next)
  }, [])

  const readElapsed = useCallback(() => {
    if (statusRef.current === 'paused') return (pausedAtRef.current - startedAtRef.current + accumulatedRef.current) / 1000
    if (statusRef.current === 'recording') return (Date.now() - startedAtRef.current + accumulatedRef.current) / 1000
    return accumulatedRef.current / 1000
  }, [])

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    timerRef.current = null
    autoStopRef.current = null
  }, [])

  const releaseStream = useCallback(() => {
    cleanupCaptureRef.current?.()
    cleanupCaptureRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const resetUi = useCallback(() => {
    clearTimers()
    updateStatus('idle')
    setProgress(0)
    void window.recorder?.setRecordingActive(false)
    void window.recorder?.setWindowHidden(false)
  }, [clearTimers, updateStatus])

  const discard = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (assetRef.current) URL.revokeObjectURL(assetRef.current.url)
    assetRef.current = null
    setAsset(null)
    resetUi()
  }, [resetUi])

  const stopRecording = useCallback((): Promise<RecordedAsset> => {
    if (stopPromiseRef.current) return stopPromiseRef.current
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      return assetRef.current ? Promise.resolve(assetRef.current) : Promise.reject(new Error('没有正在进行的录制'))
    }

    const duration = readElapsed()
    accumulatedRef.current = duration * 1000
    clearTimers()
    updateStatus('processing')
    setProgress(0)

    const promise = new Promise<RecordedAsset>((resolve, reject) => {
      recorder.onstop = async () => {
        try {
          const sourceBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
          releaseStream()
          let blob = sourceBlob
          let extension: RecordedAsset['extension'] = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'
          let width = dimensionsRef.current.width
          let height = dimensionsRef.current.height

          if (sourceBlob.size === 0) throw new Error('没有捕获到画面，请重新选择录制源')
          if (recorder.mimeType.includes('webm')) {
            blob = await fixWebmDuration(blob, duration * 1000, { logger: false })
          }

          if (assetRef.current) URL.revokeObjectURL(assetRef.current.url)
          if (recorder.mimeType.includes('mp4') === false && activeFormatRef.current === 'gif') {
            const controller = new AbortController()
            abortRef.current = controller
            blob = await encodeGif(sourceBlob, {
              fps: activeGifFpsRef.current,
              width,
              height,
              duration,
              signal: controller.signal,
              onProgress: setProgress,
            })
            const outputDimensions = gifDimensions(width, height)
            width = outputDimensions.width
            height = outputDimensions.height
            extension = 'gif'
          } else {
            extension = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'
          }

          const createdAt = Date.now()
          let savedPath: string | undefined
          let autoSaveError = ''
          if (window.recorder) {
            try {
              savedPath = await window.recorder.autoSaveFile({
                suggestedName: createOutputName(extension, new Date(createdAt)),
                data: new Uint8Array(await blob.arrayBuffer()),
              })
            } catch (saveError) {
              autoSaveError = `自动保存失败：${saveError instanceof Error ? saveError.message : '请手动保存录制文件'}`
            }
          }

          const nextAsset: RecordedAsset = {
            id: crypto.randomUUID(),
            url: URL.createObjectURL(blob),
            blob,
            extension,
            width,
            height,
            duration,
            size: blob.size,
            createdAt,
            savedPath,
          }
          assetRef.current = nextAsset
          setAsset(nextAsset)
          setError(autoSaveError)
          updateStatus('idle')
          void window.recorder.setRecordingActive(false)
          void window.recorder.setWindowHidden(false)
          resolve(nextAsset)
        } catch (stopError) {
          releaseStream()
          if (!(stopError instanceof DOMException && stopError.name === 'AbortError')) {
            setError(stopError instanceof Error ? stopError.message : '录制失败')
          }
          updateStatus('idle')
          void window.recorder.setRecordingActive(false)
          void window.recorder.setWindowHidden(false)
          reject(stopError)
        } finally {
          stopPromiseRef.current = null
          recorderRef.current = null
          chunksRef.current = []
          abortRef.current = null
        }
      }
      recorder.onerror = () => {
        recorder.onstop = null
        clearTimers()
        releaseStream()
        chunksRef.current = []
        recorderRef.current = null
        stopPromiseRef.current = null
        setError('录制过程中发生错误，请重新尝试')
        updateStatus('idle')
        void window.recorder.setRecordingActive(false)
        void window.recorder.setWindowHidden(false)
        reject(new Error('录制失败'))
      }
      recorder.stop()
    })

    stopPromiseRef.current = promise
    return promise
  }, [clearTimers, readElapsed, releaseStream, updateStatus])

  const activeFormatRef = useRef<RecordingSettings['outputFormat']>('video')
  const activeGifFpsRef = useRef<RecordingSettings['gifFps']>(15)

  const pauseRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (statusRef.current !== 'recording' || !recorder || recorder.state !== 'recording') return
    pausedAtRef.current = Date.now()
    recorder.pause()
    updateStatus('paused')
  }, [updateStatus])

  const resumeRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (statusRef.current !== 'paused' || !recorder || recorder.state !== 'paused') return
    accumulatedRef.current += Date.now() - pausedAtRef.current
    startedAtRef.current = Date.now()
    recorder.resume()
    updateStatus('recording')
  }, [updateStatus])

  const togglePause = useCallback(() => {
    if (statusRef.current === 'recording') pauseRecording()
    else if (statusRef.current === 'paused') resumeRecording()
  }, [pauseRecording, resumeRecording])

  const startRecording = useCallback(async ({ target, settings, hideWindow }: StartOptions) => {
    if (statusRef.current !== 'idle') return
    setError('')
    setWarning('')
    setProgress(0)
    discard()

    try {
      if (!('MediaRecorder' in window)) throw new Error('当前系统不支持视频编码')
      if (window.recorder) {
        const granted = await window.recorder.requestScreenPermission()
        if (!granted) throw new Error('请先在系统设置中允许 Aurel 录制屏幕')
        await window.recorder.setCaptureSource(target.sourceId!)
      }

      const capture = await captureScreen(target, settings)
      streamRef.current = capture.stream
      cleanupCaptureRef.current = capture.cleanup
      dimensionsRef.current = { width: capture.width, height: capture.height }

      const audioTracks: MediaStreamTrack[] = []
      if (settings.systemAudio) {
        try {
          const systemStream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: true })
          audioTracks.push(...systemStream.getAudioTracks())
        } catch {
          setWarning('当前系统未提供系统声音，已继续录制画面')
        }
      }
      if (settings.microphone) {
        try {
          const microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          })
          audioTracks.push(...microphoneStream.getAudioTracks())
        } catch {
          setWarning('未获得麦克风权限，已继续录制画面')
        }
      }

      const stream = new MediaStream([...capture.stream.getVideoTracks(), ...audioTracks])
      streamRef.current = stream
      const hasAudio = stream.getAudioTracks().length > 0
      const mimeType = selectRecordingMimeType(settings, hasAudio)
      if (!mimeType) throw new Error('当前系统不支持所选视频格式，请改用 WebM')

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: settings.outputFormat === 'gif' ? 6_000_000 : settings.quality === 'native' ? 12_000_000 : settings.quality === '1080p' ? 8_000_000 : 5_000_000,
        audioBitsPerSecond: 128_000,
      })
      recorderRef.current = recorder
      stopPromiseRef.current = null
      activeFormatRef.current = settings.outputFormat
      activeGifFpsRef.current = settings.gifFps
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      capture.sourceTrack.addEventListener('ended', () => {
        if (statusRef.current === 'recording' || statusRef.current === 'paused') void stopRecording()
      }, { once: true })

      chunksRef.current = []
      recorder.start(500)
      startedAtRef.current = Date.now()
      pausedAtRef.current = 0
      accumulatedRef.current = 0
      setElapsed(0)
      updateStatus('recording')
      timerRef.current = setInterval(() => setElapsed(readElapsed()), 200)
      void window.recorder?.setRecordingActive(true)
      if (hideWindow) void window.recorder?.setWindowHidden(true)

      if (settings.outputFormat === 'gif') {
        autoStopRef.current = setTimeout(() => {
          setWarning(`GIF 已达到 ${MAX_GIF_SECONDS} 秒上限，正在生成动图`)
          void stopRecording()
        }, MAX_GIF_SECONDS * 1000)
      }
    } catch (startError) {
      releaseStream()
      setError(startError instanceof Error ? startError.message : '无法开始录制')
      updateStatus('idle')
      void window.recorder?.setRecordingActive(false)
      void window.recorder?.setWindowHidden(false)
      throw startError
    }
  }, [discard, readElapsed, releaseStream, stopRecording, updateStatus])

  const cancelProcessing = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  useEffect(() => {
    return window.recorder?.onRecordingControl((action) => {
      if (action === 'toggle-pause') togglePause()
      if (action === 'stop') void stopRecording().catch(() => undefined)
      if (action === 'show') void window.recorder.setWindowHidden(false)
    })
  }, [stopRecording, togglePause])

  useEffect(() => () => {
    clearTimers()
    abortRef.current?.abort()
    releaseStream()
    if (assetRef.current) URL.revokeObjectURL(assetRef.current.url)
    void window.recorder?.setRecordingActive(false)
  }, [clearTimers, releaseStream])

  return {
    status,
    elapsed,
    progress,
    asset,
    error,
    warning,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    togglePause,
    discard,
    cancelProcessing,
    clearError: () => setError(''),
    dismissWarning: () => setWarning(''),
  }
}
