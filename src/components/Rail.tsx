import {
  Download,
  Images,
  Music2,
  PaintBucket,
  WandSparkles,
} from 'lucide-react'
import type { ToolKey } from '../types'

const TOOLS: Array<{
  key: ToolKey
  label: string
  icon: typeof Images
}> = [
  { key: 'media', label: 'Media', icon: Images },
  { key: 'cutout', label: 'Cutout', icon: WandSparkles },
  { key: 'backdrop', label: 'Backdrop', icon: PaintBucket },
  { key: 'audio', label: 'Audio', icon: Music2 },
  { key: 'export', label: 'Export', icon: Download },
]

export function Rail({
  activeTool,
  onTool,
  audioCount,
}: {
  activeTool: ToolKey
  onTool: (tool: ToolKey) => void
  audioCount: number
}) {
  return (
    <nav className="rail" aria-label="Studio tools">
      <div className="rail-tools">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <button
              type="button"
              key={tool.key}
              className={`rail-button ${activeTool === tool.key ? 'is-active' : ''}`}
              onClick={() => onTool(tool.key)}
              aria-label={tool.label}
              aria-current={activeTool === tool.key ? 'page' : undefined}
            >
              <span className="rail-icon">
                <Icon size={19} strokeWidth={1.9} />
                {tool.key === 'audio' && audioCount > 0 ? (
                  <i className="rail-badge">{audioCount}</i>
                ) : null}
              </span>
              <span>{tool.label}</span>
            </button>
          )
        })}
      </div>
      <div className="rail-foot">
        <span className="rail-dot" title="Processing runs locally" />
        <span>v1.0</span>
      </div>
    </nav>
  )
}
