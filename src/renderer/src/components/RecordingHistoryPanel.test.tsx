import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { RecordedAsset } from '../../../shared/types'
import { RecordingHistoryPanel } from './RecordingHistoryPanel'

function recording(index: number): RecordedAsset {
  return {
    id: `recording-${index}`,
    url: `blob:recording-${index}`,
    blob: {} as Blob,
    extension: index % 2 === 0 ? 'webm' : 'gif',
    width: 1280,
    height: 720,
    duration: index + 1,
    size: 1024 * (index + 1),
    createdAt: new Date(2026, 10, 24, 9, index).getTime(),
  }
}

describe('RecordingHistoryPanel', () => {
  it('previews recordings and paginates without a scrollable list', async () => {
    const user = userEvent.setup()
    const recordings = Array.from({ length: 7 }, (_, index) => recording(index))
    const onSelect = vi.fn()
    render(<RecordingHistoryPanel recordings={recordings} selectedId={recordings[0].id} onSelect={onSelect} onDelete={vi.fn()} />)

    expect(screen.getAllByRole('button', { name: /预览录制/ })).toHaveLength(6)
    await user.click(screen.getByRole('button', { name: '下一页录制记录' }))
    expect(screen.getAllByRole('button', { name: /预览录制/ })).toHaveLength(1)
    await user.click(screen.getAllByRole('button', { name: /预览录制/ })[0])
    expect(onSelect).toHaveBeenCalledWith(recordings[6])
    await user.click(screen.getByRole('button', { name: '上一页录制记录' }))
    expect(screen.getAllByRole('button', { name: /预览录制/ })).toHaveLength(6)
  })

  it('requires confirmation before deleting a recording', async () => {
    const user = userEvent.setup()
    const recordings = [recording(0), recording(1)]
    const onDelete = vi.fn()
    render(<RecordingHistoryPanel recordings={recordings} selectedId={recordings[0].id} onSelect={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getAllByRole('button', { name: /删除录制/ })[0])
    expect(onDelete).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(screen.getAllByRole('button', { name: /删除录制/ })[0])
    await user.click(screen.getByRole('button', { name: '删除' }))
    expect(onDelete).toHaveBeenCalledWith(recordings[0].id)
  })
})
