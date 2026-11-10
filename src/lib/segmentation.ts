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
  /** Latest alpha matte for foreground colour unmixing. */
  alpha: Float32Array | null
  /** Rolling temporal buffer of recent alpha mattes (kills frame-to-frame boil). */
  history: Float32Array[]
  historyIdx: number
  /** Latest frame luminance, downsampled to mask resolution (used as guided-filter guide). */
  guide: Uint8ClampedArray | null
}

const TEMPORAL_WINDOW = 5 // number of frames to average for temporal stability

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
    alpha: null,
    history: [],
    historyIdx: 0,
    guide: null,
  }
}

export function resetMaskTexture(texture: MaskTexture) {
  texture.alpha = null
  texture.history = []
  texture.historyIdx = 0
  texture.guide = null
}

/** Downsample video frame to mask resolution and extract luminance as guide. */
export function captureFrameGuide(
  texture: MaskTexture,
  video: HTMLVideoElement,
): void {
  const w = texture.width
  const h = texture.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.drawImage(video, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  const guide = new Uint8ClampedArray(w * h)
  for (let i = 0; i < w * h; i += 1) {
    const o = i * 4
    // Rec. 601 luma
    guide[i] =
      data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114
  }
  texture.guide = guide
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

  return { mask: confidenceMasks[1], alphaSource: 'confidence' as const }
}

/** Separable box blur — O(N) smoothing for the confidence map. */
function blur(values: Float32Array, width: number, height: number) {
  const tmp = new Float32Array(values.length)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      const a = values[row + Math.max(0, x - 2)]
      const l = values[row + Math.max(0, x - 1)]
      const c = values[row + x]
      const r = values[row + Math.min(width - 1, x + 1)]
      const rr = values[row + Math.min(width - 1, x + 2)]
      tmp[row + x] = (a + l + c + c + r + rr) / 6
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

/** Box-filter guided filter (O(N)) — edge-preserving smoothing of alpha
 *  using frame luminance as guide. Keeps edges sharp where colour changes,
 *  smooths flat areas. */
function guidedFilter(
  guide: Uint8ClampedArray, // luminance at same resolution as src
  src: Float32Array,
  width: number,
  height: number,
  radius: number,
  eps: number,
): Float32Array {
  const n = width * height
  const invArea = 1 / ((2 * radius + 1) * (2 * radius + 1))

  const boxGuide = new Float32Array(n)
  const boxSrc = new Float32Array(n)
  const boxGs = new Float32Array(n)
  const boxG2 = new Float32Array(n)

  // Horizontal pass
  for (let y = 0; y < height; y += 1) {
    const base = y * width
    let gSum = 0
    let sSum = 0
    let gsSum = 0
    let g2Sum = 0
    for (let x = 0; x < width; x += 1) {
      const i = base + x
      gSum += guide[i]
      sSum += src[i]
      gsSum += guide[i] * src[i]
      g2Sum += guide[i] * guide[i]
      if (x >= 2 * radius + 1) {
        const j = base + x - (2 * radius + 1)
        gSum -= guide[j]
        sSum -= src[j]
        gsSum -= guide[j] * src[j]
        g2Sum -= guide[j] * guide[j]
      }
      boxGuide[i] = gSum
      boxSrc[i] = sSum
      boxGs[i] = gsSum
      boxG2[i] = g2Sum
    }
  }

  // Vertical pass using the horizontal box sums
  const out = new Float32Array(n)

  for (let x = 0; x < width; x += 1) {
    let gSum = 0
    let sSum = 0
    let gsSum = 0
    let g2Sum = 0
    for (let y = 0; y < height; y += 1) {
      const i = y * width + x
      gSum += boxGuide[i]
      sSum += boxSrc[i]
      gsSum += boxGs[i]
      g2Sum += boxG2[i]
      if (y >= 2 * radius + 1) {
        const j = (y - (2 * radius + 1)) * width + x
        gSum -= boxGuide[j]
        sSum -= boxSrc[j]
        gsSum -= boxGs[j]
        g2Sum -= boxG2[j]
      }
      if (y >= radius) {
        const meanG = gSum * invArea
        const meanI = sSum * invArea
        const corrGI = gsSum * invArea - meanG * meanI
        const varG = g2Sum * invArea - meanG * meanG
        const a = corrGI / (varG + eps)
        const b = meanI - a * meanG
        out[i] = a * guide[i] + b
      } else {
        out[i] = src[i]
      }
    }
  }

  return out
}

/** Morphological opening: erode then dilate — removes speckles and thin spikes. */
function morphologicalOpen(binary: Uint8Array, width: number, height: number) {
  erode(binary, width, height)
  dilate(binary, width, height)
}

/** Morphological closing: dilate then erode — fills small holes. */
function morphologicalClose(binary: Uint8Array, width: number, height: number) {
  dilate(binary, width, height)
  erode(binary, width, height)
}

function erode(binary: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(binary.length)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      const i = row + x
      if (!binary[i]) continue
      // 4-connected erosion: pixel survives only if all 4 neighbors are foreground
      let keep = true
      if (x > 0 && !binary[i - 1]) keep = false
      if (x < width - 1 && !binary[i + 1]) keep = false
      if (y > 0 && !binary[i - width]) keep = false
      if (y < height - 1 && !binary[i + width]) keep = false
      out[i] = keep ? 1 : 0
    }
  }
  binary.set(out)
}

