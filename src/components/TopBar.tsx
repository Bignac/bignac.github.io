import {
  Download,
  House,
  LayoutPanelLeft,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import type { MediaAsset } from '../types'

export function TopBar({
  projectName,
  onProjectName,
  activeAsset,
  onHome,
  onExport,
  onToggleLibrary,
  onToggleInspector,
  libraryOpen,
  inspectorOpen,
}: {
  projectName: string
  onProjectName: (name: string) => void
  activeAsset: MediaAsset | null
  onHome: () => void
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
          className="icon-button"
          onClick={onHome}
          aria-label="Back to home"
          title="Back to home"
        >
          <House size={17} />
        </button>
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
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
          </div>
          <div className="brand-type">
            <span className="brand-name">BIGNAC</span>
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
