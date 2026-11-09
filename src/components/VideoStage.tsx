import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type RefObject,
} from 'react'
import type { AiStatus, Background, FitMode, MediaAsset, RatioKey } from '../types'
import {
  createMaskTexture,
  loadSegmenter,
  renderMask,
  resetMaskTexture,
  type MaskTexture,
} from '../lib/segmentation'
import {
  fitRect,
  getPreviewSize,
} from '../lib/utils'
import { canRecordCanvas } from '../lib/video'

interface Settings {
  background: Background
  fit: FitMode
  removeBg: boolean
  threshold: number
  feather: number
  invert: boolean
}

interface AudioGraph {
  context: AudioContext
  source: MediaElementAudioSourceNode
  destination: MediaStreamAudioDestinationNode
  monitor: GainNode
}

export interface VideoStageHandle {
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (time: number) => void
  captureFrame: (options: {
    width: number
    height: number
  }) => Promise<Blob>
  exportVideo: (options: {
    width: number
    height: number
    mimeType: string
    onProgress: (progress: number) => void
  }) => Promise<Blob>
  getVideo: () => HTMLVideoElement | null
}

interface VideoStageProps {
  asset: MediaAsset
  background: Background
  fit: FitMode
  ratio: RatioKey
  removeBg: boolean
  threshold: number
  feather: number
  invert: boolean
  onMeta: (meta: { time: number; duration: number; playing: boolean }) => void
  onAiStatus: (status: AiStatus) => void
  onError: (message: string) => void
}

function drawComposite(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  video: HTMLVideoElement,
  settings: Settings,
  mask: MaskTexture | null,
  personCanvas: HTMLCanvasElement,
) {
  context.clearRect(0, 0, width, height)
  if (settings.background.mode === 'color') {
    context.fillStyle = settings.background.color
    context.fillRect(0, 0, width, height)
  }

  const rect = fitRect(
    width,
    height,
    video.videoWidth,
    video.videoHeight,
    settings.fit,
  )

  if (settings.removeBg && mask) {
    if (personCanvas.width !== width || personCanvas.height !== height) {
      personCanvas.width = width
      personCanvas.height = height
    }
    const personContext = personCanvas.getContext('2d')
    if (personContext) {
      personContext.clearRect(0, 0, width, height)
      personContext.globalCompositeOperation = 'source-over'
      personContext.drawImage(
        video,
        rect.sourceX,
        rect.sourceY,
        rect.sourceWidth,
        rect.sourceHeight,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
      )
      personContext.globalCompositeOperation = 'destination-in'
      personContext.imageSmoothingEnabled = true
      personContext.imageSmoothingQuality = 'high'
      personContext.drawImage(
        mask.canvas,
        0,
        0,
        mask.width,
        mask.height,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
      )
      personContext.globalCompositeOperation = 'source-over'
      context.drawImage(personCanvas, 0, 0)
      return
    }
  }

  context.drawImage(
    video,
    rect.sourceX,
    rect.sourceY,
    rect.sourceWidth,
    rect.sourceHeight,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  )
}

function effectiveDuration(video: HTMLVideoElement, fallback: number) {
  return Number.isFinite(video.duration) && video.duration > 0
    ? video.duration
    : fallback
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.02 && video.readyState >= 2) {
      resolve()
      return
    }
    const finish = () => {
      video.removeEventListener('seeked', finish)
      resolve()
    }
    video.addEventListener('seeked', finish)
    video.currentTime = time
    window.setTimeout(finish, 1200)
  })
}

