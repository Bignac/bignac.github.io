import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock3,
  Download,
  FileAudio,
  Film,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import type { Background, MediaAsset } from '../types'
import { downloadBlob, fileBaseName, formatTime } from '../lib/utils'
import type { VideoFormat } from '../lib/video'

type ExportStatus = 'idle' | 'working' | 'done' | 'error'

export function ExportModal({
  open,
  asset,
  background,
  width,
  height,
  previewRatio,
  formatLabel,
  videoFormat,
  onClose,
  onExportImage,
  onExportVideo,
  onDownloadAudio,
}: {
  open: boolean
  asset: MediaAsset | null
  background: Background
  width: number
  height: number
  previewRatio: number
  formatLabel: string
  videoFormat: VideoFormat | null
  onClose: () => void
  onExportImage: () => Promise<Blob>
  onExportVideo: (options: {
    mimeType: string
    onProgress: (progress: number) => void
  }) => Promise<Blob>
  onDownloadAudio: () => void
}) {
  const [filename, setFilename] = useState('')
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const extension =
    asset?.kind === 'video'
      ? (videoFormat?.extension ?? 'webm')
      : 'png'
  const isVideo = asset?.kind === 'video'
  const suffix =
    background.mode === 'color'
      ? background.color.toLowerCase() === '#00b140'
        ? 'greenscreen'
        : 'backdrop'
      : 'cutout'

  const defaultName = useMemo(
    () =>
      asset
        ? `${fileBaseName(asset.name)}-${suffix}`
        : 'bignac-export',
    [asset, suffix],
  )

  useEffect(() => {
    if (!open) return
    setFilename(defaultName)
    setStatus('idle')
    setProgress(0)
    setError('')
  }, [defaultName, open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && status !== 'working') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open, status])

  if (!open) return null

  const finalFilename = () => {
    const trimmed = filename.trim() || defaultName
    return trimmed.toLowerCase().endsWith(`.${extension}`)
      ? trimmed
      : `${trimmed}.${extension}`
  }

  const runExport = async () => {
    if (!asset) return
    setStatus('working')
    setProgress(0)
    setError('')
    try {
      let blob: Blob
      if (asset.kind === 'video') {
        if (!videoFormat) {
          throw new Error(
            'Video recording is not available in this browser. Try Chrome or Edge.',
          )
        }
        blob = await onExportVideo({
          mimeType: videoFormat.mime,
          onProgress: setProgress,
        })
      } else {
        blob = await onExportImage()
      }
      setProgress(1)
      downloadBlob(blob, finalFilename())
      setStatus('done')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Something went wrong while exporting.',
      )
      setStatus('error')
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && status !== 'working') {
          onClose()
        }
      }}
    >
      <div className="export-modal" role="dialog" aria-modal="true" aria-label="Export">
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          disabled={status === 'working'}
          aria-label="Close export"
        >
          <X size={18} />
        </button>

        <div className="export-modal-left">
          <div className="export-stage-label">
            <span>Output preview</span>
            <span className="export-live-dot" />
          </div>
          <div
            className={`export-artboard ${
              background.mode === 'transparent' ? 'is-transparent' : 'is-solid'
            }`}
            style={{
              aspectRatio: previewRatio,
              width: `min(100%, calc(44vh * ${previewRatio}))`,
              background:
                background.mode === 'color' ? background.color : undefined,
            }}
          >
            {asset ? (
              <img
                src={asset.cutoutUrl ?? asset.thumbUrl ?? asset.url}
                alt=""
                draggable={false}
              />
            ) : (
              <div className="export-empty-art">Add media to export</div>
            )}
            <span className="export-file-badge">
              {isVideo ? <Film size={12} /> : <ImageIcon size={12} />}
              {formatLabel}
            </span>
          </div>
          <div className="export-stage-foot">
            <span>{asset?.name ?? 'No media selected'}</span>
            <span>
              {width} × {height}
            </span>
          </div>
        </div>

        <div className="export-modal-right">
          <div className="export-heading">
            <span className="eyebrow">Export</span>
            <h2>Ready for the edit.</h2>
            <p>
              {asset?.kind === 'video'
                ? 'A green screen clip with audio, rendered locally in real time.'
                : 'A crisp PNG with your chosen backdrop, rendered locally.'}
            </p>
          </div>

          <div className="export-format-card">
            <span className="export-format-icon">
              {isVideo ? <Film size={18} /> : <ImageIcon size={18} />}
            </span>
            <div>
              <strong>{formatLabel}</strong>
              <span>
                {isVideo
                  ? `${videoFormat?.label ?? 'Video'} + audio`
                  : background.mode === 'color'
                    ? 'Flattened PNG'
                    : 'Transparent PNG'}
              </span>
            </div>
            <span className="format-check">
              <CheckCircle2 size={16} />
            </span>
          </div>

          <div className="export-specs">
            <div>
              <span>Resolution</span>
              <strong>{width} × {height}</strong>
            </div>
            <div>
              <span>Backdrop</span>
              <strong className="spec-with-dot">
                <i
                  className={
                    background.mode === 'color' ? 'is-color' : 'is-checker'
                  }
                  style={
                    background.mode === 'color'
                      ? { background: background.color }
                      : undefined
                  }
                />
                {background.mode === 'color'
                  ? background.color.toLowerCase() === '#00b140'
                    ? 'Chroma green'
                    : background.color.toUpperCase()
                  : 'Transparent'}
              </strong>
            </div>
            {isVideo ? (
              <div>
                <span>Duration</span>
                <strong>{formatTime(asset?.duration ?? 0)}</strong>
              </div>
            ) : null}
            <div>
              <span>Processing</span>
              <strong>On-device</strong>
            </div>
          </div>

          <label className="filename-field">
            <span>File name</span>
            <div>
              <input
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                spellCheck={false}
                disabled={status === 'working'}
              />
              <span>.{extension}</span>
            </div>
          </label>

          <div className="export-info-line">
            {isVideo ? <Clock3 size={14} /> : <Sparkles size={14} />}
            <span>
              {isVideo
                ? `Renders in real time — about ${formatTime(asset?.duration ?? 0)}. Keep this tab visible.`
                : 'Typically ready in under a second. Your media never leaves this browser.'}
            </span>
          </div>

          {status === 'working' ? (
            <div className="export-progress">
              <div className="export-progress-head">
                <span>
                  {isVideo ? 'Rendering green screen video…' : 'Encoding PNG…'}
                </span>
                <b>{Math.round(progress * 100)}%</b>
              </div>
              <div className="progress-track large">
                <span style={{ width: `${Math.max(4, progress * 100)}%` }} />
              </div>
              {isVideo ? (
                <span className="export-progress-note">
                  Keep this tab in the foreground for smooth frame capture.
                </span>
              ) : null}
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="export-error">{error}</div>
          ) : null}

          {status === 'done' ? (
            <div className="export-success">
              <CheckCircle2 size={16} />
              <span>Exported and downloaded. Check your Downloads folder.</span>
            </div>
          ) : null}

          <div className="export-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={onClose}
              disabled={status === 'working'}
            >
              {status === 'done' ? 'Close' : 'Cancel'}
            </button>
            <button
              type="button"
              className="primary-action export-run"
              onClick={runExport}
              disabled={!asset || status === 'working' || (isVideo && !videoFormat)}
            >
              {status === 'working' ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Download size={16} />
              )}
              {status === 'working'
                ? 'Rendering…'
                : status === 'done'
                  ? 'Download again'
                  : `Export ${formatLabel}`}
            </button>
          </div>

          {asset?.audio ? (
            <button
              type="button"
              className="audio-export-link"
              onClick={onDownloadAudio}
              disabled={status === 'working'}
            >
              <FileAudio size={14} />
              Also download extracted WAV
            </button>
          ) : null}

          <div className="export-privacy">
            <ShieldCheck size={13} />
            Local-only export. No uploads, no watermark.
          </div>
        </div>
      </div>
    </div>
  )
}
