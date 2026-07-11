import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NationalContextPanel } from './NationalContextPanel'

describe('NationalContextPanel', () => {
  it('renders mapped, absent, and reference-only findings with official links', () => {
    render(<NationalContextPanel findings={[
      { id: 'drinking-water', label: 'Public drinking water', status: 'mapped', summary: 'City Water · sourced boundary', detail: 'Capacity unverified.', actionUrl: 'https://epa.gov' },
      { id: 'protected-lands', label: 'Protected lands and interests', status: 'not-mapped', summary: 'No PAD-US interest.', detail: 'Agency records still control.' },
      { id: 'broadband', label: 'Broadband availability', status: 'reference-only', summary: 'FCC lookup available.', detail: 'Fabric not redistributed.', actionUrl: 'https://broadbandmap.fcc.gov/home' },
    ]} />)
    expect(screen.getByText('City Water · sourced boundary')).toBeInTheDocument()
    expect(screen.getByText('No PAD-US interest.')).toBeInTheDocument()
    expect(screen.getByText('FCC lookup available.')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /open official source/i })).toHaveLength(2)
  })
})
