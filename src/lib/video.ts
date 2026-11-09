export interface VideoFormat {
  mime: string
  extension: 'mp4' | 'webm'
  label: string
  note: string
}

const CANDIDATES: VideoFormat[] = [
  {
    mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    extension: 'mp4',
    label: 'MP4',
    note: 'Best for sharing',
  },
  {
    mime: 'video/mp4',
    extension: 'mp4',
    label: 'MP4',
    note: 'Best for sharing',
  },
  {
    mime: 'video/webm;codecs=vp9,opus',
    extension: 'webm',
    label: 'WebM',
    note: 'High quality, small file',
  },
  {
    mime: 'video/webm;codecs=vp8,opus',
    extension: 'webm',
    label: 'WebM',
    note: 'Fast, widely supported',
  },
  {
    mime: 'video/webm',
    extension: 'webm',
    label: 'WebM',
    note: 'Browser-native video',
  },
]

export function getPreferredVideoFormat(): VideoFormat | null {
  if (typeof MediaRecorder === 'undefined') return null
  return (
    CANDIDATES.find((candidate) => {
      try {
        return MediaRecorder.isTypeSupported(candidate.mime)
      } catch {
        return false
      }
    }) ?? null
  )
}

export function canRecordCanvas() {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype
  )
}
