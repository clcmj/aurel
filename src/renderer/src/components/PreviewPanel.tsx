import { useState } from 'react'
import { createOutputName, formatBytes, formatDuration } from '../../../shared/capture'
import type { RecordedAsset } from '../../../shared/types'
import { Icon } from './Icon'

interface PreviewPanelProps {
  asset: RecordedAsset
  onNewRecording: () => void
}

export function PreviewPanel({ asset, onNewRecording }: PreviewPanelProps) {
  const [saving, setSaving] = useState(false)
  const [savedPath, setSavedPath] = useState(asset.savedPath ?? '')
  const [saveMode, setSaveMode] = useState<'auto' | 'manual'>(asset.savedPath ? 'auto' : 'manual')
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const buffer = await asset.blob.arrayBuffer()
      const path = await window.recorder.saveFile({
        suggestedName: createOutputName(asset.extension, new Date(asset.createdAt)),
        data: new Uint8Array(buffer),
      })
      if (path) {
        setSavedPath(path)
        setSaveMode('manual')
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="preview-panel panel preview-panel--standalone">
      <div className="section-heading section-heading--compact">
        <div>
          <div className="eyebrow">YOUR RECORDING</div>
          <h2>录制完成</h2>
        </div>
        <span className="success-badge"><Icon name="check" size={14} />已生成</span>
      </div>

      <div className="preview-layout">
        <div className="preview-media">
          {asset.extension === 'gif'
            ? <img src={asset.url} alt="录制完成的 GIF 动图" />
            : <video src={asset.url} controls playsInline />}
          <span className="preview-format">{asset.extension.toUpperCase()}</span>
        </div>
        <div className="preview-details">
          <p>确认画面与声音后，保存到电脑或继续下一段录制。</p>
          <div className="asset-meta">
            <div><span>时长</span><strong>{formatDuration(asset.duration)}</strong></div>
            <div><span>分辨率</span><strong>{asset.width} × {asset.height}</strong></div>
            <div><span>文件大小</span><strong>{formatBytes(asset.size)}</strong></div>
          </div>
          {error && <div className="inline-error">{error}</div>}
          {savedPath && <div className="saved-path"><Icon name="check" size={15} /><span title={savedPath}>{saveMode === 'auto' ? '已自动保存到' : '已保存到'} {savedPath}</span></div>}
          <div className="preview-actions">
            <button className="primary-button" onClick={save} disabled={saving}>
              <Icon name={savedPath ? 'download' : 'folder'} size={18} />{saving ? '正在保存…' : savedPath ? '另存为' : '保存到电脑'}
            </button>
            {savedPath && <button className="secondary-button" onClick={() => void window.recorder.openPath(savedPath)}><Icon name="folder" size={17} />打开文件</button>}
          </div>
          <button className="secondary-button new-recording-button" onClick={onNewRecording}><Icon name="refresh" size={17} />继续录制</button>
        </div>
      </div>
    </section>
  )
}
