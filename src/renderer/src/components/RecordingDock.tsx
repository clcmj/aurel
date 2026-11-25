import { formatDuration } from '../../../shared/capture'
import type { CaptureTarget, RecordingSettings } from '../../../shared/types'
import type { RecorderStatus } from '../hooks/useRecorder'
import { Icon } from './Icon'

interface RecordingDockProps {
  target: CaptureTarget | null
  settings: RecordingSettings
  status: RecorderStatus
  elapsed: number
  starting: boolean
  onStart: () => void
}

export function RecordingDock({ target, settings, status, elapsed, starting, onStart }: RecordingDockProps) {
  const busy = status !== 'idle'
  const statusLabel = status === 'recording' ? '正在录制' : status === 'paused' ? '录制已暂停' : '正在生成文件'
  const output = settings.outputFormat === 'gif'
    ? `GIF · ${settings.gifFps} FPS`
    : `${settings.videoFormat.toUpperCase()} · ${settings.quality === 'native' ? '原始画质' : settings.quality} · ${settings.fps} FPS`
  const targetDetail = target?.bounds
    ? `${target.bounds.width} × ${target.bounds.height} 自定义区域`
    : target?.mode === 'window' ? '仅录制此窗口' : '整个显示器'

  return (
    <section className="recording-dock panel" aria-label="录制操作">
      <div className="recording-dock__actions">
        {busy ? (
          <div className="recording-dock__status">
            <span className="status-dot status-dot--active" />
            <div><strong>{statusLabel}</strong><small>{formatDuration(elapsed)}</small></div>
          </div>
        ) : (
          <button className="record-button" onClick={onStart} disabled={!target || starting}>
            <span className="record-button__dot" />{starting ? '倒计时…' : '开始录制'}<Icon name={starting ? 'clock' : 'arrow'} size={18} />
          </button>
        )}
      </div>
      <div className="recording-dock__summary">
        <strong>{target?.sourceName ?? '请选择录制画面'}</strong>
        <span>{target ? `${targetDetail} · ${output}` : `屏幕、窗口或自定义区域 · ${output}`}</span>
      </div>
    </section>
  )
}
