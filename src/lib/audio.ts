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

/**
 * Soft noise gate: ramps gain down on quiet samples so background hiss
 * and room tone decay instead of hard-cutting (which causes clicks).
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
        smoothGain += (targetGain - smoothGain) * 0.15
        outData[i] = inData[i] * smoothGain
      }
    }
    return out
  } finally {
    tmp.close().catch(() => undefined)
  }
}

/**
 * Voice isolation: bandpass around the vocal range (~300Hz–3kHz) with a
 * presence boost, then a noise gate to suppress quiet background.
 */
function isolateVoice(context: OfflineAudioContext, source: AudioBufferSourceNode): AudioNode {
  const bandpass = context.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 900
  bandpass.Q.value = 1.2

  const presence = context.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 2600
  presence.Q.value = 1
  presence.gain.value = 6

  source.connect(bandpass)
  bandpass.connect(presence)
  presence.connect(context.destination)
  return presence
}

/**
 * Background isolation: remove rumble, notch out the vocal band, and tame
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
      processed = applyNoiseGate(processed, 0.015)
    } else {
      processed = await runOffline(buffer, isolateBackground)
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