function dilate(binary: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(binary.length)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      const i = row + x
      if (binary[i]) {
        out[i] = 1
        continue
      }
      let set = false
      if (x > 0 && binary[i - 1]) set = true
      if (x < width - 1 && binary[i + 1]) set = true
      if (y > 0 && binary[i - width]) set = true
      if (y < height - 1 && binary[i + width]) set = true
      out[i] = set ? 1 : 0
    }
  }
  binary.set(out)
}

/** Temporal blend: average recent alpha mattes with weights biased toward
 *  the current frame. This is the single biggest fix for "TV from the 60s"
 *  flicker — it locks the matte across frames so edges don't boil. */
function temporalBlend(
  texture: MaskTexture,
  current: Float32Array,
): Float32Array {
  const n = current.length
  const history = texture.history
  const idx = texture.historyIdx

  // Store current frame in circular buffer
  if (history.length < TEMPORAL_WINDOW) {
    history.push(current.slice())
  } else {
    history[idx] = current.slice()
  }
  texture.historyIdx = (idx + 1) % Math.max(1, TEMPORAL_WINDOW)

  const count = history.length
  const out = new Float32Array(n)
  // Weights: current frame strongest, decaying for older frames
  const totalWeight = count * (count + 1) / 2
  let accWeight = 0
  for (let k = 0; k < count; k += 1) {
    const h = history[k]
    // weight: newest = count, oldest = 1
    const w = count - k
    accWeight += w
    for (let i = 0; i < n; i += 1) {
      out[i] += h[i] * w
    }
  }
  const inv = 1 / totalWeight
  for (let i = 0; i < n; i += 1) {
    out[i] *= inv
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
  video?: HTMLVideoElement,
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
    texture.alpha = null
    texture.history = []
    texture.historyIdx = 0
    texture.guide = null
  }

  // Capture frame luminance for guided filtering (video only)
  if (video && texture.guide === null) {
    captureFrameGuide(texture, video)
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
    values = blur(values, width, height)
  } else {
    const bytes = raw as Uint8Array
    values = new Float32Array(bytes.length)
    for (let i = 0; i < bytes.length; i += 1) values[i] = bytes[i] > 0 ? 1 : 0
  }

  const data = texture.imageData.data
  const edgeData = texture.edgeImageData.data
  const feather = Math.max(0.004, options.feather)
  const low = options.threshold - feather
  const high = options.threshold + feather

  // --- TRIMAP: confident FG, confident BG, unknown band in between ---
  const binary = new Uint8Array(width * height)
  for (let i = 0; i < values.length; i += 1) {
    binary[i] = values[i] > options.threshold ? 1 : 0
  }

  // Morphological opening kills speckles, closing fills holes
  morphologicalOpen(binary, width, height)
  morphologicalClose(binary, width, height)

  // --- TEMPORAL BLEND: average with recent frames for stability ---
  const blended = temporalBlend(texture, values)

  // --- GUIDED FILTER: edge-preserving refinement using frame luminance ---
  let refined = blended
  if (texture.guide) {
    refined = guidedFilter(texture.guide, blended, width, height, 3, 0.01)
  }

  // --- FINAL ALPHA: crisp interior, soft edge band ---
  const alpha = new Float32Array(blended.length)
  for (let i = 0; i < blended.length; i += 1) {
    let a = binary[i]
      ? Math.min(1, Math.max(0, refined[i]))
      : 0

    // Softstep in the feather band around the threshold
    if (!binary[i]) {
      a = 0
    } else if (refined[i] > high) {
      a = 1
    } else if (refined[i] < low) {
      a = 0
    } else {
      a = smoothstep((refined[i] - low) / (high - low || 0.0001))
    }

    if (options.invert) a = 1 - a

    alpha[i] = a
    const offset = i * 4
    data[offset] = 255
    data[offset + 1] = 255
    data[offset + 2] = 255
    data[offset + 3] = Math.round(a * 255)

    const band = Math.round(a * (1 - a) * 4 * 255)
    edgeData[offset] = 255
    edgeData[offset + 1] = 255
    edgeData[offset + 2] = 255
    edgeData[offset + 3] = band
  }

  texture.context.putImageData(texture.imageData, 0, 0)
  texture.edgeContext.putImageData(texture.edgeImageData, 0, 0)
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
