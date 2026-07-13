import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { clearSavedSites } from '../lib/storage'

interface ErrorBoundaryProps {
  children: ReactNode
  /** 'page' = full-screen catastrophic fallback; 'inline' = a card that keeps the surrounding shell usable. */
  variant?: 'page' | 'inline'
  /** Noun phrase naming what failed, e.g. "the analysis panel". Used by the inline fallback. */
  title?: string
  /** Custom fallback renderer; overrides the built-in variants. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode
  /** When any element changes (shallow), a boundary that is currently showing an error auto-resets. */
  resetKeys?: unknown[]
  onError?: (error: Error, info: ErrorInfo) => void
  onReset?: () => void
}

interface ErrorBoundaryState {
  error: Error | null
}

function resetKeysChanged(prev: unknown[] = [], next: unknown[] = []): boolean {
  return prev.length !== next.length || prev.some((value, index) => !Object.is(value, next[index]))
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Catches render/lifecycle errors in its subtree so one failure can't
 * white-screen the whole app. Placed once at the root (page variant) and
 * around each independently-recoverable region (inline variant): the map, the
 * analysis panel, the report, and the portfolio. `resetKeys` let a boundary
 * recover automatically when the user navigates or selects a new site.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info)
    // Surface for debugging; a production deployment would forward this to a logger.
    console.error('[LandLens] Uncaught render error:', error, info.componentStack)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.reset()
    }
  }

  reset = () => {
    this.props.onReset?.()
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback({ error, reset: this.reset })
    return this.props.variant === 'page'
      ? <PageFallback error={error} onReset={this.reset} />
      : <InlineFallback error={error} title={this.props.title} onReset={this.reset} />
  }
}

function PageFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const resetData = () => {
    if (!window.confirm('Clear all saved sites from this browser and reload? This cannot be undone.')) return
    try { clearSavedSites() } catch { /* ignore — reload anyway */ }
    window.location.reload()
  }
  return (
    <div className="error-page" role="alert">
      <div className="error-page-card">
        <span className="error-badge"><AlertTriangle size={24} /></span>
        <span className="eyebrow">Unexpected error</span>
        <h1>Something went wrong</h1>
        <p>LandLens hit an error it couldn’t recover from on its own. Your saved sites are stored locally and were not affected.</p>
        {import.meta.env.DEV
          ? <pre className="error-detail">{error.message}{error.stack ? `\n\n${error.stack}` : ''}</pre>
          : error.message ? <p className="error-message">{error.message}</p> : null}
        <div className="error-actions">
          <button className="primary-button" onClick={onReset}><RotateCcw size={16} /> Try again</button>
          <button className="secondary-button" onClick={() => window.location.reload()}><RefreshCw size={16} /> Reload app</button>
        </div>
        <button className="error-escape" onClick={resetData}>Still broken after reload? Reset saved data</button>
      </div>
    </div>
  )
}

function InlineFallback({ error, title, onReset }: { error: Error; title?: string; onReset: () => void }) {
  return (
    <div className="error-inline" role="alert">
      <AlertTriangle size={18} />
      <div>
        <strong>{title ? `${capitalize(title)} hit an error` : 'This section hit an error'}</strong>
        <p>{error.message || 'An unexpected error occurred while rendering this section.'}</p>
        <button className="text-button" onClick={onReset}><RotateCcw size={14} /> Try again</button>
      </div>
    </div>
  )
}
