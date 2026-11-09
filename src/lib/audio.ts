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

export async function extractAudio(file: File): Promise<ExtractedAudio> {
  const AudioContextClass = window.AudioContext
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

    const blob = encodeWav(buffer)
    return {
      blob,
      url: URL.createObjectURL(blob),
      duration: buffer.duration,
      waveform: makeWaveform(buffer),
      sampleRate: buffer.sampleRate,
    }
  } finally {
    await context.close().catch(() => undefined)
  }
}
