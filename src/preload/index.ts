import { contextBridge, ipcRenderer } from 'electron'
import type { RecorderBridge } from '../shared/types'

const recorder: RecorderBridge = {
  getSources: () => ipcRenderer.invoke('capture:sources'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  getPermissions: () => ipcRenderer.invoke('app:permissions'),
  requestScreenPermission: () => ipcRenderer.invoke('app:request-screen-permission'),
  requestRegionPermission: () => ipcRenderer.invoke('app:request-region-permission'),
  setCaptureSource: (sourceId) => ipcRenderer.invoke('capture:set-source', sourceId),
  selectRegion: (displayId) => ipcRenderer.invoke('region:select', displayId),
  getDisplay: (displayId) => ipcRenderer.invoke('display:get', displayId),
  getRegionPreview: (bounds) => ipcRenderer.invoke('capture:region-preview', bounds),
  showCountdown: (displayId) => ipcRenderer.invoke('recording:countdown', displayId),
  setRecordingActive: (active) => ipcRenderer.send('recording:active', active),
  sendRecordingControl: (action) => ipcRenderer.send('recording:control-request', action),
  sendRecordingStatus: (status) => ipcRenderer.send('recording:status', status),
  setWindowHidden: (hidden) => ipcRenderer.send('window:hidden', hidden),
  onRecordingControl: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, action: 'toggle-pause' | 'stop' | 'show') => callback(action)
    ipcRenderer.on('recording:control', listener)
    return () => ipcRenderer.removeListener('recording:control', listener)
  },
  saveFile: (request) => ipcRenderer.invoke('file:save', request),
  autoSaveFile: (request) => ipcRenderer.invoke('file:auto-save', request),
  openPath: (filePath) => ipcRenderer.invoke('shell:open-path', filePath),
  getPlatform: () => ipcRenderer.invoke('app:info').then((info) => info.platform),
}

contextBridge.exposeInMainWorld('recorder', recorder)
