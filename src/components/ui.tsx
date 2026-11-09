import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  Check,
  Download,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { Background, MediaAsset, RatioKey } from '../types'
import { formatTime, RATIO_VALUES } from '../lib/utils'

export function Section({
  title,
  eyebrow,
  icon,
  action,
  children,
  className = '',
}: {
  title: string
  eyebrow?: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`section ${className}`}>
      <div className="section-head">
        <div className="section-title-wrap">
          {icon ? <span className="section-icon">{icon}</span> : null}
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            <h2>{title}</h2>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'is-on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  valueLabel,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  valueLabel: string
  hint?: string
}) {
  return (
    <label className="range-control">
      <span className="range-head">
        <span>{label}</span>
        <span className="range-value">{valueLabel}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <span className="range-hint">{hint}</span> : null}
    </label>
  )
}

const RATIOS: Array<{ key: RatioKey; label: string; note: string }> = [
  { key: '16:9', label: '16:9', note: 'Landscape' },
  { key: '9:16', label: '9:16', note: 'Portrait' },
  { key: '1:1', label: '1:1', note: 'Square' },
  { key: '4:5', label: '4:5', note: 'Social' },
  { key: 'original', label: 'Auto', note: 'Original' },
]

export function RatioPicker({
  value,
  onChange,
  asset,
}: {
  value: RatioKey
  onChange: (value: RatioKey) => void
  asset: MediaAsset | null
}) {
  return (
    <div className="ratio-grid">
      {RATIOS.map((ratio) => {
        const ratioCss =
          ratio.key === 'original'
            ? asset
              ? `${asset.width} / ${asset.height}`
              : '16 / 9'
            : RATIO_VALUES[ratio.key as Exclude<RatioKey, 'original'>]
        return (
          <button
            type="button"
            key={ratio.key}
            className={`ratio-card ${value === ratio.key ? 'is-active' : ''}`}
            onClick={() => onChange(ratio.key)}
            disabled={ratio.key === 'original' && !asset}
            title={ratio.note}
          >
            <span className="ratio-shape" style={{ aspectRatio: ratioCss }} />
            <span className="ratio-copy">
              <strong>{ratio.label}</strong>
              <small>{ratio.note}</small>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export const GREEN_SWATCHES = [
  { color: '#00B140', label: 'Chroma' },
  { color: '#00FF00', label: 'Pure' },
  { color: '#3DF5A2', label: 'Mint' },
  { color: '#0B0F0C', label: 'Ink' },
  { color: '#FFFFFF', label: 'White' },
  { color: '#FF5C8A', label: 'Pink' },
]

export function BackdropPicker({
  background,
  onChange,
  compact = false,
}: {
  background: Background
  onChange: (background: Background) => void
  compact?: boolean
}) {
  const activeColor = background.mode === 'color' ? background.color : '#00B140'

  return (
    <div className={`backdrop-picker ${compact ? 'is-compact' : ''}`}>
      <div className="backdrop-mode-row">
        <button
          type="button"
          className={`backdrop-mode ${background.mode === 'transparent' ? 'is-active' : ''}`}
          onClick={() => onChange({ mode: 'transparent' })}
        >
          <span className="checker-swatch" />
          <span>
            <strong>Transparent</strong>
            <small>Checkerboard</small>
          </span>
          {background.mode === 'transparent' ? <Check size={14} /> : null}
        </button>
        <button
          type="button"
          className={`backdrop-mode ${background.mode === 'color' && activeColor.toLowerCase() === '#00b140' ? 'is-active' : ''}`}
          onClick={() => onChange({ mode: 'color', color: '#00B140' })}
        >
          <span className="green-swatch" />
          <span>
            <strong>Green screen</strong>
            <small>#00B140</small>
          </span>
          {background.mode === 'color' &&
          activeColor.toLowerCase() === '#00b140' ? (
            <Check size={14} />
          ) : null}
        </button>
      </div>

      <div className="swatch-head">
        <span>Color</span>
        <span className="swatch-value">{activeColor.toUpperCase()}</span>
      </div>
      <div className="swatch-row">
        {GREEN_SWATCHES.map((swatch) => {
          const selected =
            background.mode === 'color' &&
            background.color.toLowerCase() === swatch.color.toLowerCase()
          return (
            <button
              type="button"
              key={swatch.color}
              className={`swatch ${selected ? 'is-active' : ''}`}
              style={{ '--swatch': swatch.color } as CSSProperties}
              onClick={() =>
                onChange({ mode: 'color', color: swatch.color })
              }
              aria-label={`Use ${swatch.label} background`}
              title={swatch.label}
            >
              {selected ? <Check size={13} /> : null}
            </button>
          )
        })}
        <label
          className="swatch custom-swatch"
          title="Choose a custom color"
          style={
            {
              '--swatch':
                background.mode === 'color' ? background.color : '#00B140',
            } as CSSProperties
          }
        >
          <Sparkles size={13} />
          <input
            type="color"
            value={background.mode === 'color' ? background.color : '#00B140'}
            onChange={(event) =>
              onChange({ mode: 'color', color: event.target.value })
            }
            aria-label="Pick a custom backdrop color"
          />
        </label>
      </div>
    </div>
  )
}

export function AudioPlayer({
  src,
  waveform,
  duration,
  onDownload,
  compact = false,
}: {
  src: string
  waveform: number[]
  duration: number
  onDownload?: () => void
  compact?: boolean
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    setPlaying(false)
    setProgress(0)
    setCurrentTime(0)
  }, [src])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      await audio.play()
      setPlaying(true)
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  const seek = (fraction: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = fraction * audio.duration
    setProgress(fraction)
    setCurrentTime(audio.currentTime)
  }

  return (
    <div className={`audio-player ${compact ? 'is-compact' : ''}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={(event) => {
          const audio = event.currentTarget
          setCurrentTime(audio.currentTime)
          setProgress(
            Number.isFinite(audio.duration) && audio.duration > 0
              ? audio.currentTime / audio.duration
              : 0,
          )
        }}
        onEnded={() => {
          setPlaying(false)
          setProgress(0)
          setCurrentTime(0)
        }}
      />
      <button
        type="button"
        className="audio-play"
        onClick={toggle}
        aria-label={playing ? 'Pause audio' : 'Play audio'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div
        className="waveform"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          seek(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)))
        }}
        role="slider"
        tabIndex={0}
        aria-label="Audio position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') seek(Math.min(1, progress + 0.05))
          if (event.key === 'ArrowLeft') seek(Math.max(0, progress - 0.05))
        }}
      >
        {waveform.map((peak, index) => (
          <span
            key={`${index}-${peak.toFixed(3)}`}
            className={index / waveform.length <= progress ? 'is-played' : ''}
            style={{ height: `${Math.max(12, Math.round(peak * 100))}%` }}
          />
        ))}
      </div>
      <div className="audio-time">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration || 0)}</span>
      </div>
      {onDownload ? (
        <button
          type="button"
          className="icon-button small"
          onClick={onDownload}
          aria-label="Download WAV"
          title="Download WAV"
        >
          <Download size={14} />
        </button>
      ) : null}
    </div>
  )
}

export function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <div className="privacy-note">
      <ShieldCheck size={14} />
      <span>{children}</span>
    </div>
  )
}

export function WaveBars({ active = false }: { active?: boolean }) {
  return (
    <span className={`mini-wave ${active ? 'is-active' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}
