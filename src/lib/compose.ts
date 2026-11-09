import type { Background, FitMode, MediaAsset } from '../types'
import { fitRect, loadImage } from './utils'

export async function composeImage(
  asset: MediaAsset,
  options: {
    background: Background
    fit: FitMode
    width: number
    height: number
  },
): Promise<Blob> {
  const { background, fit, width, height } = options
  const image = await loadImage(asset.cutoutUrl ?? asset.url)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.')

  if (background.mode === 'color') {
    context.fillStyle = background.color
    context.fillRect(0, 0, width, height)
  }

  const rect = fitRect(width, height, image.naturalWidth, image.naturalHeight, fit)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    rect.sourceX,
    rect.sourceY,
    rect.sourceWidth,
    rect.sourceHeight,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The PNG could not be encoded.'))
    }, 'image/png')
  })
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
