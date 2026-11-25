import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RecordedAsset, RecorderBridge, SaveFileRequest } from '../../../shared/types'
import { PreviewPanel } from './PreviewPanel'

const asset: RecordedAsset = {
  id: 'test-asset',
  url: 'blob:test',
  blob: {
    arrayBuffer: async () => new Uint8Array([116, 101, 115, 116]).buffer,
  } as Blob,
  extension: 'webm',
  width: 1280,
  height: 720,
  duration: 2,
  size: 4,
  createdAt: new Date(2026, 10, 24, 9, 8, 7).getTime(),
}

function mockRecorder() {
  const saveFile = vi.fn(async (_request: SaveFileRequest) => '/Users/test/Aurel.webm')
  const openPath = vi.fn(async () => undefined)
  const recorder = { saveFile, openPath } as unknown as RecorderBridge
  vi.stubGlobal('recorder', recorder)
  return { saveFile, openPath }
}

afterEach(() => vi.unstubAllGlobals())

describe('PreviewPanel', () => {
  it('saves the generated blob through the native dialog', async () => {
    const user = userEvent.setup()
    const { saveFile } = mockRecorder()
    render(<PreviewPanel asset={asset} onNewRecording={() => undefined} />)

    await user.click(screen.getByRole('button', { name: '保存到电脑' }))
    await waitFor(() => expect(saveFile).toHaveBeenCalledOnce())
    const request = saveFile.mock.calls[0][0]
    expect(request.suggestedName).toBe('Aurel-2026-11-24-090807.webm')
    expect(request.data).toBeInstanceOf(Uint8Array)
    expect(await screen.findByText(/已保存到/)).toBeInTheDocument()
  })

  it('opens the saved file and supports starting another recording', async () => {
    const user = userEvent.setup()
    const { saveFile, openPath } = mockRecorder()
    const newRecording = vi.fn()
    render(<PreviewPanel asset={asset} onNewRecording={newRecording} />)

    await user.click(screen.getByRole('button', { name: '保存到电脑' }))
    await user.click(await screen.findByRole('button', { name: '打开文件' }))
    expect(openPath).toHaveBeenCalledWith('/Users/test/Aurel.webm')
    expect(saveFile).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: '继续录制' }))
    expect(newRecording).toHaveBeenCalledOnce()
  })

  it('shows an automatically saved file and allows opening it', async () => {
    const user = userEvent.setup()
    const { openPath } = mockRecorder()
    const savedPath = '/Users/test/Movies/Aurel/Aurel-auto.webm'
    render(<PreviewPanel asset={{ ...asset, savedPath }} onNewRecording={() => undefined} />)

    expect(screen.getByText(`已自动保存到 ${savedPath}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '另存为' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '打开文件' }))
    expect(openPath).toHaveBeenCalledWith(savedPath)
  })

  it('shows save errors without losing the preview', async () => {
    const user = userEvent.setup()
    mockRecorder()
    window.recorder.saveFile = vi.fn(async () => { throw new Error('磁盘不可写') })
    render(<PreviewPanel asset={asset} onNewRecording={() => undefined} />)

    await user.click(screen.getByRole('button', { name: '保存到电脑' }))
    expect(await screen.findByText('磁盘不可写')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存到电脑' })).toBeEnabled()
  })
})
