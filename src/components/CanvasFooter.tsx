import { useRef, useState } from 'react'
import {
  Check,
  Download,
  FileAudio,
  Film,
  Image as ImageIcon,
  Music2,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { MediaAsset, VideoMeta } from '../types'
import { formatTime, formatTimePrecise } from '../lib/utils'

export function CanvasFooter({
  asset,
  meta,
  videoCutout,
  processing,
  onTogglePlay,
  onSeek,
  onOpenAudio,
  onExport,
}: {
  asset: MediaAsset | null
  meta: VideoMeta
  videoCutout: boolean
  processing: import('../types').ProcessingState | null
  onTogglePlay: () => void
  onSeek: (time: number) => void
  onOpenAudio: () => void
  onExport: () => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const duration = meta.duration || asset?.duration || 0
  const progress = duration > 0 ? Math.min(1, meta.time / duration) : 0
  const audioBusy =
    asset?.kind === 'video' &&
    processing?.assetId === asset.id &&
    processing.kind === 'audio'

  const seekFromPointer = (clientX: number) => {
    const track = trackRef.current
    if (!track || duration <= 0) return
    const rect = track.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onSeek(fraction * duration)
  }

  if (!asset) {
    return (
      <footer className="canvas-footer is-empty">
        <div className="footer-privacy">
          <ShieldCheck size={14} />
          <span>100% on-device processing</span>
        </div>
        <div className="footer-shortcuts">
          <span><kbd>Space</kbd> Play / pause</span>
          <span><kbd>⌘</kbd><kbd>E</kbd> Export</span>
        </div>
      </footer>
    )
  }

  if (asset.kind === 'image') {
    return (
      <footer className="canvas-footer image-footer">
        <div className="footer-file">
          <span className="footer-thumb">
            <img src={asset.cutoutUrl ?? asset.thumbUrl ?? asset.url} alt="" />
          </span>
          <div>
            <strong>{asset.name}</strong>
            <span>{asset.width} × {asset.height} px · {asset.kind.toUpperCase()}</span>
          </div>
        </div>
        <div className="footer-center-pills">
          <span className={`footer-pill ${asset.cutoutStatus === 'done' ? 'is-on' : ''}`}>
            {asset.cutoutStatus === 'done' ? <Check size={12} /> : <ImageIcon size={12} />}
            {asset.cutoutStatus === 'done' ? 'Cutout ready' : 'Original image'}
          </span>
          {asset.cutoutStatus === 'done' ? (
            <span className="footer-pill is-green">
              <Sparkles size={12} />
              Green screen ready
            </span>
          ) : null}
        </div>
        <div className="footer-actions">
          <span className="footer-format">PNG</span>
          <button type="button" className="footer-export" onClick={onExport}>
            <Download size={14} />
            Export
          </button>
        </div>
      </footer>
    )
  }

  return (
    <footer className="canvas-footer video-footer">
      <div className="timeline-main">
        <button
          type="button"
          className="timeline-play"
          onClick={onTogglePlay}
          aria-label={meta.playing ? 'Pause video' : 'Play video'}
        >
          {meta.playing ? (
            <Pause size={17} fill="currentColor" />
          ) : (
            <Play size={17} fill="currentColor" />
          )}
        </button>

        <div className="timeline-clock">
          <strong>{formatTimePrecise(meta.time)}</strong>
          <span>/ {formatTime(duration)}</span>
        </div>

        <div className="timeline-track-wrap">
          <div
            ref={trackRef}
            className={`timeline-track ${dragging ? 'is-dragging' : ''}`}
            role="slider"
            tabIndex={0}
            aria-label="Video position"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(meta.time)}
            onPointerDown={(event) => {
              setDragging(true)
              event.currentTarget.setPointerCapture(event.pointerId)
              seekFromPointer(event.clientX)
            }}
            onPointerMove={(event) => {
              if (dragging) seekFromPointer(event.clientX)
            }}
            onPointerUp={(event) => {
              setDragging(false)
              event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') onSeek(Math.min(duration, meta.time + 1))
              if (event.key === 'ArrowLeft') onSeek(Math.max(0, meta.time - 1))
            }}
          >
            <span className="timeline-ticks" aria-hidden="true" />
            <span className="timeline-fill" style={{ width: `${progress * 100}%` }} />
            <span className="timeline-thumb" style={{ left: `${progress * 100}%` }} />
          </div>
          <div className="timeline-labels">
            <span>{formatTime(0)}</span>
            <span>{formatTime(duration / 2)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <div className="timeline-side">
        <span className={`footer-pill ${videoCutout ? 'is-on' : ''}`}>
          {videoCutout ? <Sparkles size={12} /> : <Film size={12} />}
          {videoCutout ? 'Cutout' : 'Original'}
        </span>
        <button
          type="button"
          className={`footer-audio ${asset.audio ? 'has-audio' : ''}`}
          onClick={onOpenAudio}
          title={asset.audio ? 'Open extracted audio' : 'Extract audio'}
        >
          {audioBusy ? (
            <span className="tiny-spinner" />
          ) : asset.audio ? (
            <Music2 size={15} />
          ) : (
            <FileAudio size={15} />
          )}
          <span>{asset.audio ? 'Audio ready' : 'Extract audio'}</span>
        </button>
        <button type="button" className="footer-export" onClick={onExport}>
          <Download size={14} />
          Export
        </button>
      </div>
    </footer>
  )
}
