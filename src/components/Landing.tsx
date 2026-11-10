import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, LogOut, UserCircle } from 'lucide-react'
import type { User } from '../lib/auth'

const SECTIONS = [
  { id: 'top', label: 'Top' },
  { id: 'projects', label: 'Projects' },
  { id: 'features', label: 'Features' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Contact' },
]

export function Landing({
  user,
  onOpenProjects,
  onSignIn,
  onSignUp,
  onSignOut,
}: {
  user: User | null
  onOpenProjects: () => void
  onSignIn: () => void
  onSignUp: () => void
  onSignOut: () => void
}) {
  const [activeSection, setActiveSection] = useState('top')
  const [pick] = useState(() => {
    const options = [
      {
        title: 'raul is a femboy',
        desc: 'fem·boy /ˈfemˌbɔɪ/ noun: A person, typically male, who embraces traditionally feminine appearance, mannerisms, or clothing—often in a playful, soft, or androgynous way—common in internet and queer culture.',
      },
      {
        title: 'raul is a catboy',
        desc: 'cat·boy /ˈkatˌbɔɪ/ noun: A (usually male) character who displays feline traits—such as cat ears, a tail, and playful, aloof, or affectionate behavior—commonly featured in anime, manga, and internet culture.',
      },
    ]
    return options[Math.floor(Math.random() * options.length)]
  })

  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.boundingClientRect.y - a.boundingClientRect.y)[0]
        if (visible) setActiveSection(visible.target.id)
      },
      { root: null, rootMargin: '-20% 0% -60% 0%', threshold: 0 },
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    observerRef.current = observer
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const authButtons = user ? (
    <div className="landing-user">
      <button
        type="button"
        className="landing-user-btn"
        onClick={() => onOpenProjects()}
        aria-label="My projects"
      >
        <UserCircle size={16} />
        <span>{user.name || user.email}</span>
      </button>
      <button
        type="button"
        className="landing-signout"
        onClick={onSignOut}
        aria-label="Sign out"
      >
        <LogOut size={14} /> Sign out
      </button>
    </div>
  ) : (
    <>
      <button type="button" className="landing-signin" onClick={onSignIn}>
        Sign in
      </button>
      <button type="button" className="landing-signup-btn" onClick={onSignUp}>
        Get started
      </button>
    </>
  )

  return (
    <div className="landing" id="top">
      <img className="landing-bg" src={`${import.meta.env.BASE_URL}goat.png`} alt="" />
      <div className="landing-scrim" />

      {/* ---------- slim left sidebar ---------- */}
      <nav className="landing-sidebar">
        <div className="sidebar-brand">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={20} height={20} />
          <span>BIGNAC</span>
        </div>
        <div className="sidebar-nav">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`sidebar-item ${activeSection === section.id ? 'is-active' : ''}`}
              onClick={() => {
                if (section.id === 'projects') onOpenProjects()
                else scrollTo(section.id)
              }}
              aria-label={section.label}
            >
              <span className="sidebar-dot" />
              <span className="sidebar-label">{section.label}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-foot">
          <span className="sidebar-version">v1.3.1</span>
        </div>
      </nav>

      <header className="landing-nav">
        <div className="landing-left">
          <a className="landing-brand" href="#top">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={22} height={22} />
            <span>BIGNAC</span>
          </a>
        </div>

        <div className="landing-auth">{authButtons}</div>
      </header>

      <main className="landing-hero">
        <p className="landing-eyebrow">Background remover — photo &amp; video</p>
        <h1>
          {pick.title}.
          <br />
          Cut it out.
        </h1>
        <p className="landing-copy">
          Clean subjects from photos and video, straight in the browser.
          Nothing is uploaded, nothing is stored.
        </p>
        <div className="landing-actions">
          <button type="button" className="landing-cta" onClick={onOpenProjects}>
            Start a project
            <ArrowUpRight size={16} />
          </button>
          <a className="landing-ghost" href="#features">See what it does</a>
        </div>
      </main>

      <section className="landing-block" id="projects">
        <h2>Projects</h2>
        <div className="landing-cards">
          <article className="landing-card">
            <h3>Image cutout</h3>
            <p>Full-resolution PNG with alpha, hair and edges intact.</p>
            <button type="button" onClick={onOpenProjects}>Open</button>
          </article>
          <article className="landing-card">
            <h3>Video cutout</h3>
            <p>Live per-frame matte with stable edges and clean compositing.</p>
            <button type="button" onClick={onOpenProjects}>Open</button>
          </article>
          <article className="landing-card">
            <h3>Green screen</h3>
            <p>Solid chroma backdrops, color-accurate, ready for any editor.</p>
            <button type="button" onClick={onOpenProjects}>Open</button>
          </article>
        </div>
      </section>

      <section className="landing-block" id="features">
        <h2>Features</h2>
        <ul className="landing-features">
          <li>Subject matting with hair-level detail</li>
          <li>Edge-aware matte refinement, no color bleed</li>
          <li>Video cutout that holds between frames</li>
          <li>WAV export straight from the timeline</li>
          <li>Everything runs on the device — private by default</li>
        </ul>
      </section>

      <section className="landing-block" id="faq">
        <h2>FAQ</h2>
        <details>
          <summary>Does my media get uploaded?</summary>
          <p>No. Models run in the browser and files never leave the device.</p>
        </details>
        <details>
          <summary>What formats work?</summary>
          <p>PNG, JPG, WEBP for images; MP4, MOV, WEBM for video.</p>
        </details>
        <details>
          <summary>Is there a cost?</summary>
          <p>No — it is free and open source.</p>
        </details>
      </section>

      <section className="landing-block" id="contact">
        <h2>Contact</h2>
        <p>
          Questions or bugs?{' '}
          <a href="https://github.com/Bignac/bignac.github.io/issues" target="_blank" rel="noreferrer">
            Open an issue
          </a>{' '}
          or email hello@bignac.dev.
        </p>
        <button type="button" className="landing-cta landing-signup-inline" onClick={onOpenProjects}>
          Create an account
        </button>
      </section>

      <footer className="landing-foot">
        <span>Bignac Studio</span>
        <span>Raul is a catboy or a femboy — 50/50.</span>
        <span>Built in the browser</span>
        <a className="landing-foot-link" href="https://bignac.github.io/">bignac.github.io</a>
      </footer>
      <button className="scroll-nudge" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        Scroll back up
      </button>
    </div>
  )
}
