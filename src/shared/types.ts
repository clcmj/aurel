export type SourceKind = 'screen' | 'window'

export interface CaptureSource {
  id: string
  name: string
  kind: SourceKind
  displayId?: number
  thumbnail: string
}

export interface RegionBounds {
  x: number
  y: number
  width: number
  height: number
  displayId: number
  scaleFactor: number
}

export interface CaptureTarget {
  mode: SourceKind | 'region'
  sourceId?: string
  sourceName: string
  bounds?: RegionBounds
}

export type VideoFormat = 'webm' | 'mp4'
export type OutputFormat = 'video' | 'gif'
export type VideoQuality = '720p' | '1080p' | 'native'

export interface RecordingSettings {
  outputFormat: OutputFormat
  videoFormat: VideoFormat
  quality: VideoQuality
  fps: 30 | 60
  gifFps: 10 | 15 | 20
  microphone: boolean
  systemAudio: boolean
}

export interface RecordedAsset {
  id: string
  url: string
  blob: Blob
  extension: 'webm' | 'mp4' | 'gif'
  width: number
  height: number
  duration: number
  size: number
  createdAt: number
  savedPath?: string
}

export interface AppInfo {
  name: string
  version: string
  platform: NodeJS.Platform
}

export interface MediaPermissions {
  screen: 'granted' | 'denied' | 'restricted' | 'unknown'
  microphone: 'granted' | 'denied' | 'restricted' | 'unknown'
  accessibility: 'granted' | 'denied' | 'restricted' | 'unknown'
}

export interface SaveFileRequest {
  suggestedName: string
  data: Uint8Array
}

export interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
}

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing'

export interface RecorderBridge {
  getSources: () => Promise<CaptureSource[]>
  getAppInfo: () => Promise<AppInfo>
  getPermissions: () => Promise<MediaPermissions>
  requestScreenPermission: () => Promise<boolean>
  requestRegionPermission: () => Promise<boolean>
  setCaptureSource: (sourceId: string) => Promise<void>
  selectRegion: (displayId?: number) => Promise<RegionBounds | null>
  getDisplay: (displayId: number) => Promise<DisplayInfo>
  getRegionPreview: (bounds: RegionBounds) => Promise<string>
  showCountdown: (displayId?: number) => Promise<void>
  setRecordingActive: (active: boolean) => void
  sendRecordingControl: (action: 'toggle-pause' | 'stop') => void
  sendRecordingStatus: (status: RecordingStatus) => void
  setWindowHidden: (hidden: boolean) => Promise<void>
  onRecordingControl: (callback: (action: 'toggle-pause' | 'stop' | 'show') => void) => () => void
  saveFile: (request: SaveFileRequest) => Promise<string | null>
  autoSaveFile: (request: SaveFileRequest) => Promise<string>
  openPath: (filePath: string) => Promise<void>
  getPlatform: () => Promise<NodeJS.Platform>
}

declare global {
  interface Window {
    recorder: RecorderBridge
  }
}
