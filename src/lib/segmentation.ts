import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from '@mediapipe/tasks-vision'

const BASE = import.meta.env.BASE_URL
const WASM_PATH = `${BASE}mediapipe/wasm`

/**
 * The multiclass selfie model separates hair, face, body skin and clothes, so
 * the alpha matte keeps fine detail (flyaway hair, fingers) that the binary
 * selfie segmenter simply cannot resolve. Falls back to the small model if the
 * multiclass file is missing.
 */
const MODELS = [
  `${BASE}models/selfie_multiclass.tflite`,
  `${BASE}models/selfie_segmenter.tflite`,
]

type RunningMode = 'IMAGE' | 'VIDEO'

const segmenterCache = new Map<RunningMode, Promise<ImageSegmenter>>()

async function createSegmenter(
  mode: RunningMode,
  modelPath: string,
): Promise<ImageSegmenter> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
  const options = {
    baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' as const },
    runningMode: mode,
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  }
  try {
    return await ImageSegmenter.createFromOptions(fileset, options)
  } catch {
    return await ImageSegmenter.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: 'GPU' },
    })
  }
}

export function loadSegmenter(mode: RunningMode): Promise<ImageSegmenter> {
  const cached = segmenterCache.get(mode)
  if (cached) return cached

  const promise = (async () => {
    let lastError: unknown = null
    for (const modelPath of MODELS) {
      try {
        return await createSegmenter(mode, modelPath)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError ?? new Error('The segmentation model could not be loaded.')
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
  /** Soft alpha band around the subject edge (colour decontamination zone). */
  edgeCanvas: HTMLCanvasElement
  edgeContext: CanvasRenderingContext2D
  edgeImageData: ImageData
  width: number
  height: number
  previous: Float32Array | null
  /** Latest alpha matte, kept for foreground colour unmixing. */
  alpha: Float32Array | null
}

export function createMaskTexture(): MaskTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const edgeCanvas = document.createElement('canvas')
  edgeCanvas.width = 256
  edgeCanvas.height = 256
  const edgeContext = edgeCanvas.getContext('2d', { willReadFrequently: true })
  if (!context || !edgeContext) {
    throw new Error('Canvas 2D is unavailable in this browser.')
  }
  return {
    canvas,
    context,
    imageData: context.createImageData(256, 256),
    edgeCanvas,
    edgeContext,
    edgeImageData: edgeContext.createImageData(256, 256),
    width: 256,
    height: 256,
    previous: null,
    alpha: null,
  }
}

export function resetMaskTexture(texture: MaskTexture) {
  texture.previous = null
  texture.alpha = null
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
  if (!confidenceMasks?.length) {
    if (result.categoryMask) {
      return { mask: result.categoryMask, alphaSource: 'category' as const }
    }
    throw new Error('The model did not return a segmentation mask.')
  }

  const labels = segmenter.getLabels()
  const background = labels.findIndex((label) => /background/i.test(label))
  if (background >= 0 && confidenceMasks[background]) {
    return {
      mask: confidenceMasks[background],
      alphaSource: 'confidence' as const,
      invertChannel: true,
    }
  }

  if (confidenceMasks.length === 1) {
    return { mask: confidenceMasks[0], alphaSource: 'confidence' as const }
  }

  // Binary selfie segmenter: [background, person].
  return { mask: confidenceMasks[1], alphaSource: 'confidence' as const }
}

/** Cheap separable box blur — smooths the 256px confidence map before thresholding. */
function blur(values: Float32Array, width: number, height: number) {
  const tmp = new Float32Array(values.length)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      const l = values[row + Math.max(0, x - 1)]
      const c = values[row + x]
      const r = values[row + Math.min(width - 1, x + 1)]
      tmp[row + x] = (l + c + c + r) * 0.25
    }
  }
  const out = new Float32Array(values.length)
  for (let y = 0; y < height; y += 1) {
    const up = Math.max(0, y - 1) * width
    const mid = y * width
    const down = Math.min(height - 1, y + 1) * width
    for (let x = 0; x < width; x += 1) {
      out[mid + x] = (tmp[up + x] + tmp[mid + x] * 2 + tmp[down + x]) * 0.25
    }
  }
  return out
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
  const picked = pickPersonMask(result, segmenter)
  const mask = picked.mask
  const width = mask.width
  const height = mask.height

  if (texture.width !== width || texture.height !== height) {
    texture.canvas.width = width
    texture.canvas.height = height
    texture.edgeCanvas.width = width
    texture.edgeCanvas.height = height
    texture.width = width
    texture.height = height
    texture.imageData = texture.context.createImageData(width, height)
    texture.edgeImageData = texture.edgeContext.createImageData(width, height)
    texture.previous = null
  }

  const raw =
    picked.alphaSource === 'confidence'
      ? mask.getAsFloat32Array()
      : mask.getAsUint8Array()
  let values: Float32Array
  if (picked.alphaSource === 'confidence') {
    values = raw as Float32Array
    if (picked.invertChannel) {
      values = values.slice()
      for (let i = 0; i < values.length; i += 1) values[i] = 1 - values[i]
    }
    // Blur once to remove the blocky 256-grid staircase before thresholding.
    values = blur(values, width, height)
  } else {
    const bytes = raw as Uint8Array
    values = new Float32Array(bytes.length)
    for (let i = 0; i < bytes.length; i += 1) values[i] = bytes[i] > 0 ? 1 : 0
  }

  const data = texture.imageData.data
  const edgeData = texture.edgeImageData.data
  const feather = Math.max(0.002, options.feather)
  const low = options.threshold - feather
  const high = options.threshold + feather
  const smoothing = Math.min(0.9, Math.max(0, options.smoothing ?? 0))
  const previous =
    texture.previous && texture.previous.length === values.length
      ? texture.previous
      : null
  const next = previous ?? new Float32Array(values.length)
  const alpha = new Float32Array(values.length)

  for (let i = 0; i < values.length; i += 1) {
    let a = smoothstep((values[i] - low) / (high - low || 0.0001))
    if (options.invert) a = 1 - a

    if (previous) {
      // Motion-aware blend: hold still edges steady, let fast-changing pixels
      // adapt quickly so movement does not smear.
      const delta = Math.abs(a - previous[i])
      const factor = smoothing * (delta > 0.3 ? 0.35 : 1)
      a = previous[i] * factor + a * (1 - factor)
    }

    alpha[i] = a
    next[i] = a
    const offset = i * 4
    data[offset] = 255
    data[offset + 1] = 255
    data[offset + 2] = 255
    data[offset + 3] = Math.round(a * 255)

    // Edge band: peaks at 50% alpha, where colour contamination lives.
    const band = Math.round(a * (1 - a) * 4 * 255)
    edgeData[offset] = 255
    edgeData[offset + 1] = 255
    edgeData[offset + 2] = 255
    edgeData[offset + 3] = band
  }

  texture.context.putImageData(texture.imageData, 0, 0)
  texture.edgeContext.putImageData(texture.edgeImageData, 0, 0)
  texture.previous = next
  texture.alpha = alpha
  return texture.canvas
}

export async function removeImageWithMediaPipe(
  image: HTMLImageElement,
): Promise<Blob> {
  const segmenter = await loadSegmenter('IMAGE')
  const result = segmenter.segment(image)
  const texture = createMaskTexture()
  renderMask(texture, result, segmenter, {
    threshold: 0.5,
    feather: 0.06,
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
