import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordedAsset } from '../../../shared/types'

type StoredRecording = Omit<RecordedAsset, 'url'>

const DATABASE_NAME = 'localcap-history'
const STORE_NAME = 'recordings'
const DATABASE_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readRecordings(): Promise<StoredRecording[]> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve((request.result as StoredRecording[]).sort((a, b) => b.createdAt - a.createdAt))
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
    transaction.oncomplete = () => database.close()
  })
}

async function writeRecording(recording: StoredRecording): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(recording)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

async function deleteStoredRecording(id: string): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(id)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function createAssetUrl(blob: Blob, fallback: string): string {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : fallback
}

export function useRecordingHistory() {
  const [recordings, setRecordings] = useState<RecordedAsset[]>([])
  const [error, setError] = useState('')
  const recordingsRef = useRef<RecordedAsset[]>([])

  useEffect(() => {
    if (!('indexedDB' in window)) return
    let cancelled = false
    void readRecordings()
      .then((storedRecordings) => {
        if (cancelled) return
        const loaded = storedRecordings.map((recording) => ({ ...recording, url: createAssetUrl(recording.blob, '') }))
        const merged = new Map(loaded.map((recording) => [recording.id, recording]))
        for (const recording of recordingsRef.current) {
          const duplicate = merged.get(recording.id)
          if (duplicate && duplicate !== recording && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(duplicate.url)
          merged.set(recording.id, recording)
        }
        const next = [...merged.values()].sort((a, b) => b.createdAt - a.createdAt)
        recordingsRef.current = next
        setRecordings(next)
      })
      .catch(() => {
        if (!cancelled) setError('录制记录无法从本地数据库读取，本次会话仍可正常使用')
      })
    return () => { cancelled = true }
  }, [])

  const persist = useCallback(async (recording: StoredRecording) => {
    if (!('indexedDB' in window)) return
    try {
      await writeRecording(recording)
    } catch {
      setError('录制记录无法写入本地数据库，本次会话仍可正常使用')
    }
  }, [])

  const addRecording = useCallback((asset: RecordedAsset): RecordedAsset => {
    const existing = recordingsRef.current.find((recording) => recording.id === asset.id)
    if (existing) return existing
    const { url: _url, ...stored } = asset
    const recording = { ...stored, url: createAssetUrl(asset.blob, asset.url) }
    const next = [recording, ...recordingsRef.current].sort((a, b) => b.createdAt - a.createdAt)
    recordingsRef.current = next
    setRecordings(next)
    void persist(stored)
    return recording
  }, [persist])

  const deleteRecording = useCallback((id: string) => {
    const recording = recordingsRef.current.find((item) => item.id === id)
    if (!recording) return
    if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(recording.url)
    const next = recordingsRef.current.filter((item) => item.id !== id)
    recordingsRef.current = next
    setRecordings(next)
    if ('indexedDB' in window) {
      void deleteStoredRecording(id).catch(() => setError('录制记录无法从本地数据库删除，请重试'))
    }
  }, [])

  return { recordings, addRecording, deleteRecording, error, clearError: () => setError('') }
}
