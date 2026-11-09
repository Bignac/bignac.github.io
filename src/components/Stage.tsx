import { useRef, type CSSProperties, type RefObject } from 'react'
import {
  Check,
  Film,
  Image as ImageIcon,
  Maximize2,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WandSparkles,
} from 'lucide-react'
import type {
  Background,
  FitMode,
  MediaAsset,
  ProcessingState,
  RatioKey,
  VideoMeta,
} from '../types'
import { RATIO_LABELS, ratioValue } from '../lib/utils'
import { VideoStage, type VideoStageHandle } from './VideoStage'

export function Stage({
  asset,
  ratio,
  fit,
  background,
  videoCutout,
  videoMeta,
  processing,
  videoRef,
  onUpload,
  onQuickCutout,
  onTogglePlay,
  onVideoMeta,
  onVideoAiStatus,
  onVideoError,
  threshold,
  feather,
  invert,
  videoAiStatus,
}: {
  asset: MediaAsset | null
  ratio: RatioKey
  fit: FitMode
  background: Background
  videoCutout: boolean
  videoMeta: VideoMeta
  processing: ProcessingState | null
  videoRef: RefObject<VideoStageHandle | null>
  onUpload: () => void
  onQuickCutout: () => void
  onTogglePlay: () => void
  onVideoMeta: (meta: VideoMeta) => void
  onVideoAiStatus: (status: import('../types').AiStatus) => void
  onVideoError: (message: string) => void
  threshold: number
  feather: number
  invert: boolean
  videoAiStatus: import('../types').AiStatus
}) {
  const artboardRef = useRef<HTMLDivElement>(null)
  const ratioCss = ratioValue(ratio, asset)
  const hasCutout =
    !!asset &&
    (asset.kind === 'image' ? asset.cutoutStatus === 'done' : videoCutout)
  const imageBusy =
    asset?.kind === 'image' &&
    processing?.assetId === asset.id &&
    processing.kind === 'image-cutout'
  const quickCutoutBusy =
    imageBusy ||
    (asset?.kind === 'video' &&
      videoCutout &&
      videoAiStatus === 'loading')

  const artboardStyle = {
    '--ratio': ratioCss,
  } as CSSProperties

  return (
    <div className="stage-area">
      <div className="stage-topline">
        <div className="stage-label">
          <span>Canvas</span>
          <i />
          <strong>
            {ratio === 'original' ? 'Auto' : ratio} · {RATIO_LABELS[ratio]}
          </strong>
        </div>
        <div className="stage-view-pill">
          <Maximize2 size={13} />
          Fit to view
        </div>
      </div>

      <div className="stage-workarea">
        <div
          ref={artboardRef}
          className={`artboard ${
            background.mode === 'transparent' ? 'is-transparent' : 'is-solid'
          } ${!asset ? 'is-empty' : ''}`}
          style={{
            ...artboardStyle,
            ...(asset && background.mode === 'color'
              ? { background: background.color }
              : undefined),
          }}
        >
          {!asset ? (
            <div className="empty-canvas">
              <div className="empty-orbit" aria-hidden="true">
                <span className="orbit-ring ring-one" />
                <span className="orbit-ring ring-two" />
                <div className="empty-main-icon">
                  <UploadCloud size={30} />
                </div>
                <span className="orbit-chip chip-image">
                  <ImageIcon size={15} />
                </span>
                <span className="orbit-chip chip-video">
                  <Film size={15} />
                </span>
                <span className="orbit-chip chip-cutout">
                  <WandSparkles size={15} />
                </span>
              </div>
              <h2>Drop media. Lose the background.</h2>
              <p>
                Upload a photo or video, cut out the subject, and drop it on
                chroma green — all without leaving your browser.
              </p>
              <button type="button" className="empty-upload" onClick={onUpload}>
                <UploadCloud size={17} />
                Choose image or video
              </button>
              <div className="empty-formats">
                <span>PNG</span>
                <span>JPG</span>
                <span>WEBP</span>
                <i />
                <span>MP4</span>
                <span>MOV</span>
                <span>WEBM</span>
              </div>
              <div className="empty-privacy">
                <ShieldCheck size={13} />
                Nothing leaves this device
              </div>
            </div>
          ) : asset.kind === 'image' ? (
            <div className="image-stage">
              <img
                src={asset.cutoutUrl ?? asset.url}
                alt={asset.name}
                draggable={false}
                style={{ objectFit: fit }}
              />
            </div>
          ) : (
            <VideoStage
              key={asset.id}
              ref={videoRef}
              asset={asset}
              background={background}
              fit={fit}
              ratio={ratio}
              removeBg={videoCutout}
              threshold={threshold}
              feather={feather}
              invert={invert}
              onMeta={onVideoMeta}
              onAiStatus={onVideoAiStatus}
              onError={onVideoError}
            />
          )}

          {asset ? (
            <>
              <div className={`canvas-status ${hasCutout ? 'is-cutout' : ''}`}>
                <span className="canvas-status-dot" />
                {asset.kind === 'video'
                  ? hasCutout
                    ? videoAiStatus === 'loading'
                      ? 'Preparing cutout'
                      : 'AI cutout · live'
                    : 'Original video'
                  : hasCutout
                    ? 'Background removed'
                    : 'Original image'}
                {hasCutout ? <Check size={11} /> : null}
              </div>

              {!hasCutout ? (
                <button
                  type="button"
                  className="canvas-quick-cutout"
                  onClick={onQuickCutout}
                  disabled={quickCutoutBusy}
                >
                  {quickCutoutBusy ? (
                    <span className="tiny-spinner" />
                  ) : (
                    <WandSparkles size={16} />
                  )}
                  {asset.kind === 'video'
                    ? quickCutoutBusy
                      ? 'Loading AI cutout'
                      : 'Turn on AI cutout'
                    : quickCutoutBusy
                      ? 'Removing background'
                      : 'Remove background'}
                  <span className="quick-ai">AI</span>
                </button>
              ) : null}

              {asset.kind === 'video' && !videoMeta.playing && !imageBusy ? (
                <button
                  type="button"
                  className="canvas-play"
                  onClick={onTogglePlay}
                  aria-label="Play video"
                >
                  <Play size={20} fill="currentColor" />
                </button>
              ) : null}

              {asset.kind === 'video' && videoMeta.playing ? (
                <button
                  type="button"
                  className="canvas-pause"
                  onClick={onTogglePlay}
                  aria-label="Pause video"
                >
                  <Pause size={14} fill="currentColor" />
                </button>
              ) : null}

              {imageBusy ? (
                <div className="canvas-processing">
                  <div className="canvas-processing-card">
                    <span className="processing-orb">
                      <Sparkles size={20} />
                      <i />
                    </span>
                    <div>
                      <strong>{processing?.label ?? 'Removing background'}</strong>
                      <span>Your image stays on this device.</span>
                    </div>
                    <b>{Math.round(processing?.progress ?? 0)}%</b>
                    <div className="canvas-progress-track">
                      <span
                        style={{
                          width: `${Math.max(4, processing?.progress ?? 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
