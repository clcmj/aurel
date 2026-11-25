import type { RecordingSettings } from './types'

export const MAX_GIF_SECONDS = 60
export const MAX_GIF_WIDTH = 1280

export function selectVideoMimeType(format: 'webm' | 'mp4', includeAudio: boolean) {
  const audio = includeAudio ? `,opus` : ''
  const candidates = format === 'mp4'
    ? [
        `video/mp4;codecs=avc1${includeAudio ? ',mp4a.40.2' : ''}`,
        `video/mp4;codecs=avc1.42E01E${includeAudio ? ',mp4a.40.2' : ''}`,
        'video/mp4',
      ]
    : [
        `video/webm;codecs=vp9${audio}`,
        `video/webm;codecs=vp8${audio}`,
        'video/webm',
      ]

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export function selectRecordingMimeType(settings: RecordingSettings, hasAudio: boolean) {
  const format = settings.outputFormat === 'gif' ? 'webm' : settings.videoFormat
  return selectVideoMimeType(format, hasAudio)
}

export function qualityDimensions(
  sourceWidth: number,
  sourceHeight: number,
  quality: RecordingSettings['quality'],
) {
  if (quality === 'native' || sourceWidth <= 1280) {
    return { width: sourceWidth, height: sourceHeight }
  }

  const targetHeight = quality === '1080p' ? 1080 : 720
  const width = Math.round((sourceWidth * targetHeight / sourceHeight) / 2) * 2
  return { width, height: targetHeight }
}

export function gifDimensions(width: number, height: number) {
  if (width <= MAX_GIF_WIDTH) return { width, height }
  const scale = MAX_GIF_WIDTH / width
  return { width: MAX_GIF_WIDTH, height: Math.max(1, Math.round(height * scale)) }
}

export function createOutputName(format: 'webm' | 'mp4' | 'gif', createdAt = new Date()) {
  const date = [
    createdAt.getFullYear(),
    String(createdAt.getMonth() + 1).padStart(2, '0'),
    String(createdAt.getDate()).padStart(2, '0'),
  ].join('-')
  const time = [
    String(createdAt.getHours()).padStart(2, '0'),
    String(createdAt.getMinutes()).padStart(2, '0'),
    String(createdAt.getSeconds()).padStart(2, '0'),
  ].join('')
  return `Aurel-${date}-${time}.${format}`
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}
