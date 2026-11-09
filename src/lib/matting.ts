import type { FitMode } from '../types'
import type { MaskTexture } from './segmentation'
import { fitRect } from './utils'

/**
 * Colour decontamination ("despill") + edge refinement.
 *
 * Segmentation peers (Canva, remove.bg, PhotoRoom) all solve the same problem:
 * a soft alpha matte mixes the subject's colour with the old background at the
 * edge, which produces green/blue fringes on hair and shoulders. The standard
 * fix is alpha unmixing:  C = a·F + (1-a)·B, so  F = (C − (1-a)·B) / a.
 * We estimate B from the frame's confident background pixels and rebuild the
 * foreground colour on the edge band only, leaving the sharp interior intact.
 */

interface Scratch {
  frame: HTMLCanvasElement
  foreground: HTMLCanvasElement
  overlay: HTMLCanvasElement
}

let scratch: Scratch | null = null

function getScratch(width: number, height: number): Scratch {
  if (!scratch) {
    scratch = {
      frame: document.createElement('canvas'),
      foreground: document.createElement('canvas'),
      overlay: document.createElement('canvas'),
    }
  }
  for (const canvas of [scratch.frame, scratch.foreground]) {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
  }
  return scratch
}

function context2d(canvas: HTMLCanvasElement) {
  return canvas.getContext('2d', { willReadFrequently: true })
}

/**
 * Redraws the subject over `personContext` with decontaminated edge colours.
 * Returns false when no reliable background estimate is possible.
 */
export function drawRefinedPerson(
  personContext: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  mask: MaskTexture,
  fit: FitMode,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  const alpha = mask.alpha
  if (!alpha || !mask.width || !mask.height) return false

  const w = mask.width
  const h = mask.height
  const resources = getScratch(w, h)
  const frameContext = context2d(resources.frame)
  const fgContext = context2d(resources.foreground)
  const overlayContext = context2d(resources.overlay)
  if (!frameContext || !fgContext || !overlayContext) return false

  const frameRect = fitRect(
    w,
    h,
    video.videoWidth,
    video.videoHeight,
    fit,
  )
  frameContext.clearRect(0, 0, w, h)
  frameContext.drawImage(
    video,
    frameRect.sourceX,
    frameRect.sourceY,
    frameRect.sourceWidth,
    frameRect.sourceHeight,
    frameRect.x,
    frameRect.y,
    frameRect.width,
    frameRect.height,
  )

  const source = frameContext.getImageData(0, 0, w, h)
  const pixels = source.data

  // Estimate the old background colour from confidently transparent pixels.
  let r = 0
  let g = 0
  let b = 0
  let samples = 0
  for (let i = 0; i < alpha.length; i += 1) {
    if (alpha[i] < 0.06) {
      const offset = i * 4
      r += pixels[offset]
      g += pixels[offset + 1]
      b += pixels[offset + 2]
      samples += 1
    }
  }
  if (samples < alpha.length * 0.015) return false
  const bgR = r / samples
  const bgG = g / samples
  const bgB = b / samples

  const out = fgContext.createImageData(w, h)
  const fg = out.data
  for (let i = 0; i < alpha.length; i += 1) {
    const offset = i * 4
    let a = alpha[i]
    if (a < 0.02) a = 0
    let pr = pixels[offset]
    let pg = pixels[offset + 1]
    let pb = pixels[offset + 2]

    if (a > 0.02 && a < 0.98) {
      const inverse = 1 - a
      pr = (pr - inverse * bgR) / a
      pg = (pg - inverse * bgG) / a
      pb = (pb - inverse * bgB) / a
      // Residual green-screen spill: pull green back toward the neutral axis.
      const neutral = (pr + pb) * 0.5
      if (pg > neutral) pg = neutral + (pg - neutral) * 0.25
    }

    fg[offset] = Math.max(0, Math.min(255, pr))
    fg[offset + 1] = Math.max(0, Math.min(255, pg))
    fg[offset + 2] = Math.max(0, Math.min(255, pb))
    fg[offset + 3] = Math.round(a * 255)
  }
  fgContext.putImageData(out, 0, 0)

  // Draw the clean edge over the already-composited subject.
  if (resources.overlay.width !== Math.ceil(rect.width) ||
      resources.overlay.height !== Math.ceil(rect.height)) {
    resources.overlay.width = Math.max(1, Math.ceil(rect.width))
    resources.overlay.height = Math.max(1, Math.ceil(rect.height))
  }
  overlayContext.clearRect(0, 0, resources.overlay.width, resources.overlay.height)
  overlayContext.imageSmoothingEnabled = true
  overlayContext.imageSmoothingQuality = 'high'
  overlayContext.drawImage(
    resources.foreground,
    0,
    0,
    resources.overlay.width,
    resources.overlay.height,
  )
  overlayContext.globalCompositeOperation = 'destination-in'
  overlayContext.drawImage(
    mask.edgeCanvas,
    0,
    0,
    resources.overlay.width,
    resources.overlay.height,
  )
  overlayContext.globalCompositeOperation = 'source-over'

  personContext.drawImage(resources.overlay, rect.x, rect.y)
  return true
}

/** Same decontamination pass for a still-image cutout PNG. */
export async function decontaminateImageBlob(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    bitmap.close()
    return blob
  }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = image.data
  const count = data.length / 4
  let r = 0
  let g = 0
  let b = 0
  let samples = 0
  for (let i = 0; i < count; i += 1) {
    if (data[i * 4 + 3] < 12) {
      r += data[i * 4]
      g += data[i * 4 + 1]
      b += data[i * 4 + 2]
      samples += 1
    }
  }
  if (samples >= count * 0.01) {
    const bgR = r / samples
    const bgG = g / samples
    const bgB = b / samples
    for (let i = 0; i < count; i += 1) {
      const offset = i * 4
      const a = data[offset + 3] / 255
      if (a > 0.02 && a < 0.98) {
        const inverse = 1 - a
        let pr = (data[offset] - inverse * bgR) / a
        let pg = (data[offset + 1] - inverse * bgG) / a
        let pb = (data[offset + 2] - inverse * bgB) / a
        const neutral = (pr + pb) * 0.5
        if (pg > neutral) pg = neutral + (pg - neutral) * 0.25
        data[offset] = Math.max(0, Math.min(255, pr))
        data[offset + 1] = Math.max(0, Math.min(255, pg))
        data[offset + 2] = Math.max(0, Math.min(255, pb))
      }
    }
    context.putImageData(image, 0, 0)
  }

  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result ?? blob), 'image/png')
  })
}
