import type { Background, FitMode, MediaAsset, RatioKey } from '../types'

const DB_NAME = 'bignac-project-store'
const DB_VERSION = 1
const STORE = 'snapshots'

export interface SavedAsset {
  id: string
  name: string
  kind: 'image' | 'video'
  width: number
  height: number
  duration: number
  size: number
  file: Blob
  thumb?: string
  cutoutBlob?: Blob
  cutoutStatus: 'idle' | 'processing' | 'done' | 'error'
  videoCutout: boolean
  audio?: {
    blob: Blob
    duration: number
    waveform: number[]
    sampleRate: number
  }
  audioMode?: 'full' | 'voice' | 'background'
}

export interface ProjectSnapshot {
  projectId: string
  name: string
  activeId: string | null
  ratio: RatioKey
  fit: FitMode
  background: Background
  threshold: number
  feather: number
  invert: boolean
  assets: SavedAsset[]
  updatedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveSnapshot(snapshot: ProjectSnapshot): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(snapshot, snapshot.projectId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
  const db = await openDb()
  const result = await new Promise<ProjectSnapshot | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(projectId)
    req.onsuccess = () => resolve((req.result as ProjectSnapshot) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

export async function deleteSnapshot(projectId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(projectId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

function fileFromBlob(blob: Blob, name: string): File {
  return new File([blob], name, { type: blob.type || 'application/octet-stream' })
}

export async function hydrateAssets(saved: SavedAsset[]): Promise<MediaAsset[]> {
  return saved.map((a) => {
    const file = fileFromBlob(a.file, a.name)
    const url = URL.createObjectURL(file)
    const cutoutUrl = a.cutoutBlob ? URL.createObjectURL(a.cutoutBlob) : undefined
    const audioUrl = a.audio ? URL.createObjectURL(a.audio.blob) : undefined
    return {
      id: a.id,
      file,
      name: a.name,
      kind: a.kind,
      url,
      thumbUrl: a.thumb || url,
      width: a.width,
      height: a.height,
      duration: a.duration,
      size: a.size || file.size,
      cutoutUrl,
      cutoutBlob: a.cutoutBlob,
      cutoutStatus: a.cutoutStatus || 'idle',
      videoCutout: !!a.videoCutout,
      audio: a.audio
        ? {
            blob: a.audio.blob,
            url: audioUrl!,
            duration: a.audio.duration,
            waveform: a.audio.waveform || [],
            sampleRate: a.audio.sampleRate,
          }
        : undefined,
      audioMode: a.audioMode,
    } as MediaAsset
  })
}

export function dehydrateAssets(assets: MediaAsset[]): SavedAsset[] {
  return assets.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    width: a.width,
    height: a.height,
    duration: a.duration,
    size: a.size,
    file: a.file,
    thumb: a.thumbUrl && a.thumbUrl.startsWith('data:') ? a.thumbUrl : undefined,
    cutoutBlob: a.cutoutBlob,
    cutoutStatus: a.cutoutStatus,
    videoCutout: a.videoCutout,
    audio: a.audio
      ? {
          blob: a.audio.blob,
          duration: a.audio.duration,
          waveform: a.audio.waveform,
          sampleRate: a.audio.sampleRate,
        }
      : undefined,
    audioMode: a.audioMode,
  }))
}
