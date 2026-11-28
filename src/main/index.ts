import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, nativeTheme, screen, session, shell, systemPreferences } from 'electron'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import { basename, join } from 'node:path'
import { normalizeRegion } from '../shared/region'
import type { Point } from '../shared/region'
import type { RecordingStatus, RegionBounds, SaveFileRequest } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let recordingControls: BrowserWindow | null = null
let countdownWindow: BrowserWindow | null = null
let selectionHud: BrowserWindow | null = null
let selectionOutline: BrowserWindow[] = []
let selectedSourceId = ''
let pendingSelection: ((bounds: RegionBounds | null) => void) | null = null
let recordingControlStatus: RecordingStatus = 'idle'

const isDev = process.argv.includes('--dev')
const rendererUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173'

function windowBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#0b0d12' : '#f4f6f9'
}

function showRecordingCountdown(displayId?: number): Promise<void> {
  countdownWindow?.close()
  const display = displayId
    ? screen.getAllDisplays().find((item) => item.id === displayId) ?? screen.getPrimaryDisplay()
    : screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const size = 280
  return new Promise((resolve) => {
    let settled = false
    const timers: NodeJS.Timeout[] = []
    const countdown = new BrowserWindow({
      x: Math.round(display.bounds.x + (display.bounds.width - size) / 2),
      y: Math.round(display.bounds.y + (display.bounds.height - size) / 2),
      width: size,
      height: size,
      show: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: false,
      hasShadow: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    countdownWindow = countdown
    countdown.setContentProtection(true)
    countdown.setAlwaysOnTop(true, 'screen-saver')
    countdown.setIgnoreMouseEvents(true)
    const finish = () => {
      if (settled) return
      settled = true
      timers.forEach(clearTimeout)
      if (!countdown.isDestroyed()) countdown.close()
      if (countdownWindow === countdown) countdownWindow = null
      resolve()
    }
    countdown.on('closed', finish)
    countdown.once('ready-to-show', () => {
      if (countdown.isDestroyed()) return
      countdown.showInactive()
    })
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Aurel 倒计时</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{display:grid;place-items:center;background:transparent;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#number{width:240px;height:240px;display:grid;place-items:center;border-radius:50%;background:rgba(14,17,24,.9);border:2px solid rgba(255,255,255,.24);box-shadow:0 20px 60px rgba(0,0,0,.35),inset 0 0 0 10px rgba(255,255,255,.04);color:#fff;font-size:168px;font-weight:700;line-height:1;text-shadow:0 4px 18px rgba(0,0,0,.3);user-select:none}@media(prefers-color-scheme:light){#number{background:rgba(255,255,255,.94);color:#202633;border-color:rgba(36,46,62,.2)}}</style></head><body><div id="number">3</div></body></html>`
    void countdown.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    countdown.webContents.once('did-finish-load', () => {
      timers.push(setTimeout(() => { if (!countdown.isDestroyed()) void countdown.webContents.executeJavaScript(`document.getElementById('number').textContent = '2'`) }, 1000))
      timers.push(setTimeout(() => { if (!countdown.isDestroyed()) void countdown.webContents.executeJavaScript(`document.getElementById('number').textContent = '1'`) }, 2000))
      timers.push(setTimeout(finish, 3000))
    })
  })
}

function updateRecordingControls(status: RecordingStatus) {
  recordingControlStatus = status
  if (!recordingControls || recordingControls.isDestroyed() || recordingControls.webContents.isLoading()) return
  void recordingControls.webContents.executeJavaScript(`(() => {
    const paused = ${JSON.stringify(status)} === 'paused'
    document.getElementById('status').textContent = paused ? '已暂停' : ${JSON.stringify(status)} === 'processing' ? '正在处理' : '正在录制'
    document.getElementById('status').classList.toggle('paused', paused)
    document.getElementById('pause').textContent = paused ? '继续' : '暂停'
    document.getElementById('pause').disabled = ${JSON.stringify(status)} === 'processing'
  })()`)
}

function showRecordingControls() {
  if (recordingControls && !recordingControls.isDestroyed()) {
    recordingControls.showInactive()
    updateRecordingControls(recordingControlStatus)
    return
  }
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const width = 300
  const height = 64
  recordingControls = new BrowserWindow({
    x: Math.round(display.bounds.x + (display.bounds.width - width) / 2),
    y: Math.round(display.bounds.y + display.bounds.height - height - 28),
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  recordingControls.setContentProtection(true)
  recordingControls.setAlwaysOnTop(true, 'screen-saver')
  recordingControls.setIgnoreMouseEvents(false)
  recordingControls.on('closed', () => { recordingControls = null })
  recordingControls.once('ready-to-show', () => {
    recordingControls?.showInactive()
    updateRecordingControls(recordingControlStatus)
  })
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:rgba(20,23,31,.94);border:1px solid rgba(255,255,255,.16);box-shadow:0 10px 30px rgba(0,0,0,.28);color:#f4f5f7;font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;user-select:none;-webkit-app-region:drag}#status{min-width:66px;display:flex;align-items:center;gap:6px;color:#ffb4a7;white-space:nowrap}#status:before{content:"";width:7px;height:7px;border-radius:50%;background:#ff725e;box-shadow:0 0 0 3px rgba(255,114,94,.16)}#status.paused{color:#f0cf8f}#status.paused:before{background:#f0cf8f;box-shadow:0 0 0 3px rgba(240,207,143,.14)}button{height:38px;padding:0 15px;border:0;border-radius:9px;font:inherit;cursor:pointer;-webkit-app-region:no-drag}#pause{background:#ff725e;color:#fff}#stop{margin-left:auto;background:rgba(255,255,255,.1);color:#f4f5f7}button:disabled{opacity:.45;cursor:default}@media(prefers-color-scheme:light){body{background:rgba(255,255,255,.96);color:#202633;border-color:rgba(36,46,62,.16)}#stop{background:rgba(36,46,62,.08);color:#202633}}
  </style></head><body><span id="status">正在录制</span><button id="pause">暂停</button><button id="stop">停止</button></body></html>`
  void recordingControls.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  recordingControls.webContents.once('did-finish-load', () => {
    void recordingControls?.webContents.executeJavaScript(`document.getElementById('pause').onclick = () => window.recorder.sendRecordingControl('toggle-pause'); document.getElementById('stop').onclick = () => window.recorder.sendRecordingControl('stop')`)
    updateRecordingControls(recordingControlStatus)
  })
}

function hideRecordingControls() {
  recordingControls?.close()
  recordingControls = null
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1040,
    minHeight: 700,
    title: 'Aurel',
    backgroundColor: windowBackgroundColor(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(rendererUrl) && !url.startsWith('file://')) event.preventDefault()
  })

  if (isDev) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function restoreMainWindow() {
  selectionHud?.close()
  selectionHud = null
  for (const edge of selectionOutline) edge.close()
  selectionOutline = []
  mainWindow?.show()
  mainWindow?.focus()
}

function updateSelectionHud(text: string, x: number, y: number) {
  if (!selectionHud || selectionHud.isDestroyed()) return
  const display = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) })
  const width = 132
  const height = 34
  const left = Math.min(Math.max(display.bounds.x + 12, x + 18), display.bounds.x + display.bounds.width - width - 12)
  const top = Math.min(Math.max(display.bounds.y + 12, y + 18), display.bounds.y + display.bounds.height - height - 12)
  selectionHud.setBounds({ x: Math.round(left), y: Math.round(top), width, height })
  if (!selectionHud.webContents.isLoading()) {
    void selectionHud.webContents.executeJavaScript(`document.getElementById('label').textContent = ${JSON.stringify(text)}`)
  }
}

function showSelectionOutline(start: Point, end: Point) {
  if (selectionOutline.length === 0) {
    selectionOutline = Array.from({ length: 4 }, () => {
      const edge = new BrowserWindow({
        width: 3,
        height: 3,
        show: false,
        frame: false,
        transparent: false,
        backgroundColor: '#ff725e',
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        focusable: false,
        hasShadow: false,
      })
      edge.setIgnoreMouseEvents(true)
      edge.setAlwaysOnTop(true, 'screen-saver')
      return edge
    })
  }
  const x = Math.round(Math.min(start.x, end.x))
  const y = Math.round(Math.min(start.y, end.y))
  const width = Math.max(3, Math.round(Math.abs(end.x - start.x)))
  const height = Math.max(3, Math.round(Math.abs(end.y - start.y)))
  const thickness = 3
  const bounds = [
    { x, y, width, height: thickness },
    { x, y: y + height - thickness, width, height: thickness },
    { x, y, width: thickness, height },
    { x: x + width - thickness, y, width: thickness, height },
  ]
  selectionOutline.forEach((edge, index) => {
    edge.setBounds(bounds[index])
    edge.showInactive()
  })
}

function showSelectionHud() {
  selectionHud = new BrowserWindow({
    width: 132,
    height: 34,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#14171f',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  selectionHud.setIgnoreMouseEvents(true)
  selectionHud.setAlwaysOnTop(true, 'screen-saver')
  selectionHud.once('ready-to-show', () => selectionHud?.showInactive())
  void selectionHud.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{display:grid;place-items:center;background:#14171f;color:#f4f5f7;font:12px -apple-system,BlinkMacSystemFont,sans-serif;border:1px solid rgba(255,255,255,.16);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.25);user-select:none}</style></head><body><span id="label">拖动选择区域</span></body></html>`))
}

function selectSystemRegion(initialDisplayId?: number): Promise<RegionBounds | null> {
  if (pendingSelection) return Promise.resolve(null)
  if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(true)) {
    void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
    return Promise.reject(new Error('已打开系统设置，请允许 Aurel 控制电脑后再点击区域选择'))
  }

  return new Promise((resolve, reject) => {
    let start: (Point & { displayId: number }) | null = null
    let settled = false
    let timeout: NodeJS.Timeout | undefined

    const cleanup = () => {
      if (timeout) clearTimeout(timeout)
      uIOhook.off('mousedown', onMouseDown)
      uIOhook.off('mousemove', onMouseMove)
      uIOhook.off('mouseup', onMouseUp)
      uIOhook.off('keydown', onKeyDown)
      uIOhook.stop()
      pendingSelection = null
      restoreMainWindow()
    }

    const finish = (bounds: RegionBounds | null) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(bounds)
    }

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const onMouseDown = (event: { x: number; y: number; button: unknown }) => {
      if (event.button !== 1 && event.button !== 0) return
      const display = screen.getDisplayNearestPoint({ x: Math.round(event.x), y: Math.round(event.y) })
      if (initialDisplayId && display.id !== initialDisplayId) return
      start = { x: Math.round(event.x), y: Math.round(event.y), displayId: display.id }
      showSelectionOutline(start, start)
      updateSelectionHud('松开完成', event.x, event.y)
    }

    const onMouseMove = (event: { x: number; y: number }) => {
      if (!start) return
      const width = Math.round(Math.abs(event.x - start.x))
      const height = Math.round(Math.abs(event.y - start.y))
      showSelectionOutline(start, { x: Math.round(event.x), y: Math.round(event.y) })
      updateSelectionHud(`${width} × ${height}`, event.x, event.y)
    }

    const onMouseUp = (event: { x: number; y: number; button: unknown }) => {
      if ((event.button !== 1 && event.button !== 0) || !start) return
      const display = screen.getAllDisplays().find((item) => item.id === start?.displayId)
      const endDisplay = screen.getDisplayNearestPoint({ x: Math.round(event.x), y: Math.round(event.y) })
      if (!display || display.id !== endDisplay.id) {
        start = null
        return
      }
      const bounds = normalizeRegion(start, { x: Math.round(event.x), y: Math.round(event.y) }, {
        x: display.bounds.x,
        y: display.bounds.y,
      }, display.id, display.scaleFactor)
      start = null
      if (bounds.width < 24 || bounds.height < 24) return
      finish(bounds)
    }

    const onKeyDown = (event: { keycode: number }) => {
      if (event.keycode === UiohookKey.Escape) finish(null)
    }

    pendingSelection = (bounds) => finish(bounds)
    uIOhook.on('mousedown', onMouseDown)
    uIOhook.on('mousemove', onMouseMove)
    uIOhook.on('mouseup', onMouseUp)
    uIOhook.on('keydown', onKeyDown)
    try {
      uIOhook.start()
      mainWindow?.hide()
      showSelectionHud()
      timeout = setTimeout(() => fail(new Error('未检测到区域拖拽，请重新点击区域选择')), 20000)
    } catch (error) {
      fail(error instanceof Error ? error : new Error('无法启动系统屏幕框选'))
    }
  })
}

function registerIpc() {
  ipcMain.handle('capture:sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 480, height: 270 },
      fetchWindowIcons: true,
    })

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.id.startsWith('screen:') ? 'screen' : 'window',
      displayId: source.display_id ? Number(source.display_id) : undefined,
      thumbnail: source.thumbnail.isEmpty() ? '' : source.thumbnail.resize({ width: 480, height: 270 }).toDataURL(),
    }))
  })

  ipcMain.handle('capture:set-source', (_event, sourceId: string) => {
    selectedSourceId = sourceId
  })

  ipcMain.handle('display:get', (_event, displayId: number) => {
    const display = screen.getAllDisplays().find((item) => item.id === displayId)
    if (!display) throw new Error('显示器不存在')
    return { id: display.id, bounds: display.bounds, scaleFactor: display.scaleFactor }
  })
  ipcMain.handle('capture:region-preview', async (_event, bounds: RegionBounds) => {
    const display = screen.getAllDisplays().find((item) => item.id === bounds.displayId)
    if (!display) return ''
    const scaleFactor = display.scaleFactor || 1
    const physicalWidth = Math.round(display.bounds.width * scaleFactor)
    const physicalHeight = Math.round(display.bounds.height * scaleFactor)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: physicalWidth, height: physicalHeight },
    })
    const source = sources.find((item) => Number(item.display_id) === bounds.displayId)
    if (!source || source.thumbnail.isEmpty()) return ''
    const fullImage = source.thumbnail.resize({ width: physicalWidth, height: physicalHeight })
    const cropped = fullImage.crop({
      x: Math.max(0, Math.round((bounds.x - display.bounds.x) * scaleFactor)),
      y: Math.max(0, Math.round((bounds.y - display.bounds.y) * scaleFactor)),
      width: Math.max(1, Math.round(bounds.width * scaleFactor)),
      height: Math.max(1, Math.round(bounds.height * scaleFactor)),
    })
    if (cropped.isEmpty()) return ''
    return cropped.resize({ width: Math.min(320, cropped.getSize().width) }).toDataURL()
  })

  ipcMain.handle('region:select', (_event, displayId?: number) => selectSystemRegion(displayId))

  ipcMain.handle('recording:countdown', (_event, displayId?: number) => showRecordingCountdown(displayId))

  ipcMain.on('recording:active', (_event, active: boolean) => {
    mainWindow?.webContents.setBackgroundThrottling(!active)
    globalShortcut.unregisterAll()
    if (!active) {
      hideRecordingControls()
      return
    }
    recordingControlStatus = 'recording'
    showRecordingControls()
    mainWindow?.hide()
    const shortcuts: Array<[string, 'toggle-pause' | 'stop' | 'show']> = [
      ['CommandOrControl+Shift+R', 'toggle-pause'],
      ['CommandOrControl+Shift+S', 'stop'],
      ['CommandOrControl+Shift+L', 'show'],
    ]
    for (const [accelerator, action] of shortcuts) {
      globalShortcut.register(accelerator, () => mainWindow?.webContents.send('recording:control', action))
    }
  })

  ipcMain.on('recording:control-request', (_event, action: 'toggle-pause' | 'stop') => {
    mainWindow?.webContents.send('recording:control', action)
  })

  ipcMain.on('recording:status', (_event, status: RecordingStatus) => {
    updateRecordingControls(status)
  })

  ipcMain.handle('window:hidden', (_event, hidden: boolean) => {
    if (!mainWindow) return
    if (hidden) {
      mainWindow.webContents.setBackgroundThrottling(false)
      mainWindow.setIgnoreMouseEvents(true)
      mainWindow.setOpacity(0)
    } else {
      mainWindow.setIgnoreMouseEvents(false)
      mainWindow.setOpacity(1)
      mainWindow.show()
      mainWindow.focus()
    }
  })

  ipcMain.handle('app:info', () => ({
    name: 'Aurel',
    version: app.getVersion(),
    platform: process.platform,
  }))

  ipcMain.handle('app:permissions', () => {
    if (process.platform !== 'darwin') {
      return { screen: 'granted', microphone: 'granted', accessibility: 'granted' }
    }
    const screenAccess = systemPreferences.getMediaAccessStatus('screen')
    const microphoneAccess = systemPreferences.getMediaAccessStatus('microphone')
    return {
      screen: screenAccess === 'not-determined' ? 'unknown' : screenAccess,
      microphone: microphoneAccess === 'not-determined' ? 'unknown' : microphoneAccess,
      accessibility: systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'denied',
    }
  })

  ipcMain.handle('app:request-screen-permission', async () => {
    if (process.platform !== 'darwin') return true
    if (systemPreferences.getMediaAccessStatus('screen') === 'granted') return true
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    return false
  })

  ipcMain.handle('app:request-region-permission', async () => {
    if (process.platform !== 'darwin') return true
    if (systemPreferences.isTrustedAccessibilityClient(false)) return true
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
    return false
  })

  ipcMain.handle('file:auto-save', async (_event, request: SaveFileRequest) => {
    const { mkdir, writeFile } = await import('node:fs/promises')
    const directory = join(app.getPath('videos'), 'Aurel')
    const suggestedName = basename(request.suggestedName)
    const extensionIndex = suggestedName.lastIndexOf('.')
    const stem = extensionIndex > 0 ? suggestedName.slice(0, extensionIndex) : suggestedName
    const extension = extensionIndex > 0 ? suggestedName.slice(extensionIndex) : ''
    await mkdir(directory, { recursive: true })

    for (let suffix = 0; ; suffix += 1) {
      const filename = suffix === 0 ? suggestedName : `${stem}-${suffix}${extension}`
      const filePath = join(directory, filename)
      try {
        await writeFile(filePath, request.data, { flag: 'wx' })
        return filePath
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    }
  })

  ipcMain.handle('file:save', async (event, request: SaveFileRequest) => {
    const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender) ?? mainWindow!, {
      title: '保存录制文件',
      defaultPath: join(app.getPath('videos'), request.suggestedName),
      filters: [
        { name: request.suggestedName.endsWith('.gif') ? 'GIF 动图' : '视频文件', extensions: [request.suggestedName.split('.').pop() ?? 'webm'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    if (result.canceled || !result.filePath) return null

    const { writeFile } = await import('node:fs/promises')
    await writeFile(result.filePath, request.data)
    return result.filePath
  })

  ipcMain.handle('shell:open-path', async (_event, filePath: string) => {
    const error = await shell.openPath(filePath)
    if (error) throw new Error(error)
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('before-quit', () => {
    uIOhook.stop()
    hideRecordingControls()
    countdownWindow?.close()
  })
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    nativeTheme.themeSource = 'system'
    nativeTheme.on('updated', () => mainWindow?.setBackgroundColor(windowBackgroundColor()))
    app.setAppUserModelId('com.localcap.app')
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      callback({
        video: request.videoRequested && selectedSourceId ? { id: selectedSourceId, name: '' } : undefined,
        audio: request.audioRequested && process.platform === 'win32' ? 'loopbackWithMute' : undefined,
      })
    })

    registerIpc()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    globalShortcut.unregisterAll()
    if (process.platform !== 'darwin') app.quit()
  })
}
