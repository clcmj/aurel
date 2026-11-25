import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppInfo, CaptureSource, CaptureTarget, MediaPermissions, RecordedAsset, RecordingSettings } from '../../shared/types'
import { PreviewPanel } from './components/PreviewPanel'
import { RecorderPanel } from './components/RecorderPanel'
import { RecordingDock } from './components/RecordingDock'
import { RecordingHistoryPanel } from './components/RecordingHistoryPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { SourcePicker } from './components/SourcePicker'
import { Icon } from './components/Icon'
import { useRecorder } from './hooks/useRecorder'
import { useRecordingHistory } from './hooks/useRecordingHistory'
import aurelLogo from '../../../assets/icon.png'

const previewSources: CaptureSource[] = [
  { id: 'preview-screen-1', name: '内置显示器 · 界面预览', kind: 'screen', displayId: 1, thumbnail: '' },
  { id: 'preview-window-1', name: 'Aurel · 界面预览', kind: 'window', thumbnail: '' },
]

const defaultSettings: RecordingSettings = {
  outputFormat: 'video',
  videoFormat: 'webm',
  quality: '1080p',
  fps: 30,
  gifFps: 15,
  microphone: false,
  systemAudio: false,
}

export default function App() {
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [target, setTarget] = useState<CaptureTarget | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [regionSelected, setRegionSelected] = useState(false)
  const [loadingSources, setLoadingSources] = useState(true)
  const [selectingRegion, setSelectingRegion] = useState(false)
  const [settings, setSettings] = useState<RecordingSettings>(defaultSettings)
  const [hideWindow, setHideWindow] = useState(true)
  const [appInfo, setAppInfo] = useState<AppInfo>({ name: 'Aurel', version: '1.0.0', platform: 'darwin' })
  const [permissions, setPermissions] = useState<MediaPermissions>({ screen: 'granted', microphone: 'granted', accessibility: 'unknown' })
  const [permissionPrompted, setPermissionPrompted] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [view, setView] = useState<'workspace' | 'result'>('workspace')
  const [selectedAsset, setSelectedAsset] = useState<RecordedAsset | null>(null)
  const [starting, setStarting] = useState(false)
  const recorder = useRecorder()
  const { recordings, addRecording, deleteRecording, error: historyError, clearError: clearHistoryError } = useRecordingHistory()
  const recordingBusy = recorder.status !== 'idle'
  const busy = recordingBusy || starting
  const desktop = Boolean(window.recorder)

  useEffect(() => {
    if (!recorder.asset) return
    const recording = addRecording(recorder.asset)
    setSelectedAsset(recording)
    setView('result')
  }, [addRecording, recorder.asset])

  const loadSources = useCallback(async () => {
    if (!window.recorder) {
      setSources(previewSources)
      setLoadingSources(false)
      return previewSources
    }
    setLoadingSources(true)
    try {
      const nextSources = await window.recorder.getSources()
      setSources(nextSources)
      return nextSources
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : '无法获取画面源')
      return []
    } finally {
      setLoadingSources(false)
    }
  }, [])

  useEffect(() => {
    void loadSources()
    if (!window.recorder) return
    void Promise.all([window.recorder.getAppInfo(), window.recorder.getPermissions()]).then(([info, access]) => {
      setAppInfo(info)
      setPermissions(access)
    })
  }, [loadSources])

  const selectSource = (source: CaptureSource) => {
    setRegionSelected(false)
    setTarget({ mode: source.kind, sourceId: source.id, sourceName: source.name })
    setPreviewUrl(source.thumbnail)
    setGlobalError('')
  }

  const selectRegion = async () => {
    if (!window.recorder || selectingRegion || busy) return
    setSelectingRegion(true)
    setGlobalError('')
    try {
      const selectedScreen = sources.find((source) => source.id === target?.sourceId && source.kind === 'screen')
      const bounds = await window.recorder.selectRegion(selectedScreen?.displayId)
      if (!bounds) return
      const nextSources = await loadSources()
      const source = nextSources.find((item) => item.kind === 'screen' && item.displayId === bounds.displayId)
        ?? nextSources.find((item) => item.kind === 'screen')
      if (!source) throw new Error('未找到区域所在的屏幕，请刷新后重试')
      setTarget({
        mode: 'region',
        sourceId: source.id,
        sourceName: `自定义区域 · ${source.name}`,
        bounds,
      })
      setRegionSelected(true)
      setPreviewUrl('')
      try {
        setPreviewUrl(await window.recorder.getRegionPreview(bounds))
      } catch {
        // The selected bounds still work when a preview cannot be captured.
      }
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : '区域选择失败')
    } finally {
      setSelectingRegion(false)
    }
  }

  const requestPermission = async () => {
    if (!window.recorder) return
    if (permissionPrompted) {
      const access = await window.recorder.getPermissions()
      setPermissions(access)
      setPermissionPrompted(false)
      if (access.screen === 'granted') await loadSources()
      return
    }
    const granted = await window.recorder.requestScreenPermission()
    setPermissionPrompted(!granted)
    setPermissions((current) => ({ ...current, screen: granted ? 'granted' : current.screen }))
    if (granted) await loadSources()
  }

  const requestRegionPermission = async () => {
    if (!window.recorder) return
    const granted = await window.recorder.requestRegionPermission()
    setPermissions((current) => ({ ...current, accessibility: granted ? 'granted' : 'denied' }))
  }

  const start = async () => {
    if (!target || starting) return
    if (!window.recorder) {
      setGlobalError('当前是浏览器界面预览。请运行 npm run dev 启动桌面应用后进行录制。')
      return
    }
    setStarting(true)
    setGlobalError('')
    try {
      const granted = await window.recorder.requestScreenPermission()
      if (!granted) throw new Error('请先在系统设置中允许 Aurel 录制屏幕')
      const displayId = target.bounds?.displayId ?? sources.find((source) => source.id === target.sourceId)?.displayId
      await window.recorder.showCountdown(displayId)
      await recorder.startRecording({ target, settings, hideWindow })
    } catch (startError) {
      setGlobalError(startError instanceof Error ? startError.message : '无法开始录制')
    } finally {
      setStarting(false)
    }
  }

  const openHistory = () => {
    const latest = recordings[0]
    if (!latest) return
    setSelectedAsset(latest)
    setView('result')
  }

  const startNewRecording = () => {
    recorder.discard()
    setSelectedAsset(null)
    setView('workspace')
  }

  const removeRecording = (id: string) => {
    deleteRecording(id)
    if (selectedAsset?.id !== id) return
    const next = recordings.find((recording) => recording.id !== id) ?? null
    setSelectedAsset(next)
    if (!next) {
      if (recorder.asset) recorder.discard()
      setView('workspace')
    }
  }

  const error = recorder.error || globalError || historyError
  const selectedSourceId = target?.sourceId ?? ''
  const permissionBlocked = view === 'workspace' && desktop && appInfo.platform === 'darwin' && permissions.screen !== 'granted'
  const accessibilityBlocked = view === 'workspace' && desktop && appInfo.platform === 'darwin' && permissions.accessibility === 'denied'
  const platformName = useMemo(() => {
    if (appInfo.platform === 'darwin') return 'macOS'
    if (appInfo.platform === 'win32') return 'Windows'
    if (appInfo.platform === 'linux') return 'Linux'
    return appInfo.platform
  }, [appInfo.platform])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img className="brand-mark" src={aurelLogo} alt="Aurel" />
          <div><div className="brand-name">Aurel<span>.</span></div><div className="brand-subtitle">专业录屏工作台</div></div>
        </div>
        <div className="header-center"><span className="header-center__line" />屏幕、声音、灵感，一键留存<span className="header-center__line" /></div>
        <div className="header-actions">
          {accessibilityBlocked && (
            <button type="button" className="accessibility-entry" onClick={() => void requestRegionPermission()}>
              <Icon name="settings" size={15} />开启辅助功能
            </button>
          )}
          <span className="platform-pill">{platformName}</span>
          <span className="privacy-pill"><Icon name="shield" size={15} />隐私优先</span>
          <span className="version">v{appInfo.version}</span>
        </div>
      </header>

      <div className="app-body">
        <nav className="app-nav" aria-label="主导航">
          <div className="app-nav__label">工作区</div>
          <button type="button" className="app-nav__item" aria-label="录制屏幕" aria-current={view === 'workspace' ? 'page' : undefined} onClick={() => setView('workspace')} disabled={busy}>
            <Icon name="video" size={18} /><span>录制屏幕</span>
          </button>
          <button type="button" className="app-nav__item" aria-label="录制记录" aria-current={view === 'result' ? 'page' : undefined} onClick={openHistory} disabled={busy || recordings.length === 0}>
            <Icon name="clock" size={18} /><span>录制记录</span><small>{recordings.length}</small>
          </button>
          <div className="app-nav__footer"><Icon name="shield" size={15} /><span>本地处理<br />不上传文件</span></div>
        </nav>
        <div className="app-content">
          {!desktop && <div className="preview-banner"><Icon name="sparkles" size={17} />当前为浏览器界面预览，实际录制与保存请使用桌面应用。</div>}
      {permissionBlocked && (
        <div className="permission-banner">
          <Icon name="monitor" size={18} />
          <div><strong>需要屏幕录制权限</strong><span>macOS 需要允许 Aurel 录制屏幕后才能获取画面。</span></div>
          <button onClick={() => void requestPermission()}>{permissionPrompted ? '重新检查权限' : '请求权限'}</button>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <Icon name="close" size={17} />
          <span>{error}</span>
          <button onClick={() => { recorder.clearError(); setGlobalError(''); clearHistoryError() }} aria-label="关闭错误提示"><Icon name="close" size={15} /></button>
        </div>
      )}
      {recorder.warning && !busy && <div className="warning-banner"><Icon name="volume" size={17} /><span>{recorder.warning}</span><button onClick={() => recorder.dismissWarning()}>知道了</button></div>}

      {view === 'result' && selectedAsset ? (
        <main className="result-workspace">
          <RecordingHistoryPanel
            recordings={recordings}
            selectedId={selectedAsset.id}
            onSelect={setSelectedAsset}
            onDelete={removeRecording}
          />
          <PreviewPanel key={selectedAsset.id} asset={selectedAsset} onNewRecording={startNewRecording} />
        </main>
      ) : (
        <main className="workspace">
          <div className="workspace-main">
            <SourcePicker
              sources={sources}
              selectedId={selectedSourceId}
              regionSelected={regionSelected}
              loading={loadingSources || selectingRegion}
              disabled={busy}
              onSelect={selectSource}
              onSelectRegion={() => void selectRegion()}
              onRefresh={() => void loadSources()}
            />
            <RecordingDock
              target={target}
              settings={settings}
              status={recorder.status}
              elapsed={recorder.elapsed}
              starting={starting}
              onStart={() => void start()}
            />
          </div>

          <aside className="workspace-sidebar">
            {!recordingBusy && target && (
              <section className="selected-preview panel" aria-label="当前录制画面">
                <div className="selected-preview__image">
                  {previewUrl ? <img src={previewUrl} alt="当前录制画面预览" /> : <Icon name={target.bounds ? 'crop' : 'video'} size={22} />}
                </div>
                <div className="selected-preview__copy">
                  <span>当前画面</span>
                  <strong>{target.sourceName}</strong>
                  <small>{target.bounds ? `${target.bounds.width} × ${target.bounds.height} 自定义区域` : target.mode === 'window' ? '仅录制此窗口' : '整个显示器'}</small>
                </div>
              </section>
            )}
            {recordingBusy ? (
              <RecorderPanel
                target={target}
                settings={settings}
                status={recorder.status}
                elapsed={recorder.elapsed}
                progress={recorder.progress}
                onStart={() => void start()}
                onStop={() => void recorder.stopRecording().catch(() => undefined)}
                onTogglePause={recorder.togglePause}
                onCancelProcessing={recorder.cancelProcessing}
              />
            ) : (
              <SettingsPanel
                settings={settings}
                hideWindow={hideWindow}
                disabled={busy}
                systemAudioSupported={appInfo.platform === 'win32'}
                onChange={setSettings}
                onHideWindowChange={setHideWindow}
              />
            )}
          </aside>
        </main>
      )}

      <footer className="app-footer">
        <span><Icon name="shield" size={14} />所有文件与设置仅保留在你的设备上</span>
        <span>macOS · Windows · Linux<span className="footer-separator">/</span>Aurel {appInfo.version}</span>
      </footer>
        </div>
      </div>
    </div>
  )
}
