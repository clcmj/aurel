import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOutputName, formatBytes, formatDuration, gifDimensions, qualityDimensions, selectRecordingMimeType, selectVideoMimeType } from './capture'
import type { RecordingSettings } from './types'

const settings: RecordingSettings = {
  outputFormat: 'video',
  videoFormat: 'webm',
  quality: '1080p',
  fps: 30,
  gifFps: 15,
  microphone: false,
  systemAudio: false,
}

function mockCodecSupport(supported: (type: string) => boolean) {
  vi.stubGlobal('MediaRecorder', class {
    static isTypeSupported = supported
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('video codec selection', () => {
  it('prefers VP9 for WebM', () => {
    mockCodecSupport(() => true)
    expect(selectVideoMimeType('webm', false)).toBe('video/webm;codecs=vp9')
  })

  it('includes an audio codec for MP4 when audio is present', () => {
    mockCodecSupport(() => true)
    expect(selectVideoMimeType('mp4', true)).toBe('video/mp4;codecs=avc1,mp4a.40.2')
  })

  it('falls back to a generic container', () => {
    mockCodecSupport((type) => type === 'video/mp4')
    expect(selectVideoMimeType('mp4', true)).toBe('video/mp4')
  })

  it('records GIF source video as WebM regardless of video setting', () => {
    mockCodecSupport((type) => type.includes('webm'))
    expect(selectRecordingMimeType({ ...settings, outputFormat: 'gif', videoFormat: 'mp4' }, false)).toBe('video/webm;codecs=vp9')
  })

  it('reports an unsupported codec instead of guessing', () => {
    mockCodecSupport(() => false)
    expect(selectVideoMimeType('webm', false)).toBe('')
  })
})

describe('output dimensions', () => {
  it('downscales 4K to 1080p while preserving aspect ratio', () => {
    expect(qualityDimensions(3840, 2160, '1080p')).toEqual({ width: 1920, height: 1080 })
  })

  it('keeps native dimensions', () => {
    expect(qualityDimensions(3840, 2160, 'native')).toEqual({ width: 3840, height: 2160 })
  })

  it('does not upscale smaller sources', () => {
    expect(qualityDimensions(1280, 720, '1080p')).toEqual({ width: 1280, height: 720 })
  })

  it('caps GIF width and preserves aspect ratio', () => {
    expect(gifDimensions(1920, 1080)).toEqual({ width: 1280, height: 720 })
    expect(gifDimensions(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe('output formatting', () => {
  it('creates a safe, sortable filename', () => {
    expect(createOutputName('gif', new Date(2026, 10, 24, 9, 8, 7))).toBe('Aurel-2026-11-24-090807.gif')
  })

  it('formats duration and file size', () => {
    expect(formatDuration(125.9)).toBe('02:05')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
