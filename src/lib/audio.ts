import type { ExtractedAudio } from '../types'

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels)
  const sampleRate = buffer.sampleRate
  const frameCount = buffer.length
  const bytesPerSample = 2
  const blockAlign = channels * bytesPerSample
  const dataSize = frameCount * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  const channelData: Float32Array[] = []
  for (let channel = 0; channel < channels; channel += 1) {
    channelData.push(buffer.getChannelData(channel))
  }

  let offset = 44
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]))
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      )
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function makeWaveform(buffer: AudioBuffer, bars = 64): number[] {
  const channel = buffer.getChannelData(0)
  const blockSize = Math.max(1, Math.floor(channel.length / bars))
  const peaks: number[] = []
  let maximum = 0.0001

  for (let bar = 0; bar < bars; bar += 1) {
    const start = bar * blockSize
    const end = Math.min(channel.length, start + blockSize)
    let sum = 0
    for (let index = start; index < end; index += 1) {
      sum += channel[index] * channel[index]
    }
    const rms = Math.sqrt(sum / Math.max(1, end - start))
    peaks.push(rms)
    maximum = Math.max(maximum, rms)
  }

  return peaks.map((peak) => Math.max(0.06, peak / maximum))
}

/** Peak-normalize the buffer so the loudest sample hits ~0.9 dBFS. */
function normalize(buffer: AudioBuffer, target = 0.9): AudioBuffer {
  const channels = buffer.numberOfChannels
  const length = buffer.length
  const sampleRate = buffer.sampleRate
  const out = new OfflineAudioContext(channels, length, sampleRate)
  const dest = out.createBuffer(channels, length, sampleRate)

  let peak = 0
  for (let ch = 0; ch < channels; ch += 1) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i += 1) {
      peak = Math.max(peak, Math.abs(data[i]))
    }
  }

  const gain = peak > 0 ? target / peak : 1
  for (let ch = 0; ch < channels; ch += 1) {
    const data = buffer.getChannelData(ch)
    const outData = dest.getChannelData(ch)
    for (let i = 0; i < length; i += 1) {
      outData[i] = data[i] * gain
    }
  }
  return dest
}

/**
 * Cooley-Tukey radix-2 FFT. Returns complex arrays (real, imag).
 * Input length must be a power of two.
 */
function fft(signal: Float32Array): { re: Float32Array; im: Float32Array } {
  const n = signal.length
  const levels = Math.log2(n)
  if (!Number.isInteger(levels)) {
    throw new Error('FFT input length must be a power of two.')
  }

  const re = new Float32Array(n)
  const im = new Float32Array(n)

  // Bit-reversal permutation
  for (let i = 0; i < n; i += 1) {
    let j = 0
    for (let k = 0; k < levels; k += 1) {
      j |= ((i >> k) & 1) << (levels - 1 - k)
    }
    if (j > i) {
      const tmp = signal[i]
      re[i] = re[j]
      re[j] = tmp
      im[i] = im[j]
      im[j] = tmp
    }
    re[i] = signal[i]
  }

  // Butterflies
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2
    const step = (2 * Math.PI) / size
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < half; j += 1) {
        const angle = -step * j
        const wre = Math.cos(angle)
        const wim = Math.sin(angle)
        const a = i + j
        const b = i + j + half
        const bre = re[b] * wre - im[b] * wim
        const bim = re[b] * wim + im[b] * wre
        re[b] = re[a] - bre
        im[b] = im[a] - bim
        re[a] += bre
        im[a] += bim
      }
    }
  }
  return { re, im }
}

function ifft(re: Float32Array, im: Float32Array): Float32Array {
  const n = re.length
  // Conjugate, FFT, conjugate, scale
  for (let i = 0; i < n; i += 1) im[i] = -im[i]
  const { re: outRe, im: outIm } = fft(re)
  for (let i = 0; i < n; i += 1) outIm[i] = -outIm[i]
  const signal = new Float32Array(n)
  for (let i = 0; i < n; i += 1) signal[i] = outRe[i] / n
  return signal
}

/**
 * Spectral subtraction noise reduction.
 * Estimates the noise floor from the quietest frames of the signal,
 * then subtracts it from each frame's spectral magnitude.
 */
