import {
  Download,
  FolderOpen,
  House,
  LayoutPanelLeft,
  Settings2,
  ShieldCheck,
  UserCircle,
} from 'lucide-react'
import type { MediaAsset } from '../types'
import type { User } from '../lib/auth'

export function TopBar({
  projectName,
  onProjectName,
  activeAsset,
  onHome,
  onProjects,
  onExport,
  onToggleLibrary,
  onToggleInspector,
  libraryOpen,
  inspectorOpen,
  user,
  onSignIn,
}: {
  projectName: string
  onProjectName: (name: string) => void
  activeAsset: MediaAsset | null
  onHome: () => void
  onProjects: () => void
  onExport: () => void
  onToggleLibrary: () => void
  onToggleInspector: () => void
  libraryOpen: boolean
  inspectorOpen: boolean
  user: User | null
  onSignIn: () => void
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-button"
          onClick={onHome}
          aria-label="Back to home"
          title="Home"
        >
          <House size={17} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onProjects}
          aria-label="Projects"
          title="Projects"
        >
          <FolderOpen size={17} />
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
            {user ? 'Saved on this device' : 'Not saved to account'}
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
        {user ? (
          <button type="button" className="file-pill user-pill" onClick={onProjects} title="My projects">
            <UserCircle size={14} /> {user.name || 'Account'}
          </button>
        ) : (
          <button type="button" className="secondary-action" onClick={onSignIn}>Sign in</button>
        )}
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
