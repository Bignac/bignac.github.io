import { useState } from 'react'
import { ArrowUpRight, ChevronDown, Menu } from 'lucide-react'

export function Landing({ onOpenProjects }: { onOpenProjects: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="landing">
      <img className="landing-bg" src={`${import.meta.env.BASE_URL}goat.png`} alt="" />
      <div className="landing-scrim" />

      <header className="landing-nav">
        <div className="landing-brand">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={26} height={26} />
          <span>BIGNAC</span>
        </div>

        <button
          type="button"
          className="landing-menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="Menu"
        >
          <Menu size={18} />
          <ChevronDown size={14} />
        </button>

        {menuOpen ? (
          <nav className="landing-menu">
            <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
            <button type="button" onClick={() => { setMenuOpen(false); onOpenProjects() }}>
              Projects
            </button>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
            <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
            <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
            <div className="landing-menu-split" />
            <button type="button" className="landing-menu-signin">
              Sign in
            </button>
          </nav>
        ) : null}

        <div className="landing-nav-links">
          <a href="#faq">FAQ</a>
          <a href="#contact">Contact</a>
          <button type="button" className="landing-signin">Sign in</button>
        </div>
      </header>

      <main className="landing-hero" id="home">
        <p className="landing-eyebrow">Background remover for photo &amp; video</p>
        <h1>
          Cut it out.
          <br />
          Keep it sharp.
        </h1>
        <p className="landing-copy">
          Drop a clip, lose the background, land it on chroma green. Everything
          renders on your device — nothing is uploaded.
        </p>
        <div className="landing-actions">
          <button type="button" className="landing-cta" onClick={onOpenProjects}>
            Open projects
            <ArrowUpRight size={17} />
          </button>
          <a className="landing-ghost" href="#faq">
            How it works
          </a>
        </div>
      </main>

      <section className="landing-faq" id="faq">
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

      <section className="landing-contact" id="contact">
        <h2>Contact</h2>
        <p>
          Questions or bugs?{' '}
          <a href="https://github.com/Bignac/bignac.github.io/issues" target="_blank" rel="noreferrer">
            Open an issue
          </a>
        </p>
      </section>

      <footer className="landing-foot" id="about">
        <span>Bignac Studio</span>
        <span>Built in the browser</span>
      </footer>
    </div>
  )
}
