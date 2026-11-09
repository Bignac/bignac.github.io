import { removeBackground } from '@imgly/background-removal'

export interface CutoutProgress {
  label: string
  percent: number
}

function progressFromKey(
  key: string,
  current: number,
  total: number,
): CutoutProgress {
  if (key.startsWith('fetch:')) {
    const ratio = total > 0 ? current / total : 0
    return {
      label: 'Downloading cutout model',
      percent: Math.min(76, 6 + ratio * 70),
    }
  }
  if (key.includes('decode')) {
    return { label: 'Preparing your image', percent: 78 }
  }
  if (key.includes('inference')) {
    return { label: 'Finding the subject', percent: 86 }
  }
  if (key.includes('mask')) {
    return { label: 'Softening the edges', percent: 93 }
  }
  return { label: 'Encoding transparent PNG', percent: 97 }
}

export async function removeImageBackgroundAI(
  file: File,
  onProgress: (progress: CutoutProgress) => void,
): Promise<Blob> {
  const supportsWebGpu = 'gpu' in navigator

  const run = (device: 'gpu' | 'cpu') =>
    removeBackground(file, {
      model: 'isnet_fp16',
      device,
      proxyToWorker: true,
      output: { format: 'image/png', quality: 1 },
      progress: (key, current, total) => {
        onProgress(progressFromKey(key, current, total))
      },
    })

  if (supportsWebGpu) {
    try {
      return await run('gpu')
    } catch {
      onProgress({ label: 'Switching to on-device CPU', percent: 18 })
    }
  }

  return run('cpu')
}
