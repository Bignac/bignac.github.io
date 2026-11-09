import {
  Download,
  LayoutPanelLeft,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import type { MediaAsset } from '../types'

export function TopBar({
  projectName,
  onProjectName,
  activeAsset,
  onExport,
  onToggleLibrary,
  onToggleInspector,
  libraryOpen,
  inspectorOpen,
}: {
  projectName: string
  onProjectName: (name: string) => void
  activeAsset: MediaAsset | null
  onExport: () => void
  onToggleLibrary: () => void
  onToggleInspector: () => void
  libraryOpen: boolean
  inspectorOpen: boolean
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className={`icon-button panel-toggle ${libraryOpen ? 'is-active' : ''}`}
          onClick={onToggleLibrary}
          aria-label="Toggle media panel"
          title="Toggle media panel"
        >
          <LayoutPanelLeft size={17} />
        </button>
        <div className="brand">
          <div className="logo-mark" aria-hidden="true">
            <span>C</span>
            <i />
          </div>
          <div className="brand-type">
            <span className="brand-name">chroma</span>
            <span className="brand-sub">STUDIO</span>
          </div>
        </div>
        <div className="topbar-divider" />
        <div className="project-block">
          <input
            className="project-name"
            value={projectName}
            onChange={(event) => onProjectName(event.target.value)}
            aria-label="Project name"
            spellCheck={false}
          />
          <span className="project-status">
            <i />
            Saved on this device
          </span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="privacy-pill">
          <ShieldCheck size={14} />
          <span>Private by design</span>
          <b>100% on-device</b>
        </div>
      </div>

      <div className="topbar-right">
        {activeAsset ? (
          <span className="file-pill">
            <i className={activeAsset.kind === 'video' ? 'is-video' : ''} />
            {activeAsset.kind === 'video' ? 'Video' : 'Image'}
          </span>
        ) : null}
        <button
          type="button"
          className={`icon-button settings-toggle ${inspectorOpen ? 'is-active' : ''}`}
          onClick={onToggleInspector}
          aria-label="Toggle design settings"
          title="Toggle design settings"
        >
          <Settings2 size={17} />
        </button>
        <button type="button" className="export-button" onClick={onExport}>
          <Download size={16} />
          <span>Export</span>
        </button>
      </div>
    </header>
  )
}
