import { useEffect, useState } from 'react'
import { createOutputName } from '../../../shared/capture'
import type { RecordedAsset } from '../../../shared/types'
import { trimGif } from '../lib/gifTrim'
import { Icon } from './Icon'

interface GifTrimDialogProps {
  asset: RecordedAsset
  onClose: () => void
}

export function GifTrimDialog({ asset, onClose }: GifTrimDialogProps) {
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(asset.duration)
  const [previewUrl, setPreviewUrl] = useState('')
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(null)
  const [trimming, setTrimming] = useState(false)
  const [progress, setProgress] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedPath, setSavedPath] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    setPreviewUrl('')
    setTrimmedBlob(null)
    setSavedPath('')
    setError('')
    if (start <= 0.01 && end >= asset.duration - 0.01) {
      setTrimming(false)
      setProgress(0)
      return
    }

    const controller = new AbortController()
    let preview = ''
    setTrimming(true)
    setProgress(0)
    const timer = window.setTimeout(() => {
      void trimGif(asset.blob, {
        start,
        end,
        signal: controller.signal,
        onProgress: setProgress,
      }).then((blob) => {
        if (controller.signal.aborted) return
        preview = URL.createObjectURL(blob)
        setPreviewUrl(preview)
        setTrimmedBlob(blob)
        setTrimming(false)
      }).catch((trimError) => {
        if (controller.signal.aborted || (trimError instanceof DOMException && trimError.name === 'AbortError')) return
        setError(trimError instanceof Error ? trimError.message : 'GIF 剪切失败')
        setTrimming(false)
      })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [asset, start, end])

  const exportTrimmed = async () => {
    if (!trimmedBlob || trimming) return
    setSaving(true)
    setError('')
    try {
      const suggestedName = createOutputName('gif', new Date(asset.createdAt)).replace(/\.gif$/, '-trimmed.gif')
      const path = await window.recorder.autoSaveFile({
        suggestedName,
        data: new Uint8Array(await trimmedBlob.arrayBuffer()),
      })
      setSavedPath(path)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '导出失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="gif-trim-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="gif-trim-dialog panel" role="dialog" aria-modal="true" aria-label="剪切 GIF">
        <div className="section-heading section-heading--compact">
          <div><div className="eyebrow">TRIM GIF</div><h2>剪切 GIF</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭剪切窗口"><Icon name="close" size={17} /></button>
        </div>
        <div className="gif-trim-preview">
          <img src={previewUrl || asset.url} alt="GIF 剪切预览" />
          {trimming && <span className="gif-trim-progress">正在处理 {progress}%</span>}
        </div>
        <div className="gif-trim-controls">
          <label>
            <span>起点 <strong>{start.toFixed(1)}s</strong></span>
            <input aria-label="剪切起点" type="range" min="0" max={asset.duration} step="0.1" value={start} onChange={(event) => setStart(Math.min(Number(event.target.value), end - 0.1))} />
          </label>
          <label>
            <span>终点 <strong>{end.toFixed(1)}s</strong></span>
            <input aria-label="剪切终点" type="range" min="0" max={asset.duration} step="0.1" value={end} onChange={(event) => setEnd(Math.max(Number(event.target.value), start + 0.1))} />
          </label>
        </div>
        <div className="gif-trim-summary">
          <span>原始时长 {asset.duration.toFixed(1)}s</span>
          <strong>剪切后 {(end - start).toFixed(1)}s</strong>
        </div>
        {error && <div className="inline-error">{error}</div>}
        {savedPath && <div className="saved-path"><Icon name="check" size={15} /><span title={savedPath}>已导出到 {savedPath}</span></div>}
        <div className="gif-trim-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          {savedPath && <button type="button" className="secondary-button" onClick={() => void window.recorder.openPath(savedPath)}><Icon name="folder" size={17} />打开文件</button>}
          <button type="button" className="primary-button" onClick={() => void exportTrimmed()} disabled={!trimmedBlob || trimming || saving}>
            <Icon name="download" size={17} />{saving ? '正在导出…' : '导出剪切 GIF'}
          </button>
        </div>
      </section>
    </div>
  )
}
