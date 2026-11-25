import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecordedAsset } from '../../shared/types'
import App from './App'
import { useRecorder } from './hooks/useRecorder'

vi.mock('./hooks/useRecorder', () => ({ useRecorder: vi.fn() }))

const idleRecorder = {
  status: 'idle' as const,
  elapsed: 0,
  progress: 0,
  asset: null,
  error: '',
  warning: '',
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  pauseRecording: vi.fn(),
  resumeRecording: vi.fn(),
  togglePause: vi.fn(),
  discard: vi.fn(),
  cancelProcessing: vi.fn(),
  clearError: vi.fn(),
  dismissWarning: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRecorder).mockReturnValue(idleRecorder)
})

describe('Aurel interface', () => {
  it('selects a source and starts the desktop-only flow', async () => {
    const user = userEvent.setup()
    render(<App />)

    const source = await screen.findByRole('button', { name: /内置显示器/ })
    await user.click(source)
    expect(source).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /开始录制/ })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /开始录制/ }))
    expect(await screen.findByText('当前是浏览器界面预览。请运行 npm run dev 启动桌面应用后进行录制。')).toBeInTheDocument()
  })

  it('switches output settings to GIF', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: /内置显示器/ })

    await user.click(screen.getByRole('button', { name: 'GIF 动图' }))
    expect(screen.getByLabelText('GIF 帧率')).toHaveValue('15')
    expect(screen.queryByLabelText('视频格式')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('GIF 帧率'), '20')
    expect(screen.getByLabelText('GIF 帧率')).toHaveValue('20')
  })

  it('shows a dedicated result page and returns to source selection', async () => {
    const user = userEvent.setup()
    const asset: RecordedAsset = {
      id: 'finished-recording',
      url: 'blob:finished',
      blob: {} as Blob,
      extension: 'webm',
      width: 1280,
      height: 720,
      duration: 3,
      size: 1024,
      createdAt: Date.now(),
    }
    const discard = vi.fn()
    vi.mocked(useRecorder).mockReturnValue({ ...idleRecorder, asset, discard })
    render(<App />)

    expect(screen.getByRole('heading', { name: '录制完成' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '录制记录' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /预览录制/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存到电脑' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /内置显示器/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /开始录制/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('视频格式')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '录制屏幕' }))
    expect(await screen.findByRole('heading', { name: '选择录制画面' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /开始录制/ })).toBeInTheDocument()

    expect(await screen.findByRole('heading', { name: '录制设置' })).toBeInTheDocument()
    expect(screen.getByLabelText('视频格式')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '录制记录' }))
    expect(await screen.findByRole('heading', { name: '录制完成' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '继续录制' }))
    expect(discard).toHaveBeenCalledOnce()
  })

  it('deletes the final history recording and returns to selection', async () => {
    const user = userEvent.setup()
    const asset: RecordedAsset = {
      id: 'only-recording',
      url: 'blob:only',
      blob: {} as Blob,
      extension: 'webm',
      width: 1280,
      height: 720,
      duration: 1,
      size: 512,
      createdAt: Date.now(),
    }
    const discard = vi.fn()
    vi.mocked(useRecorder).mockReturnValue({ ...idleRecorder, asset, discard })
    render(<App />)

    await screen.findByRole('region', { name: '录制记录' })
    await user.click(screen.getByRole('button', { name: /删除录制/ }))
    await user.click(screen.getByRole('button', { name: '删除' }))

    expect(await screen.findByRole('heading', { name: '选择录制画面' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '录制记录' })).not.toBeInTheDocument()
    expect(discard).toHaveBeenCalledOnce()
  })

  it('filters available windows', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: /内置显示器/ })

    await user.click(screen.getByRole('button', { name: /^窗口/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /内置显示器/ })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Aurel · 界面预览/ })).toBeInTheDocument()
  })
})
