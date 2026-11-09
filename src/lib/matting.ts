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
  alpha: HTMLCanvasElement
}

let scratch: Scratch | null = null

function getScratch(width: number, height: number): Scratch {
  if (!scratch) {
    scratch = {
      frame: document.createElement('canvas'),
      foreground: document.createElement('canvas'),
      alpha: document.createElement('canvas'),
    }
  }
  for (const canvas of [scratch.frame, scratch.foreground, scratch.alpha]) {
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
 * Draws the cut-out subject with an edge-aware matte.
 *
 * The segmentation model only sees 256x256, so a naive upscale leaves a
 * stair-stepped silhouette. We upscale the alpha with a joint-bilateral
 * (guided) filter that uses the full-resolution frame colours as the guide:
 * alpha stops at strong colour edges, and colour spill is unmixed at the
 * same time. This is the standard guided-matte approach used by remove.bg
 * and Canva-class tools.
 */
export function drawPerson(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  mask: MaskTexture,
  fit: FitMode,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  const alphaSource = mask.alpha
  if (!alphaSource || !mask.width) return false

  const w = Math.max(64, Math.min(1280, Math.round(rect.width)))
  const h = Math.max(64, Math.round((w * rect.height) / rect.width))
  const resources = getScratch(w, h)
  const frameContext = context2d(resources.frame)
  const fgContext = context2d(resources.foreground)
  if (!frameContext || !fgContext) return false

  const frameRect = fitRect(w, h, video.videoWidth, video.videoHeight, fit)
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

  const frameImage = frameContext.getImageData(0, 0, w, h)
  const pixels = frameImage.data

  // Sample the 256px matte at the full frame resolution.
  const alphaCanvas = resources.alpha
  const alphaContext = context2d(alphaCanvas)
  if (!alphaContext) return false
  alphaContext.clearRect(0, 0, w, h)
  alphaContext.imageSmoothingEnabled = true
  alphaContext.imageSmoothingQuality = 'high'
  alphaContext.drawImage(mask.canvas, 0, 0, w, h)
  const alphaImage = alphaContext.getImageData(0, 0, w, h)
  const alpha = alphaImage.data

  // Background colour estimate for unmixing.
  let br = 0
  let bg = 0
  let bb = 0
  let samples = 0
  for (let i = 0; i < w * h; i += 1) {
    if (alpha[i * 4 + 3] < 16) {
      const offset = i * 4
      br += pixels[offset]
      bg += pixels[offset + 1]
      bb += pixels[offset + 2]
      samples += 1
    }
  }
  const haveBackground = samples > w * h * 0.01
  if (haveBackground) {
    br /= samples
    bg /= samples
    bb /= samples
  }

  const out = new Float32Array(w * h)
  const luma = new Float32Array(w * h)
  for (let i = 0; i < w * h; i += 1) {
    const offset = i * 4
    luma[i] =
      pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114
  }

  const sigma = 24
  const spatial = [-2, -1, 0, 1, 2]
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const index = y * w + x
      const a = alpha[index * 4 + 3] / 255
      if (a < 0.02) {
        out[index] = 0
        continue
      }
      if (a > 0.98) {
        out[index] = 1
        continue
      }

      // Joint bilateral: neighbouring alphas whose colour is similar to this
      // pixel dominate. Background-coloured neighbours get weighted out.
      let weighted = 0
      let total = 0
      const centreLuma = luma[index]
      for (const dy of spatial) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (const dx of spatial) {
          const nx = x + dx
          if (nx < 0 || nx >= w) continue
          const n = ny * w + nx
          const delta = luma[n] - centreLuma
          const colourWeight = Math.exp(-(delta * delta) / (2 * sigma * sigma))
          const dist = dx * dx + dy * dy
          const spaceWeight = Math.exp(-dist / 8)
          const weight = colourWeight * spaceWeight
          weighted += (alpha[n * 4 + 3] / 255) * weight
          total += weight
        }
      }
      out[index] = total > 0 ? weighted / total : a
    }
  }

  const fgImage = fgContext.createImageData(w, h)
  const fg = fgImage.data
  for (let i = 0; i < w * h; i += 1) {
    const offset = i * 4
    const a = Math.min(1, Math.max(0, out[i]))
    let pr = pixels[offset]
    let pg = pixels[offset + 1]
    let pb = pixels[offset + 2]

    if (haveBackground && a > 0.02 && a < 0.98) {
      const inverse = 1 - a
      pr = (pr - inverse * br) / a
      pg = (pg - inverse * bg) / a
      pb = (pb - inverse * bb) / a
      const neutral = (pr + pb) * 0.5
      if (pg > neutral) pg = neutral + (pg - neutral) * 0.25
    }

    fg[offset] = Math.max(0, Math.min(255, pr))
    fg[offset + 1] = Math.max(0, Math.min(255, pg))
    fg[offset + 2] = Math.max(0, Math.min(255, pb))
    fg[offset + 3] = Math.round(a * 255)
  }
  fgContext.putImageData(fgImage, 0, 0)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(resources.foreground, rect.x, rect.y, rect.width, rect.height)
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
