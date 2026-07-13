import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb({ message = 'kaboom' }: { message?: string }): never {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors to console.error; silence the expected noise.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renders children when nothing throws', () => {
    render(<ErrorBoundary><div>safe content</div></ErrorBoundary>)
    expect(screen.getByText('safe content')).toBeInTheDocument()
  })

  it('renders the inline fallback with the section title and error message', () => {
    render(<ErrorBoundary variant="inline" title="the analysis panel"><Bomb message="boom-inline" /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('The analysis panel hit an error')).toBeInTheDocument()
    expect(screen.getByText('boom-inline')).toBeInTheDocument()
  })

  it('renders the page fallback with recovery controls', () => {
    render(<ErrorBoundary variant="page"><Bomb /></ErrorBoundary>)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload app/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset saved data/i })).toBeInTheDocument()
  })

  it('calls onError with the thrown error', () => {
    const onError = vi.fn()
    render(<ErrorBoundary onError={onError}><Bomb message="reported" /></ErrorBoundary>)
    expect(onError).toHaveBeenCalledTimes(1)
    const [error] = onError.mock.calls[0]
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('reported')
  })

  it('recovers when "Try again" is clicked after the throwing condition clears', () => {
    let shouldThrow = true
    function MaybeBomb() {
      if (shouldThrow) throw new Error('transient')
      return <div>recovered content</div>
    }
    render(<ErrorBoundary variant="inline"><MaybeBomb /></ErrorBoundary>)
    expect(screen.getByText('transient')).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByText('recovered content')).toBeInTheDocument()
  })

  it('auto-resets when resetKeys change', () => {
    function Harness() {
      const [broken, setBroken] = useState(true)
      return (
        <>
          <button onClick={() => setBroken(false)}>fix upstream</button>
          <ErrorBoundary variant="inline" resetKeys={[broken]}>
            {broken ? <Bomb message="keyed" /> : <div>keyed recovery</div>}
          </ErrorBoundary>
        </>
      )
    }
    render(<Harness />)
    expect(screen.getByText('keyed')).toBeInTheDocument()

    fireEvent.click(screen.getByText('fix upstream'))
    expect(screen.getByText('keyed recovery')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('prefers a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={({ error }) => <div>custom: {error.message}</div>}>
        <Bomb message="via-render-prop" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('custom: via-render-prop')).toBeInTheDocument()
  })
})
