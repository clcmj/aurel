import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecordedAsset } from '../../../shared/types'
import { useRecordingHistory } from './useRecordingHistory'

const createUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const revokeUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
const createObjectURL = vi.fn(() => 'blob:history-copy')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
})

afterEach(() => {
  if (createUrlDescriptor) Object.defineProperty(URL, 'createObjectURL', createUrlDescriptor)
  else delete (URL as { createObjectURL?: unknown }).createObjectURL
  if (revokeUrlDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeUrlDescriptor)
  else delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL
})

describe('useRecordingHistory', () => {
  it('keeps an independent preview URL and removes deleted recordings', () => {
    const asset: RecordedAsset = {
      id: 'history-asset',
      url: 'blob:recorder-original',
      blob: new Blob(['video']),
      extension: 'webm',
      width: 1280,
      height: 720,
      duration: 2,
      size: 5,
      createdAt: Date.now(),
    }
    const { result } = renderHook(() => useRecordingHistory())
    let stored: RecordedAsset | undefined

    act(() => { stored = result.current.addRecording(asset) })
    expect(stored?.url).toBe('blob:history-copy')
    expect(result.current.recordings).toHaveLength(1)

    act(() => { expect(result.current.addRecording(asset)).toBe(stored) })
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(result.current.recordings).toHaveLength(1)

    act(() => result.current.deleteRecording(asset.id))
    expect(result.current.recordings).toHaveLength(0)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:history-copy')
  })
})
