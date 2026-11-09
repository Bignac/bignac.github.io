import type { FitMode, MediaAsset, RatioKey } from '../types'

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  )
  const value = bytes / 1024 ** index
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatTimePrecise(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`
}

export function fileBaseName(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'chroma-export'
  )
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function uid(prefix = 'asset') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The image could not be decoded.'))
    image.src = src
  })
}

export function loadVideoMeta(
  src: string,
): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    let settled = false
    let finishTimer = 0
    const timeout = window.setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('The video took too long to load.'))
    }, 15000)

    const cleanup = () => {
      settled = true
      window.clearTimeout(timeout)
      window.clearTimeout(finishTimer)
      video.removeAttribute('src')
      video.load()
    }

    const fail = (message: string) => {
      if (settled) return
      cleanup()
      reject(new Error(message))
    }

    const complete = (duration: number) => {
      if (settled) return
      const width = video.videoWidth
      const height = video.videoHeight
      if (!width || !height) {
        fail('This video codec is not supported by your browser.')
        return
      }
      cleanup()
      resolve({
        width,
        height,
        duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      })
    }

    const detectDuration = () => {
      const current = video.duration
      if (Number.isFinite(current) && current > 0) {
        complete(current)
        return
      }

      // MediaRecorder WebM files often have no duration in their metadata.
      // Seeking to the end makes Chrome resolve the real duration.
      let attempts = 0
      const readDuration = () => {
        if (settled) return
        const value = video.duration
        if (Number.isFinite(value) && value > 0) {
          complete(value)
          return
        }
        if (video.seekable.length) {
          const end = video.seekable.end(video.seekable.length - 1)
          if (Number.isFinite(end) && end > 0) {
            complete(end)
            return
          }
        }
        attempts += 1
        if (attempts > 25) {
          complete(0)
        }
      }

      video.addEventListener('durationchange', readDuration)
      video.addEventListener('timeupdate', readDuration)
      finishTimer = window.setTimeout(() => {
        const end = video.seekable.length
          ? video.seekable.end(video.seekable.length - 1)
          : 0
        if (Number.isFinite(end) && end > 0) complete(end)
        else complete(0)
      }, 2200)

      try {
        video.currentTime = 1e101
      } catch {
        complete(0)
      }
    }

    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => {
      if (settled) return
      const width = video.videoWidth
      const height = video.videoHeight
      if (!width || !height) {
        fail('This video codec is not supported by your browser.')
        return
      }
      detectDuration()
    }
    video.onerror = () =>
      fail('This video codec is not supported by your browser.')
    video.src = src
  })
}

export function captureVideoThumbnail(
  src: string,
  duration: number,
): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    let settled = false
    const finish = (value: string) => {
      if (settled) return
      settled = true
      video.removeAttribute('src')
      video.load()
      resolve(value)
    }

    const draw = () => {
      try {
        const width = 640
        const ratio = video.videoHeight / video.videoWidth || 9 / 16
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = Math.round(width * ratio)
        const context = canvas.getContext('2d')
        if (!context) {
          finish('')
          return
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', 0.78))
      } catch {
        finish('')
      }
    }

    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.onloadeddata = () => {
      const safeDuration = Number.isFinite(duration) ? duration : 0
      const target = Math.min(Math.max(safeDuration * 0.12, 0.05), 2)
      if (safeDuration > 0.1) {
        video.currentTime = target
      } else {
        draw()
      }
    }
    video.onseeked = draw
    video.onerror = () => finish('')
    video.src = src
    window.setTimeout(() => finish(''), 8000)
  })
}

export function getImageDimensions(src: string) {
  return loadImage(src).then((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
  }))
}

export const RATIO_VALUES: Record<Exclude<RatioKey, 'original'>, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
}

export const RATIO_LABELS: Record<RatioKey, string> = {
  '16:9': 'Landscape',
  '9:16': 'Portrait',
  '1:1': 'Square',
  '4:5': 'Social',
  original: 'Original',
}

export function ratioValue(ratio: RatioKey, asset: MediaAsset | null) {
  if (ratio === 'original') {
    if (asset?.width && asset?.height) return asset.width / asset.height
    return 16 / 9
  }
  return RATIO_VALUES[ratio]
}

export function even(value: number) {
  return Math.max(2, Math.round(value / 2) * 2)
}

export function getOutputSize(
  ratio: RatioKey,
  asset: MediaAsset | null,
): { width: number; height: number } {
  if (ratio === 'original' && asset?.width && asset?.height) {
    const scale = Math.min(1, 1920 / Math.max(asset.width, asset.height))
    return {
      width: even(asset.width * scale),
      height: even(asset.height * scale),
    }
  }
  switch (ratio) {
    case '9:16':
      return { width: 1080, height: 1920 }
    case '1:1':
      return { width: 1080, height: 1080 }
    case '4:5':
      return { width: 1080, height: 1350 }
    case '16:9':
    case 'original':
    default:
      return { width: 1920, height: 1080 }
  }
}

export function getPreviewSize(
  ratio: RatioKey,
  asset: MediaAsset | null,
): { width: number; height: number } {
  if (ratio === 'original' && asset?.width && asset?.height) {
    const scale = Math.min(1, 960 / Math.max(asset.width, asset.height))
    return {
      width: even(asset.width * scale),
      height: even(asset.height * scale),
    }
  }
  switch (ratio) {
    case '9:16':
      return { width: 540, height: 960 }
    case '1:1':
      return { width: 720, height: 720 }
    case '4:5':
      return { width: 720, height: 900 }
    case '16:9':
    case 'original':
    default:
      return { width: 960, height: 540 }
  }
}

export interface DrawRect {
  x: number
  y: number
  width: number
  height: number
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
}

export function fitRect(
  targetWidth: number,
  targetHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  fit: FitMode,
): DrawRect {
  if (!sourceWidth || !sourceHeight) {
    return {
      x: 0,
      y: 0,
      width: targetWidth,
      height: targetHeight,
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 0,
      sourceHeight: 0,
    }
  }

  if (fit === 'cover') {
    const scale = Math.max(
      targetWidth / sourceWidth,
      targetHeight / sourceHeight,
    )
    const visibleWidth = Math.min(sourceWidth, targetWidth / scale)
    const visibleHeight = Math.min(sourceHeight, targetHeight / scale)
    return {
      x: 0,
      y: 0,
      width: targetWidth,
      height: targetHeight,
      sourceX: (sourceWidth - visibleWidth) / 2,
      sourceY: (sourceHeight - visibleHeight) / 2,
      sourceWidth: visibleWidth,
      sourceHeight: visibleHeight,
    }
  }

  const scale = Math.min(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight,
  )
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  return {
    x: (targetWidth - drawWidth) / 2,
    y: (targetHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
    sourceX: 0,
    sourceY: 0,
    sourceWidth,
    sourceHeight,
  }
}

export function isGreen(hex: string) {
  const normalized = hex.replace('#', '').toLowerCase()
  return normalized === '00b140' || normalized === '00ff00'
}

export function cssBackground(background: { mode: string; color?: string }) {
  if (background.mode === 'color' && background.color) {
    return background.color
  }
  return 'transparent'
}
