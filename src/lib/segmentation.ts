import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from '@mediapipe/tasks-vision'

const BASE = import.meta.env.BASE_URL
const MODEL_PATH = `${BASE}models/selfie_segmenter.tflite`
const WASM_PATH = `${BASE}mediapipe/wasm`

type RunningMode = 'IMAGE' | 'VIDEO'

const segmenterCache = new Map<RunningMode, Promise<ImageSegmenter>>()

export function loadSegmenter(mode: RunningMode): Promise<ImageSegmenter> {
  const cached = segmenterCache.get(mode)
  if (cached) return cached

  const promise = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
    const baseOptions = {
      modelAssetPath: MODEL_PATH,
      delegate: 'CPU' as const,
    }
    try {
      return await ImageSegmenter.createFromOptions(fileset, {
        baseOptions,
        runningMode: mode,
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })
    } catch {
      return await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { ...baseOptions, delegate: 'GPU' },
        runningMode: mode,
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })
    }
  })().catch((error) => {
    segmenterCache.delete(mode)
    throw error
  })

  segmenterCache.set(mode, promise)
  return promise
}

export interface MaskTexture {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  imageData: ImageData
  width: number
  height: number
  previous: Float32Array | null
}

export function createMaskTexture(): MaskTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.')
  return {
    canvas,
    context,
    imageData: context.createImageData(256, 256),
    width: 256,
    height: 256,
    previous: null,
  }
}

export function resetMaskTexture(texture: MaskTexture) {
  texture.previous = null
}

function smoothstep(value: number) {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}

function pickPersonMask(
  result: ImageSegmenterResult,
  segmenter: ImageSegmenter,
) {
  const confidenceMasks = result.confidenceMasks
  if (confidenceMasks?.length) {
    const labels = segmenter.getLabels()
    const personIndex = labels.findIndex((label) =>
      /person|selfie|body|hair/i.test(label),
    )
    if (personIndex >= 0 && confidenceMasks[personIndex]) {
      return { mask: confidenceMasks[personIndex], alphaSource: 'confidence' as const }
    }
    if (confidenceMasks.length === 1) {
      return { mask: confidenceMasks[0], alphaSource: 'confidence' as const }
    }
    if (confidenceMasks.length >= 2) {
      // The selfie segmenter returns [background, person]. Background is the
      // first channel, so the person confidence lives at index 1.
      return {
        mask: confidenceMasks[1],
        alphaSource: 'confidence' as const,
      }
    }
  }

  if (result.categoryMask) {
    return { mask: result.categoryMask, alphaSource: 'category' as const }
  }

  throw new Error('The AI model did not return a segmentation mask.')
}

export function renderMask(
  texture: MaskTexture,
  result: ImageSegmenterResult,
  segmenter: ImageSegmenter,
  options: {
    threshold: number
    feather: number
    invert?: boolean
    smoothing?: number
  },
) {
  const { mask, alphaSource } = pickPersonMask(result, segmenter)
  const width = mask.width
  const height = mask.height

  if (texture.width !== width || texture.height !== height) {
    texture.canvas.width = width
    texture.canvas.height = height
    texture.width = width
    texture.height = height
    texture.imageData = texture.context.createImageData(width, height)
    texture.previous = null
  }

  const values =
    alphaSource === 'confidence'
      ? mask.getAsFloat32Array()
      : mask.getAsUint8Array()
  const data = texture.imageData.data
  const feather = Math.max(0.002, options.feather)
  const low = options.threshold - feather
  const high = options.threshold + feather
  const smoothing = Math.min(0.85, Math.max(0, options.smoothing ?? 0))
  const previous =
    texture.previous && texture.previous.length === values.length
      ? texture.previous
      : null
  const next = previous ?? new Float32Array(values.length)

  for (let i = 0; i < values.length; i += 1) {
    let alpha =
      alphaSource === 'confidence'
        ? smoothstep((values[i] - low) / (high - low || 0.0001))
        : values[i] > 0
          ? 1
          : 0

    if (options.invert) alpha = 1 - alpha
    if (previous) alpha = previous[i] * smoothing + alpha * (1 - smoothing)

    next[i] = alpha
    const offset = i * 4
    data[offset] = 255
    data[offset + 1] = 255
    data[offset + 2] = 255
    data[offset + 3] = Math.round(alpha * 255)
  }

  texture.context.putImageData(texture.imageData, 0, 0)
  texture.previous = next
  return texture.canvas
}

export async function removeImageWithMediaPipe(
  image: HTMLImageElement,
): Promise<Blob> {
  const segmenter = await loadSegmenter('IMAGE')
  const result = segmenter.segment(image)
  const texture = createMaskTexture()
  renderMask(texture, result, segmenter, {
    threshold: 0.48,
    feather: 0.09,
    smoothing: 0,
  })

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.')

  context.drawImage(image, 0, 0)
  context.globalCompositeOperation = 'destination-in'
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(texture.canvas, 0, 0, canvas.width, canvas.height)
  context.globalCompositeOperation = 'source-over'

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The cutout could not be encoded.'))
    }, 'image/png')
  })
}
