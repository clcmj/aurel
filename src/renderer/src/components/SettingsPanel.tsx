import type { RecordingSettings } from '../../../shared/types'
import { Icon } from './Icon'
import { Toggle } from './Toggle'

interface SettingsPanelProps {
  settings: RecordingSettings
  hideWindow: boolean
  disabled: boolean
  systemAudioSupported: boolean
  onChange: (settings: RecordingSettings) => void
  onHideWindowChange: (value: boolean) => void
}

export function SettingsPanel({ settings, hideWindow, disabled, systemAudioSupported, onChange, onHideWindowChange }: SettingsPanelProps) {
  const update = <K extends keyof RecordingSettings>(key: K, value: RecordingSettings[K]) => onChange({ ...settings, [key]: value })
  const isGif = settings.outputFormat === 'gif'

  return (
    <section className="settings-panel panel">
      <div className="section-heading section-heading--compact">
        <div>
          <div className="eyebrow">OUTPUT SETTINGS</div>
          <h2>录制设置</h2>
        </div>
        <Icon name="settings" className="muted-icon" />
      </div>

      <div className="format-switch" aria-label="导出格式">
        <button className={!isGif ? 'active' : ''} onClick={() => update('outputFormat', 'video')} disabled={disabled}>
          <Icon name="video" size={18} />视频
        </button>
        <button className={isGif ? 'active' : ''} onClick={() => update('outputFormat', 'gif')} disabled={disabled}>
          <Icon name="image" size={18} />GIF 动图
        </button>
      </div>

      {isGif && (
        <div className="gif-note"><Icon name="sparkles" size={17} /><span>自动优化为 1280px 宽度、最长 60 秒，适合快速分享。</span></div>
      )}

      <div className="field-row field-row--output">
        {!isGif && (
          <label className="field">
            <span>视频格式</span>
            <select value={settings.videoFormat} onChange={(event) => update('videoFormat', event.target.value as RecordingSettings['videoFormat'])} disabled={disabled}>
              <option value="webm">WebM · 兼容性更好</option>
              <option value="mp4">MP4 · 通用播放</option>
            </select>
          </label>
        )}
        <label className="field">
          <span>{isGif ? 'GIF 帧率' : '画面质量'}</span>
          {isGif ? (
            <select value={settings.gifFps} onChange={(event) => update('gifFps', Number(event.target.value) as RecordingSettings['gifFps'])} disabled={disabled}>
              <option value={10}>10 FPS · 更小</option>
              <option value={15}>15 FPS · 推荐</option>
              <option value={20}>20 FPS · 更流畅</option>
            </select>
          ) : (
            <select value={settings.quality} onChange={(event) => update('quality', event.target.value as RecordingSettings['quality'])} disabled={disabled}>
              <option value="1080p">1080p · 高清</option>
              <option value="720p">720p · 轻量</option>
              <option value="native">原始分辨率</option>
            </select>
          )}
        </label>
        {!isGif && (
          <label className="field">
            <span>帧率</span>
            <select value={settings.fps} onChange={(event) => update('fps', Number(event.target.value) as RecordingSettings['fps'])} disabled={disabled}>
              <option value={30}>30 FPS</option>
              <option value={60}>60 FPS</option>
            </select>
          </label>
        )}
      </div>

      <div className="settings-divider" />

      <div className="setting-row">
        <span className="setting-icon"><Icon name="mic" size={18} /></span>
        <div className="setting-copy"><strong>麦克风</strong><span>录入你的声音</span></div>
        <Toggle label="麦克风" checked={settings.microphone} onChange={(value) => update('microphone', value)} disabled={disabled} />
      </div>
      <div className="setting-row">
        <span className="setting-icon"><Icon name="volume" size={18} /></span>
        <div className="setting-copy"><strong>系统声音</strong><span>{systemAudioSupported ? '录入设备播放的声音' : 'Windows 支持，其他系统请用麦克风'}</span></div>
        <Toggle label="系统声音" checked={settings.systemAudio} onChange={(value) => update('systemAudio', value)} disabled={disabled || !systemAudioSupported} />
      </div>
      <div className="setting-row">
        <span className="setting-icon"><Icon name="window" size={18} /></span>
        <div className="setting-copy"><strong>录制时隐藏窗口</strong><span>避免录到 Aurel 自己</span></div>
        <Toggle label="录制时隐藏窗口" checked={hideWindow} onChange={onHideWindowChange} disabled={disabled} />
      </div>

      <div className="shortcut-card">
        <div className="shortcut-card__title"><Icon name="clock" size={15} />隐藏窗口后的快捷键</div>
        <div><span>暂停 / 继续</span><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>R</kbd></div>
        <div><span>结束录制</span><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>S</kbd></div>
        <div><span>显示窗口</span><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>L</kbd></div>
        <small>macOS 上 Ctrl 对应 ⌘</small>
      </div>

    </section>
  )
}