function spectralSubtract(buffer: AudioBuffer, noiseFloorFactor = 1.5): AudioBuffer {
  const channels = buffer.numberOfChannels
  const length = buffer.length
  const sampleRate = buffer.sampleRate

  // FFT size: 2048 samples (~46ms at 44.1kHz) — good time/frequency tradeoff
  const fftSize = 2048
  const hop = fftSize / 4 // 75% overlap
  const numFrames = Math.floor((length - fftSize) / hop) + 1

  // Estimate noise floor from the quietest 10% of frames
  const frameRMS: number[] = []
  for (let f = 0; f < numFrames; f += 1) {
    const start = f * hop
    let sum = 0
    for (let i = 0; i < fftSize; i += 1) {
      const idx = start + i
      if (idx >= length) break
      const s = buffer.getChannelData(0)[idx]
      sum += s * s
    }
    frameRMS.push(Math.sqrt(sum / fftSize))
  }
  frameRMS.sort((a, b) => a - b)
  const noiseCount = Math.max(1, Math.floor(numFrames * 0.1))
  let noiseFloor = 0
  for (let i = 0; i < noiseCount; i += 1) noiseFloor += frameRMS[i]
  noiseFloor /= noiseCount

  const out = new OfflineAudioContext(channels, length, sampleRate)
  const dest = out.createBuffer(channels, length, sampleRate)

  const window = new Float32Array(fftSize)
  for (let i = 0; i < fftSize; i += 1) {
    // Hann window
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
  }

  const half = fftSize / 2 + 1

  for (let ch = 0; ch < channels; ch += 1) {
    const inData = buffer.getChannelData(ch)
    const outData = dest.getChannelData(ch)

    // Overlap-add buffer
    const overlap = new Float32Array(fftSize)

    for (let f = 0; f < numFrames; f += 1) {
      const start = f * hop
      // Windowed frame
      const frame = new Float32Array(fftSize)
      for (let i = 0; i < fftSize; i += 1) {
        const idx = start + i
        frame[i] = idx < length ? inData[idx] * window[i] : 0
      }

      // FFT
      const { re, im } = fft(frame)

      // Spectral magnitude
      const mag = new Float32Array(half)
      for (let i = 0; i < half; i += 1) {
        mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i])
      }

      // Subtract noise floor (spectral subtraction with floor)
      for (let i = 0; i < half; i += 1) {
        const reduced = Math.max(mag[i] - noiseFloor * noiseFloorFactor, mag[i] * 0.05)
        const scale = reduced / (mag[i] || 1)
        re[i] *= scale
        im[i] *= scale
      }

      // IFFT back to time domain
      const cleaned = ifft(re, im)

      // Overlap-add
      for (let i = 0; i < fftSize; i += 1) {
        const idx = start + i
        if (idx < length) {
          outData[idx] += cleaned[i] * window[i]
          overlap[i] += window[i] * window[i]
        }
      }
    }

    // Normalize by overlap sum to correct window amplitude modulation
    for (let i = 0; i < length; i += 1) {
      const w = overlap[i] || 1
      outData[i] /= w
    }
  }
  return dest
}

/**
 * Soft noise gate with attack/release smoothing.
 * Ramps gain down on quiet samples so background hiss and room tone decay
 * instead of hard-cutting (which causes clicks).
 */
function applyNoiseGate(buffer: AudioBuffer, threshold: number): AudioBuffer {
  const win = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const Ac = win.AudioContext || win.webkitAudioContext
  if (!Ac) return buffer
  const tmp = new Ac({ sampleRate: buffer.sampleRate })
  try {
    const out = tmp.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate,
    )
    for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
      const inData = buffer.getChannelData(ch)
      const outData = out.getChannelData(ch)
      let smoothGain = 1
      for (let i = 0; i < inData.length; i += 1) {
        const abs = Math.abs(inData[i])
        const targetGain = abs > threshold ? 1 : Math.max(0, abs / threshold)
        // Faster attack (0.9), slower release (0.02) — quieter sounds fade out smoothly
        smoothGain =
          targetGain > smoothGain
            ? smoothGain + (targetGain - smoothGain) * 0.9
            : smoothGain + (targetGain - smoothGain) * 0.02
        outData[i] = inData[i] * smoothGain
      }
    }
    return out
  } finally {
    tmp.close().catch(() => undefined)
  }
}

/**
 * Simple compressor: soft-knee, ratio-based gain reduction on peaks.
 * Evens out voice levels so quiet words are still audible.
 */
