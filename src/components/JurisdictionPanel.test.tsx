import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildAustinJurisdictionProfile } from '../data/austinJurisdiction'
import { JurisdictionPanel } from './JurisdictionPanel'

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
    expect(screen.getByText('§25-2-491 base-use result')).toBeInTheDocument()
    expect(screen.getByText('Table cell: P')).toBeInTheDocument()
  })
})
