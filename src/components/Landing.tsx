import { useState } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'

const SECTIONS = [
  { href: '#top', label: 'Top' },
  { href: '#projects', label: 'Projects' },
  { href: '#features', label: 'What it does' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contact', label: 'Contact' },
]

export function Landing({ onOpenProjects }: { onOpenProjects: () => void }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="landing" id="top">
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

        <a className="landing-signup" href="#contact">Sign up</a>
      </header>

      {drawerOpen ? (
        <nav className="landing-drawer">
          {SECTIONS.map((section) => (
            <a key={section.href} href={section.href} onClick={() => setDrawerOpen(false)}>
              {section.label}
            </a>
          ))}
        </nav>
      ) : null}

      <main className="landing-hero">
        <p className="landing-eyebrow">Background remover — photo &amp; video</p>
        <h1>
          Cut it out.
          <br />
          No clutter.
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
        <h2>What it does</h2>
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
      </footer>
    </div>
  )
}
