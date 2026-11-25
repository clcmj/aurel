import { useState } from 'react'
import { formatBytes, formatDuration } from '../../../shared/capture'
import type { RecordedAsset } from '../../../shared/types'
import { Icon } from './Icon'

interface RecordingHistoryPanelProps {
  recordings: RecordedAsset[]
  selectedId: string
  onSelect: (recording: RecordedAsset) => void
  onDelete: (id: string) => void
}

const PAGE_SIZE = 6
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function RecordingHistoryPanel({ recordings, selectedId, onSelect, onDelete }: RecordingHistoryPanelProps) {
  const [page, setPage] = useState(0)
  const [pendingDeleteId, setPendingDeleteId] = useState('')
  const pageCount = Math.max(1, Math.ceil(recordings.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visibleRecordings = recordings.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const pendingRecording = recordings.find((recording) => recording.id === pendingDeleteId)

  const confirmDelete = () => {
    if (!pendingDeleteId) return
    onDelete(pendingDeleteId)
    setPendingDeleteId('')
  }

  return (
    <section className="history-panel panel" aria-label="录制记录">
      <div className="section-heading section-heading--compact">
        <div>
          <div className="eyebrow">RECORDINGS</div>
          <h2>录制记录</h2>
        </div>
        <span className="history-count">{recordings.length}</span>
      </div>

      {recordings.length > 0 ? (
        <div className="history-list" aria-label="录制完成列表">
          {visibleRecordings.map((recording) => {
            const label = dateFormatter.format(new Date(recording.createdAt))
            const selected = recording.id === selectedId
            return (
              <div className={`history-item ${selected ? 'history-item--selected' : ''}`} key={recording.id}>
                <button
                  type="button"
                  className="history-item__preview"
                  aria-label={`预览录制 ${label}`}
                  aria-pressed={selected}
                  onClick={() => onSelect(recording)}
                >
                  <span className="history-thumbnail"><Icon name={recording.extension === 'gif' ? 'image' : 'video'} size={18} /></span>
                  <span className="history-copy">
                    <strong>{label}</strong>
                    <small>{recording.extension.toUpperCase()} · {formatDuration(recording.duration)} · {formatBytes(recording.size)}</small>
                  </span>
                  {selected && <span className="history-current"><Icon name="check" size={12} /></span>}
                </button>
                <button
                  type="button"
                  className={`history-delete ${pendingDeleteId === recording.id ? 'history-delete--pending' : ''}`}
                  aria-label={`删除录制 ${label}`}
                  title="删除录制记录"
                  onClick={() => setPendingDeleteId(recording.id)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="history-empty"><Icon name="clock" size={25} /><strong>还没有录制记录</strong><span>完成录制后会自动出现在这里</span></div>
      )}

      <div className="history-footer">
        {pendingRecording ? (
          <div className="history-confirm" role="alert">
            <span>删除这条录制记录？</span>
            <button type="button" className="history-confirm__delete" onClick={confirmDelete}>删除</button>
            <button type="button" onClick={() => setPendingDeleteId('')}>取消</button>
          </div>
        ) : recordings.length > PAGE_SIZE ? (
          <div className="source-pagination" aria-label="录制记录分页">
            <button type="button" aria-label="上一页录制记录" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>
              <Icon name="arrow" size={14} className="icon-previous" />
            </button>
            <span>{currentPage + 1} / {pageCount}</span>
            <button type="button" aria-label="下一页录制记录" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount - 1}>
              <Icon name="arrow" size={14} />
            </button>
          </div>
        ) : (
          <div className="history-local"><Icon name="shield" size={13} />记录仅保存在本机</div>
        )}
      </div>
    </section>
  )
}
