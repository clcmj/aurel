import { formatDuration } from '../../../shared/capture'
import type { CaptureTarget, RecordingSettings } from '../../../shared/types'
import type { RecorderStatus } from '../hooks/useRecorder'
import { Icon } from './Icon'

interface RecorderPanelProps {
  target: CaptureTarget | null
  settings: RecordingSettings
  status: RecorderStatus
  elapsed: number
  progress: number
  onStart: () => void
  onStop: () => void
  onTogglePause: () => void
  onCancelProcessing: () => void
}

export function RecorderPanel({ target, settings, status, elapsed, progress, onStart, onStop, onTogglePause, onCancelProcessing }: RecorderPanelProps) {
  const busy = status === 'recording' || status === 'paused' || status === 'processing'
  const output = settings.outputFormat === 'gif'
    ? `GIF · ${settings.gifFps} FPS`
    : `${settings.videoFormat.toUpperCase()} · ${settings.quality === 'native' ? '原始画质' : settings.quality} · ${settings.fps} FPS`

  return (
    <section className={`recorder-panel panel recorder-panel--${status}`}>
      <div className="recorder-topline">
        <span className={`status-dot ${busy ? 'status-dot--active' : ''}`} />
        <span>{status === 'recording' ? '正在录制' : status === 'paused' ? '录制已暂停' : status === 'processing' ? '正在生成文件' : '准备就绪'}</span>
        <span className="local-badge"><Icon name="shield" size={13} />本地</span>
      </div>

      <div className="recorder-hero">
        {status === 'processing' ? (
          <>
            <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as import('react').CSSProperties}>
              <div><strong>{progress}%</strong><span>{settings.outputFormat === 'gif' ? 'GIF 编码' : '处理中'}</span></div>
            </div>
            <h3>{settings.outputFormat === 'gif' ? '正在生成 GIF 动图' : '正在完成录制'}</h3>
            <p>请保持窗口开启，所有处理都在本机完成。</p>
            <button className="secondary-button full-width" onClick={onCancelProcessing}>取消处理</button>
          </>
        ) : busy ? (
          <>
            <div className={`recording-visual ${status === 'paused' ? 'recording-visual--paused' : ''}`}>
              <span className="recording-visual__pulse" />
              <Icon name={status === 'paused' ? 'pause' : 'video'} size={28} />
            </div>
            <div className="recording-time">{formatDuration(elapsed)}<span>.{Math.floor((elapsed % 1) * 10)}</span></div>
            <p>{status === 'paused' ? '画面与声音均已暂停' : settings.outputFormat === 'gif' ? 'GIF 最长录制 60 秒' : '录制正在进行，完成后可预览并保存'}</p>
            <div className="recording-controls">
              <button className="pause-button" onClick={onTogglePause}>
                <Icon name={status === 'paused' ? 'play' : 'pause'} size={18} />
                {status === 'paused' ? '继续' : '暂停'}
              </button>
              <button className="stop-button" onClick={onStop}>
                <Icon name="stop" size={17} />结束录制
              </button>
            </div>
            {status === 'recording' && <div className="audio-bars" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map((bar) => <i key={bar} style={{ animationDelay: `${bar * 0.11}s` }} />)}</div>}
          </>
        ) : (
          <>
            <div className="ready-visual"><Icon name={settings.outputFormat === 'gif' ? 'image' : 'video'} size={30} /></div>
            <h3>{target ? '一切准备就绪' : '请选择录制画面'}</h3>
            <p>{target ? '点击开始后，将按当前设置录制。' : '从左侧选择整个屏幕、应用窗口或自定义区域。'}</p>
            {target && (
              <div className="target-summary">
                <Icon name={target.mode === 'region' ? 'crop' : target.mode === 'screen' ? 'monitor' : 'window'} size={18} />
                <div><strong>{target.sourceName}</strong><span>{target.bounds ? `${target.bounds.width} × ${target.bounds.height} 自定义区域` : target.mode === 'screen' ? '整个显示器' : '仅录制此窗口'}</span></div>
              </div>
            )}
            <button className="record-button" onClick={onStart} disabled={!target}>
              <span className="record-button__dot" />开始录制<Icon name="arrow" size={18} />
            </button>
            <div className="output-summary">{output}</div>
          </>
        )}
      </div>

      <div className="recorder-footer">
        <Icon name="shield" size={15} />
        <span>无账户 · 无上传 · 无水印</span>
      </div>
    </section>
  )
}
