import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CoveragePanel } from './CoveragePanel'

describe('CoveragePanel', () => {
  it('renders national totals and point-level coverage without overstating local depth', () => {
    render(<CoveragePanel coverage={{
      national: { stateCount: 50, adapterCount: 58, enrichedAdapterCount: 57, auditedGeometryOnlyCount: 1 },
      current: { stateCode: 'CA', parcelStatus: 'partial-state-gap', parcelSources: [], richFacts: false, jurisdictionPacks: [] },
    }} />)
    expect(screen.getByText('50/50 states')).toBeInTheDocument()
    expect(screen.getByText('This state has partial coverage, but no adapter covers this point')).toBeInTheDocument()
    expect(screen.getByText('58 verified adapters · 57 enriched · 1 audited geometry-only.')).toBeInTheDocument()
    expect(screen.getByText(/no local entitlement pack covers this point yet/i)).toBeInTheDocument()
  })

  it('names the actual point source and local entitlement pack when present', () => {
    render(<CoveragePanel coverage={{
      national: { stateCount: 50, adapterCount: 58, enrichedAdapterCount: 57, auditedGeometryOnlyCount: 1 },
      current: { stateCode: 'TX', parcelStatus: 'verified-here', parcelSources: ['County parcel service'], richFacts: true, jurisdictionPacks: ['City pack'] },
    }} />)
    expect(screen.getByText('Verified public parcel source covers this point')).toBeInTheDocument()
    expect(screen.getByText('Normalized public facts available')).toBeInTheDocument()
    expect(screen.getByText('Parcel source: County parcel service')).toBeInTheDocument()
    expect(screen.getByText('Local entitlement intelligence: City pack')).toBeInTheDocument()
  })
})
