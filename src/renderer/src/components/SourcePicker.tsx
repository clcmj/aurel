import { useMemo, useState } from 'react'
import type { CaptureSource, SourceKind } from '../../../shared/types'
import { Icon } from './Icon'

interface SourcePickerProps {
  sources: CaptureSource[]
  selectedId: string
  regionSelected: boolean
  loading: boolean
  disabled: boolean
  onSelect: (source: CaptureSource) => void
  onSelectRegion: () => void
  onRefresh: () => void
}

type Filter = 'all' | SourceKind

const PAGE_SIZE = 10

export function SourcePicker({ sources, selectedId, regionSelected, loading, disabled, onSelect, onSelectRegion, onRefresh }: SourcePickerProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const screens = sources.filter((source) => source.kind === 'screen')
  const windows = sources.filter((source) => source.kind === 'window')
  const visible = useMemo(() => sources.filter((source) => {
    const matchesFilter = filter === 'all' || source.kind === filter
    return matchesFilter && source.name.toLowerCase().includes(query.toLowerCase())
  }), [filter, query, sources])
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pagedSources = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  return (
    <section className="source-panel panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">CAPTURE SOURCE</div>
          <h2>选择录制画面</h2>
        </div>
        <button className="icon-button" onClick={onRefresh} disabled={loading || disabled} title="刷新画面源" aria-label="刷新画面源">
          <Icon name="refresh" className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div className="source-actions">
        <div className="filter-tabs" aria-label="画面类型">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setPage(0) }}>全部 <span>{sources.length}</span></button>
          <button className={filter === 'screen' ? 'active' : ''} onClick={() => { setFilter('screen'); setPage(0) }}>屏幕 <span>{screens.length}</span></button>
          <button className={filter === 'window' ? 'active' : ''} onClick={() => { setFilter('window'); setPage(0) }}>窗口 <span>{windows.length}</span></button>
        </div>
        <button className={`region-button ${regionSelected ? 'region-button--active' : ''}`} onClick={onSelectRegion} disabled={disabled || loading} title="点击后隐藏 Aurel，在屏幕上按住鼠标左键拖拽选择区域">
          <Icon name="crop" size={17} />
          {regionSelected ? '重新框选' : '隐藏并框选'}
        </button>
      </div>

      <div className="search-box">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="搜索屏幕或窗口" aria-label="搜索画面源" />
        {query && <button onClick={() => setQuery('')} aria-label="清空搜索"><Icon name="close" size={15} /></button>}
      </div>

      {loading ? (
        <div className="source-grid source-grid--loading">
          {[0, 1, 2, 3].map((item) => <div className="source-skeleton" key={item} />)}
        </div>
      ) : visible.length > 0 ? (
        <div className="source-grid">
          {pagedSources.map((source) => {
            const selected = !regionSelected && selectedId === source.id
            return (
              <button
                key={source.id}
                className={`source-card ${selected ? 'source-card--selected' : ''}`}
                onClick={() => onSelect(source)}
                disabled={disabled}
                aria-pressed={selected}
              >
                <div className={`source-thumbnail ${source.thumbnail ? '' : 'source-thumbnail--empty'}`}>
                  {source.thumbnail ? <img src={source.thumbnail} alt="" draggable={false} /> : <Icon name={source.kind === 'screen' ? 'monitor' : 'window'} size={42} />}
                  <span className="source-kind"><Icon name={source.kind === 'screen' ? 'monitor' : 'window'} size={13} />{source.kind === 'screen' ? '整个屏幕' : '应用窗口'}</span>
                  {selected && <span className="source-check"><Icon name="check" size={14} /></span>}
                </div>
                <div className="source-card__label">
                  <span>{source.name || '未命名画面'}</span>
                  {source.kind === 'screen' && source.displayId !== undefined && <small>显示器 {source.displayId}</small>}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="monitor" size={32} />
          <strong>{query ? '没有匹配的画面' : '暂无可录制画面'}</strong>
          <span>{query ? '换一个关键词试试' : '请检查系统录屏权限后刷新'}</span>
        </div>
      )}

      <div className="source-footer">
        <div className="source-footnote">
          <Icon name="shield" size={15} />
          <span>画面仅在本机处理，不会上传或经过服务器</span>
        </div>
        {pageCount > 1 && (
          <div className="source-pagination" aria-label="画面源分页">
            <button type="button" aria-label="上一页" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0 || disabled}>
              <Icon name="arrow" size={14} className="icon-previous" />
            </button>
            <span>{currentPage + 1} / {pageCount}</span>
            <button type="button" aria-label="下一页" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount - 1 || disabled}>
              <Icon name="arrow" size={14} />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
