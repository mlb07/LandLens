import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildAustinJurisdictionProfile } from '../data/austinJurisdiction'
import { JurisdictionPanel } from './JurisdictionPanel'
import { registerDefaultJurisdictionPacks } from '../data/jurisdictions/defaultPacks'

registerDefaultJurisdictionPacks()

describe('JurisdictionPanel', () => {
  it('renders authority, use screen, overlays, future land use, and standards', () => {
    const profile = buildAustinJurisdictionProfile({
      zoningCode: 'SF-3-NP', baseDistrict: 'SF-3', jurisdictionCode: 'FULL', jurisdictionLabel: 'FULL PURPOSE',
      futureLandUse: 'Single Family',
      overlays: [{ name: 'Residential Design Standards', detail: 'Subchapter F', layerId: 22 }],
    })
    render(<JurisdictionPanel profile={profile} intendedUse="residential" />)
    expect(screen.getByText('Local development profile')).toBeInTheDocument()
    expect(screen.getByText('SF-3-NP · base SF-3')).toBeInTheDocument()
    expect(screen.getByText('Likely district-family match')).toBeInTheDocument()
    expect(screen.getByText('Single Family')).toBeInTheDocument()
    expect(screen.getByText('Residential Design Standards')).toBeInTheDocument()
    expect(screen.getByText('25 / 5 / 10 ft')).toBeInTheDocument()
  })

  it('renders an exact §25-2-491 proposed-use result', () => {
    const profile = buildAustinJurisdictionProfile({ zoningCode: 'SF-3-NP', baseDistrict: 'SF', jurisdictionCode: 'FULL' })
    render(<JurisdictionPanel profile={profile} intendedUse="residential" proposedUse="single_family" />)
    expect(screen.getByText('Single-Family Residential')).toBeInTheDocument()
    expect(screen.getByText('Permitted in base table')).toBeInTheDocument()
    expect(screen.getByText('Austin LDC §25-2-491 base-use result')).toBeInTheDocument()
    expect(screen.getByText('Table cell: P')).toBeInTheDocument()
  })

  it('renders nationwide Census authority context without implying zoning authority', () => {
    render(<JurisdictionPanel intendedUse="industrial" authority={{
      authorityName: 'Example city', authorityType: 'incorporated-place', incorporatedPlace: 'Example city', countyName: 'Example County',
      stateCode: 'CO', sourceVintage: 'Current', coverageNote: 'Routing baseline; does not establish zoning authority.', resolvedAt: '2026-07-10T00:00:00Z',
    }} />)
    expect(screen.getByText('National authority context')).toBeInTheDocument()
    expect(screen.getByText('Example city')).toBeInTheDocument()
    expect(screen.getByText('Example County')).toBeInTheDocument()
    expect(screen.queryByText('Mapped zoning')).not.toBeInTheDocument()
  })
})
