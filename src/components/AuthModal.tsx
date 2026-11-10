import { useState } from 'react'
import { X } from 'lucide-react'
import { signIn, signUp, type User } from '../lib/auth'

export function AuthModal({
  mode: initialMode,
  onClose,
  onAuthed,
}: {
  mode: 'signin' | 'signup'
  onClose: () => void
  onAuthed: (user: User) => void
}) {
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const user =
        mode === 'signup'
          ? signUp(name, email, password)
          : signIn(email, password)
      onAuthed(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-button auth-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <h2>{mode === 'signup' ? 'Create your account' : 'Sign in'}</h2>
        <p className="auth-sub">
          {mode === 'signup'
            ? 'Save projects, favorites, and history on this device.'
            : 'Welcome back. Your projects are stored on this device.'}
        </p>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' ? (
            <label>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          ) : null}
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </label>
          {error ? <div className="auth-error">{error}</div> : null}
          <button type="submit" className="export-button auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => { setMode('signin'); setError(null) }}>
                Sign in
              </button>
            </>
          ) : (
            <>
              New here?{' '}
              <button type="button" onClick={() => { setMode('signup'); setError(null) }}>
                Create an account
              </button>
            </>
          )}
        </div>
        <p className="auth-note">Accounts are stored locally in your browser for this device.</p>
      </div>
    </div>
  )
}