function applyCompression(
  buffer: AudioBuffer,
  threshold: number,
  ratio: number,
): AudioBuffer {
  const channels = buffer.numberOfChannels
  const length = buffer.length
  const sampleRate = buffer.sampleRate
  const out = new OfflineAudioContext(channels, length, sampleRate)
  const dest = out.createBuffer(channels, length, sampleRate)

  for (let ch = 0; ch < channels; ch += 1) {
    const inData = buffer.getChannelData(ch)
    const outData = dest.getChannelData(ch)
    for (let i = 0; i < length; i += 1) {
      const abs = Math.abs(inData[i])
      if (abs > threshold) {
        const over = abs - threshold
        const reduced = threshold + over / ratio
        outData[i] = inData[i] >= 0 ? reduced : -reduced
      } else {
        outData[i] = inData[i]
      }
    }
  }
  return dest
}

/**
 * Voice isolation: high-pass rumble removal → bandpass around the vocal core
 * (~300Hz–3.4kHz) → presence boost → de-esser → compression → spectral
 * subtraction noise reduction → noise gate → normalize.
 */
function isolateVoice(context: OfflineAudioContext, source: AudioBufferSourceNode): AudioNode {
  const rumble = context.createBiquadFilter()
  rumble.type = 'highpass'
  rumble.frequency.value = 80
  rumble.Q.value = 0.7

  const bandpass = context.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 900
  bandpass.Q.value = 1.2

  const presence = context.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 2600
  presence.Q.value = 1
  presence.gain.value = 5

  const deEsser = context.createBiquadFilter()
  deEsser.type = 'lowshelf'
  deEsser.frequency.value = 6000
  deEsser.Q.value = 1
  deEsser.gain.value = -3

  const compressor = context.createDynamicsCompressor()
  compressor.threshold.value = -24
  compressor.knee.value = 12
  compressor.ratio.value = 4
  compressor.attack.value = 0.003
  compressor.release.value = 0.1

  source.connect(rumble)
  rumble.connect(bandpass)
  bandpass.connect(presence)
  presence.connect(deEsser)
  deEsser.connect(compressor)
  compressor.connect(context.destination)
  return compressor
}

/**
 * Background isolation: remove rumble, notch out the vocal band, tame
 * high-end hiss so what's left is mostly non-voice sound.
 */
function isolateBackground(context: OfflineAudioContext, source: AudioBufferSourceNode): AudioNode {
  const rumble = context.createBiquadFilter()
  rumble.type = 'highpass'
  rumble.frequency.value = 80

  const voiceNotch = context.createBiquadFilter()
  voiceNotch.type = 'notch' as BiquadFilterType
  voiceNotch.frequency.value = 1100
  voiceNotch.Q.value = 0.8

  const hiss = context.createBiquadFilter()
  hiss.type = 'lowpass'
  hiss.frequency.value = 10000

  source.connect(rumble)
  rumble.connect(voiceNotch)
  voiceNotch.connect(hiss)
  hiss.connect(context.destination)
  return hiss
}

async function runOffline(
  buffer: AudioBuffer,
  chain: (ctx: OfflineAudioContext, src: AudioBufferSourceNode) => AudioNode,
): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  )
  const source = offline.createBufferSource()
  source.buffer = buffer
  chain(offline, source)
  source.start(0)
  return offline.startRendering()
}

export async function extractAudio(
  file: File,
  mode: 'full' | 'voice' | 'background' = 'full',
): Promise<ExtractedAudio> {
  const win = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const AudioContextClass = win.AudioContext || win.webkitAudioContext
  if (!AudioContextClass) {
    throw new Error('Web Audio is not supported in this browser.')
  }

  const context = new AudioContextClass()
  try {
    const source = await file.arrayBuffer()
    let buffer: AudioBuffer
    try {
      buffer = await context.decodeAudioData(source)
    } catch {
      throw new Error(
        'No decodable audio track was found. Try an MP4 or WebM video.',
      )
    }

    if (!buffer.length || buffer.numberOfChannels < 1) {
      throw new Error('This video does not contain an audio track.')
    }

    let processed: AudioBuffer
    if (mode === 'full') {
      processed = buffer
    } else if (mode === 'voice') {
      processed = await runOffline(buffer, isolateVoice)
      processed = applyCompression(processed, 0.02, 4)
      processed = spectralSubtract(processed, 1.6)
      processed = applyNoiseGate(processed, 0.012)
      processed = normalize(processed, 0.9)
    } else {
      processed = await runOffline(buffer, isolateBackground)
      processed = normalize(processed, 0.8)
    }

    const blob = encodeWav(processed)
    return {
      blob,
      url: URL.createObjectURL(blob),
      duration: processed.duration,
      waveform: makeWaveform(processed),
      sampleRate: processed.sampleRate,
    }
  } finally {
    await context.close().catch(() => undefined)
  }
}