export const VideoStage = forwardRef<VideoStageHandle, VideoStageProps>(
  function VideoStage(
    {
      asset,
      background,
      fit,
      ratio,
      removeBg,
      threshold,
      feather,
      invert,
      onMeta,
      onAiStatus,
      onError,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const personCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
    const maskRef = useRef<MaskTexture | null>(null)
    const segmenterRef = useRef<Awaited<ReturnType<typeof loadSegmenter>> | null>(
      null,
    )
    const settingsRef = useRef<Settings>({
      background,
      fit,
      removeBg,
      threshold,
      feather,
      invert,
    })
    const lastDrawnTimeRef = useRef(-1)
    const lastSegmentedTimeRef = useRef(-1)
    const lastSegmentCallRef = useRef(0)
    const lastMetaRef = useRef(0)
    const needsRedrawRef = useRef(true)
    const exportingRef = useRef(false)
    const aiErrorRef = useRef(false)
    const audioGraphRef = useRef<AudioGraph | null>(null)
    const onMetaRef = useRef(onMeta)
    const onAiStatusRef = useRef(onAiStatus)
    const onErrorRef = useRef(onError)

    onMetaRef.current = onMeta
    onAiStatusRef.current = onAiStatus
    onErrorRef.current = onError

    useEffect(() => {
      settingsRef.current = {
        background,
        fit,
        removeBg,
        threshold,
        feather,
        invert,
      }
      needsRedrawRef.current = true
    }, [background, fit, removeBg, threshold, feather, invert])

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const size = getPreviewSize(ratio, asset)
      canvas.width = size.width
      canvas.height = size.height
      personCanvasRef.current.width = size.width
      personCanvasRef.current.height = size.height
      maskRef.current = createMaskTexture()
      resetMaskTexture(maskRef.current)
      needsRedrawRef.current = true
      lastDrawnTimeRef.current = -1
      lastSegmentedTimeRef.current = -1
    }, [ratio, asset])

    useEffect(() => {
      const video = videoRef.current
      if (!video) return
      video.pause()
      video.src = asset.url
      video.load()
      lastDrawnTimeRef.current = -1
      lastSegmentedTimeRef.current = -1
      maskRef.current = createMaskTexture()
      needsRedrawRef.current = true
      aiErrorRef.current = false
      onMetaRef.current({
        time: 0,
        duration: asset.duration,
        playing: false,
      })

      const handlePlay = () =>
        onMetaRef.current({
          time: video.currentTime,
          duration: effectiveDuration(video, asset.duration),
          playing: true,
        })
      const handlePause = () =>
        onMetaRef.current({
          time: video.currentTime,
          duration: effectiveDuration(video, asset.duration),
          playing: false,
        })
      const handleEnded = () =>
        onMetaRef.current({
          time: video.duration || asset.duration,
          duration: effectiveDuration(video, asset.duration),
          playing: false,
        })
      const handleSeeked = () => {
        if (maskRef.current) resetMaskTexture(maskRef.current)
        lastDrawnTimeRef.current = -1
        lastSegmentedTimeRef.current = -1
        needsRedrawRef.current = true
        onMetaRef.current({
          time: video.currentTime,
          duration: effectiveDuration(video, asset.duration),
          playing: !video.paused,
        })
      }
      const handleError = () =>
        onErrorRef.current(
          'This video could not be played. Try an MP4 (H.264) or WebM file.',
        )

      video.addEventListener('play', handlePlay)
      video.addEventListener('pause', handlePause)
      video.addEventListener('ended', handleEnded)
      video.addEventListener('seeked', handleSeeked)
      video.addEventListener('error', handleError)

      return () => {
        video.removeEventListener('play', handlePlay)
        video.removeEventListener('pause', handlePause)
        video.removeEventListener('ended', handleEnded)
        video.removeEventListener('seeked', handleSeeked)
        video.removeEventListener('error', handleError)
      }
    }, [asset.duration, asset.url])

    useEffect(() => {
      if (!removeBg) {
        onAiStatusRef.current('idle')
        return
      }
      if (segmenterRef.current) {
        onAiStatusRef.current('ready')
        needsRedrawRef.current = true
        return
      }

      let cancelled = false
      onAiStatusRef.current('loading')
      loadSegmenter('VIDEO')
        .then((segmenter) => {
          if (cancelled) return
          segmenterRef.current = segmenter
          aiErrorRef.current = false
          onAiStatusRef.current('ready')
          needsRedrawRef.current = true
        })
        .catch(() => {
          if (cancelled) return
          aiErrorRef.current = true
          onAiStatusRef.current('error')
          onErrorRef.current(
            'The on-device cutout model failed to load. Check your connection and try again.',
          )
        })

      return () => {
        cancelled = true
      }
    }, [removeBg])

    useEffect(() => {
      let frame = 0

      const segmentCurrentFrame = (video: HTMLVideoElement) => {
        const segmenter = segmenterRef.current
        const mask = maskRef.current
        if (!segmenter || !mask) return
        const now = performance.now()
        if (now - lastSegmentCallRef.current < 30) return
        lastSegmentCallRef.current = now
        try {
          segmenter.segmentForVideo(video, now, (result) => {
            renderMask(mask, result, segmenter, {
              threshold: settingsRef.current.threshold,
              feather: settingsRef.current.feather,
              invert: settingsRef.current.invert,
              smoothing: 0.22,
            })
            lastSegmentedTimeRef.current = video.currentTime
            needsRedrawRef.current = true
          })
        } catch {
          if (!aiErrorRef.current) {
            aiErrorRef.current = true
            onErrorRef.current(
              'The live cutout paused unexpectedly. Try turning it off and on again.',
            )
          }
        }
      }

      const loop = () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (video && canvas && video.readyState >= 2 && !exportingRef.current) {
          const context = canvas.getContext('2d')
          if (context) {
            const currentTime = video.currentTime
            const timeChanged = currentTime !== lastDrawnTimeRef.current
            if (timeChanged || needsRedrawRef.current) {
              if (
                settingsRef.current.removeBg &&
                segmenterRef.current &&
                currentTime !== lastSegmentedTimeRef.current
              ) {
                segmentCurrentFrame(video)
              }
              drawComposite(
                context,
                canvas.width,
                canvas.height,
                video,
                settingsRef.current,
                settingsRef.current.removeBg ? maskRef.current : null,
                personCanvasRef.current,
              )
              lastDrawnTimeRef.current = currentTime
              needsRedrawRef.current = false
            }

            const now = performance.now()
            if (now - lastMetaRef.current > 90) {
              lastMetaRef.current = now
              onMetaRef.current({
                time: currentTime,
                duration: effectiveDuration(video, asset.duration),
                playing: !video.paused && !video.ended,
              })
            }
          }
        }
        frame = requestAnimationFrame(loop)
      }

      frame = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(frame)
    }, [asset.duration])

    useEffect(() => {
      return () => {
        audioGraphRef.current?.context.close().catch(() => undefined)
        audioGraphRef.current = null
        segmenterRef.current = null
      }
    }, [])

    const ensureAudioGraph = async (video: HTMLVideoElement) => {
      if (!audioGraphRef.current) {
        const AudioContextClass = window.AudioContext
        if (!AudioContextClass) return null
        const context = new AudioContextClass()
        const source = context.createMediaElementSource(video)
        const destination = context.createMediaStreamDestination()
        const monitor = context.createGain()
        monitor.gain.value = 1
        source.connect(destination)
        source.connect(monitor)
        monitor.connect(context.destination)
        audioGraphRef.current = { context, source, destination, monitor }
      }
      await audioGraphRef.current.context.resume()
      return audioGraphRef.current
    }

    useImperativeHandle(ref, () => ({
      play: () => {
        videoRef.current?.play().catch(() => undefined)
      },
      pause: () => {
        videoRef.current?.pause()
      },
      toggle: () => {
        const video = videoRef.current
        if (!video) return
        if (video.paused) video.play().catch(() => undefined)
        else video.pause()
      },
      seek: (time: number) => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = Math.min(
          Math.max(time, 0),
          effectiveDuration(video, asset.duration),
        )
      },
      getVideo: () => videoRef.current,
      captureFrame: async ({
        width,
        height,
      }: {
        width: number
        height: number
      }) => {
        const video = videoRef.current
        if (!video || video.readyState < 2) {
          throw new Error('The video is still loading.')
        }
        if (settingsRef.current.removeBg && segmenterRef.current) {
          const mask = maskRef.current
          if (mask) {
            segmenterRef.current.segmentForVideo(
              video,
              performance.now(),
              (result) => {
                renderMask(mask, result, segmenterRef.current!, {
                  threshold: settingsRef.current.threshold,
                  feather: settingsRef.current.feather,
                  invert: settingsRef.current.invert,
                  smoothing: 0,
                })
              },
            )
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas 2D is unavailable.')
        drawComposite(
          context,
          width,
          height,
          video,
          settingsRef.current,
          settingsRef.current.removeBg ? maskRef.current : null,
          document.createElement('canvas'),
        )
        return new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('The frame could not be encoded.'))
          }, 'image/png')
        })
      },
      exportVideo: async ({
        width,
        height,
        mimeType,
        onProgress,
      }: {
        width: number
        height: number
        mimeType: string
        onProgress: (progress: number) => void
      }) => {
        const video = videoRef.current
        if (!video) throw new Error('No video is selected.')
        if (!canRecordCanvas()) {
          throw new Error(
            'Video recording is not supported in this browser. Try Chrome or Edge.',
          )
        }

        if (settingsRef.current.removeBg && !segmenterRef.current) {
          const segmenter = await loadSegmenter('VIDEO')
          segmenterRef.current = segmenter
        }

        video.pause()
        await seekVideo(video, 0)
        exportingRef.current = true

        const graph = await ensureAudioGraph(video)
        if (graph) graph.monitor.gain.value = 0
        video.muted = false
        video.volume = 1

        const output = document.createElement('canvas')
        output.width = width
        output.height = height
        const context = output.getContext('2d')
        if (!context) throw new Error('Canvas 2D is unavailable.')

        const personCanvas = document.createElement('canvas')
        personCanvas.width = width
        personCanvas.height = height
        const exportMask = createMaskTexture()
        const canvasStream = (
          output as HTMLCanvasElement & {
            captureStream: (fps?: number) => MediaStream
          }
        ).captureStream(30)
        const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()]
        if (graph) {
          tracks.push(...graph.destination.stream.getAudioTracks())
        }
        const combined = new MediaStream(tracks)
        const chunks: BlobPart[] = []

        return await new Promise<Blob>((resolve, reject) => {
          let recorder: MediaRecorder
          try {
            recorder = new MediaRecorder(combined, {
              mimeType,
              videoBitsPerSecond: 9_000_000,
              audioBitsPerSecond: 160_000,
            })
          } catch {
            exportingRef.current = false
            if (graph) graph.monitor.gain.value = 1
            reject(new Error('This video format is not supported by your browser.'))
            return
          }

          let frame = 0
          let stopTimer = 0
          let finished = false

          const cleanup = () => {
            if (finished) return
            finished = true
            cancelAnimationFrame(frame)
            window.clearTimeout(stopTimer)
            exportingRef.current = false
            if (graph) graph.monitor.gain.value = 1
            video.pause()
            video.currentTime = 0
            canvasStream.getTracks().forEach((track) => track.stop())
            needsRedrawRef.current = true
            lastDrawnTimeRef.current = -1
          }

          const finalize = () => {
            const blob = new Blob(chunks, { type: recorder.mimeType || mimeType })
            cleanup()
            resolve(blob)
          }

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data)
          }
          recorder.onerror = () => {
            cleanup()
            reject(new Error('The video recorder failed. Please try again.'))
          }
          recorder.onstop = finalize

          const drawExportFrame = () => {
            if (finished) return
            if (video.readyState >= 2) {
              if (settingsRef.current.removeBg && segmenterRef.current) {
                const now = performance.now()
                segmenterRef.current.segmentForVideo(video, now, (result) => {
                  renderMask(exportMask, result, segmenterRef.current!, {
                    threshold: settingsRef.current.threshold,
                    feather: settingsRef.current.feather,
                    invert: settingsRef.current.invert,
                    smoothing: 0.2,
                  })
                })
              }
              drawComposite(
                context,
                width,
                height,
                video,
                settingsRef.current,
                settingsRef.current.removeBg ? exportMask : null,
                personCanvas,
              )
            }

            const duration = effectiveDuration(video, asset.duration) || 1
            onProgress(
              Math.min(0.99, Math.max(0, video.currentTime / duration)),
            )

            if (video.ended || video.paused) {
              window.clearTimeout(stopTimer)
              stopTimer = window.setTimeout(() => {
                if (recorder.state === 'recording') recorder.stop()
              }, 240)
              return
            }
            frame = requestAnimationFrame(drawExportFrame)
          }

          recorder.start(500)
          video
            .play()
            .then(() => {
              frame = requestAnimationFrame(drawExportFrame)
            })
            .catch(() => {
              cleanup()
              reject(new Error('Playback was blocked while exporting.'))
            })
        })
      },
    }))

    const previewSize = getPreviewSize(ratio, asset)

    return (
      <>
        <video
          ref={videoRef}
          className="hidden-video"
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        <canvas
          ref={canvasRef}
          className="stage-canvas"
          width={previewSize.width}
          height={previewSize.height}
          aria-label={`${asset.name} preview`}
        />
      </>
    )
  },
)

export function useVideoStageRef(): RefObject<VideoStageHandle | null> {
  return useRef<VideoStageHandle | null>(null)
}
