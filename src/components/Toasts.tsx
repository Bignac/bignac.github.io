import { AlertCircle, CheckCircle2, Sparkles, X } from 'lucide-react'
import type { ToastItem } from '../types'

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone ?? 'default'}`}>
          <span className="toast-icon">
            {toast.tone === 'error' ? (
              <AlertCircle size={17} />
            ) : toast.tone === 'success' ? (
              <CheckCircle2 size={17} />
            ) : (
              <Sparkles size={17} />
            )}
          </span>
          <div className="toast-copy">
            <strong>{toast.title}</strong>
            {toast.message ? <span>{toast.message}</span> : null}
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
