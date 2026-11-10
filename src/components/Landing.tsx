import { useEffect, useState } from 'react'
import { ArrowUpRight, LogOut, Menu, UserCircle, X } from 'lucide-react'
import type { User } from '../lib/auth'

const SECTIONS = [
  { href: '#top', label: 'Top' },
  { href: '#projects', label: 'Projects' },
  { href: '#features', label: 'What it does' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contact', label: 'Contact' },
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [scrollNudge, setScrollNudge] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const h = window.innerHeight
      const max = document.documentElement.scrollHeight - h
      setScrolled(y > 40)
      setScrollNudge(max > 0 && y / max > 0.72)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={`landing${scrolled ? ' landing-scrolled' : ''}`} id="top">
      <img className="landing-bg" src={`${import.meta.env.BASE_URL}goat.png`} alt="" />
      <div className="landing-scrim" />

      <header className="landing-nav">
        <div className="landing-left">
          <button
            type="button"
            className="landing-drawer-toggle"
            onClick={() => setDrawerOpen((open) => !open)}
            aria-expanded={drawerOpen}
            aria-label="Open menu"
          >
            {drawerOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <a className="landing-brand" href="#top">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={24} height={24} />
            <span>BIGNAC</span>
          </a>
        </div>

        <div className="landing-auth">
          {user ? (
            <div className="landing-user">
              <button type="button" className="landing-user-btn" onClick={() => setMenuOpen((o) => !o)}>
                <UserCircle size={16} />
                <span>{user.name || user.email}</span>
              </button>
              {menuOpen ? (
                <div className="landing-user-menu">
                  <button type="button" onClick={() => { setMenuOpen(false); onOpenProjects() }}>My projects</button>
                  <button type="button" onClick={() => { setMenuOpen(false); onSignOut() }}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <button type="button" className="landing-signin" onClick={onSignIn}>Sign in</button>
              <button type="button" className="landing-signup-btn" onClick={onSignUp}>Get started</button>
            </>
          )}
        </div>
      </header>

      {drawerOpen ? (
        <nav className="landing-drawer">
          {SECTIONS.map((section) => (
            <a key={section.href} href={section.href} onClick={() => setDrawerOpen(false)}>
              {section.label}
            </a>
          ))}
          <a href="#top" onClick={(e) => { e.preventDefault(); setDrawerOpen(false); onOpenProjects() }}>
            Open projects
          </a>
        </nav>
      ) : null}

      <main className="landing-hero">
        <p className="landing-eyebrow">Background remover — photo &amp; video</p>
        <h1>{pick.title}</h1>
        <p className="landing-copy">{pick.desc}</p>
        <div className="landing-actions">
          <button type="button" className="landing-cta" onClick={onOpenProjects}>
            New project
            <ArrowUpRight size={16} />
          </button>
          <a className="landing-ghost" href="#features">See what it does</a>
        </div>
      </main>

      <section className="landing-block" id="projects">
        <h2>Projects</h2>
        <p className="landing-section-copy">
          Start from scratch or pick up where you left off. Signed-in users can save projects, view history, and mark favorites.
        </p>
        <div className="landing-cards">
          <article className="landing-card">
            <h3>Image cutout</h3>
            <p>Full-resolution PNG with alpha, hair and edges intact.</p>
            <button type="button" onClick={onOpenProjects}>Open projects</button>
          </article>
          <article className="landing-card">
            <h3>Video cutout</h3>
            <p>Live per-frame matte with stable edges and clean compositing.</p>
            <button type="button" onClick={onOpenProjects}>Open projects</button>
          </article>
          <article className="landing-card">
            <h3>Green screen</h3>
            <p>Solid chroma backdrops, color-accurate, ready for any editor.</p>
            <button type="button" onClick={onOpenProjects}>Open projects</button>
          </article>
        </div>
      </section>

      <section className="landing-block" id="features">
        <h2>What it does</h2>
        <p className="landing-section-copy">
          BIGNAC is a browser-based studio for fast, private background removal and compositing.
          Cut subjects out of photos and videos, drop them onto clean chroma or custom backdrops,
          and export ready-to-use results — all without uploading your files.
        </p>
        <ul className="landing-features">
          <li><strong>Photo &amp; video cutouts:</strong> Remove backgrounds from images and run live, per-frame cutouts on video with edges that hold between frames.</li>
          <li><strong>Hair &amp; edge detail:</strong> Subject matting with edge-aware refinement to reduce halos and color bleed for cleaner results.</li>
          <li><strong>Green screen &amp; backdrops:</strong> Replace backgrounds with chroma green or custom colors, with adjustable fit, ratio, and canvas settings.</li>
          <li><strong>Audio extraction:</strong> Pull soundtracks from your videos and export them as WAV files straight from the timeline.</li>
          <li><strong>Projects for accounts:</strong> Sign in to save projects on this device, revisit history, and favorite the work you want to keep close.</li>
          <li><strong>Private by design:</strong> Processing happens on your device in the browser — your media stays with you.</li>
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
          <summary>Do I need an account?</summary>
          <p>No. You can start a project without one. Accounts (stored locally on this device) let you keep project history and favorites.</p>
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
        {!user ? (
          <button type="button" className="landing-cta landing-signup-inline" onClick={onSignUp}>
            Create an account
          </button>
        ) : (
          <button type="button" className="landing-cta landing-signup-inline" onClick={onOpenProjects}>
            Go to my projects
          </button>
        )}
      </section>

      <footer className="landing-foot">
        <span>Bignac Studio</span>
        <span>Raul is a catboy or a femboy — 50/50.</span>
        <span>Built in the browser</span>
        <a className="landing-foot-link" href="https://bignac.github.io/">bignac.github.io</a>
      </footer>
      <button className={scrollNudge ? 'scroll-nudge visible' : 'scroll-nudge'} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        Scroll back up
      </button>
    </div>
  )
}
