import { describe, expect, it } from 'vitest'
import { registerDefaultJurisdictionPacks } from './jurisdictions/defaultPacks'
import { getCoverageTelemetry } from './coverageProvider'

registerDefaultJurisdictionPacks()

describe('coverage telemetry', () => {
  it('reports all 50 states and every audited adapter', () => {
    const coverage = getCoverageTelemetry({ lat: 30.2672, lng: -97.7431 }, 'TX')
    expect(coverage.national).toEqual({ stateCount: 50, adapterCount: 58, enrichedAdapterCount: 57, auditedGeometryOnlyCount: 1 })
    expect(coverage.current.parcelStatus).toBe('verified-here')
    expect(coverage.current.jurisdictionPacks).toContain('Austin/Travis jurisdiction pack')
  })

  it('distinguishes local state coverage from coverage at the selected point', () => {
    const sonoma = getCoverageTelemetry({ lat: 38.44, lng: -122.71 }, 'CA')
    const losAngeles = getCoverageTelemetry({ lat: 34.05, lng: -118.24 }, 'CA')
    expect(sonoma.current.parcelStatus).toBe('verified-here')
    expect(sonoma.current.richFacts).toBe(true)
    expect(losAngeles.current.parcelStatus).toBe('partial-state-gap')
    expect(losAngeles.current.parcelSources).toEqual([])
  })

  it('reports each added market pack only within its registered geography', () => {
    expect(getCoverageTelemetry({ lat: 29.7604, lng: -95.3698 }, 'TX').current.jurisdictionPacks).toContain('Houston jurisdiction pack')
    expect(getCoverageTelemetry({ lat: 32.7767, lng: -96.7970 }, 'TX').current.jurisdictionPacks).toContain('Dallas jurisdiction pack')
    expect(getCoverageTelemetry({ lat: 35.2271, lng: -80.8431 }, 'NC').current.jurisdictionPacks).toContain('Charlotte jurisdiction pack')
    expect(getCoverageTelemetry({ lat: 34.0522, lng: -118.2437 }, 'CA').current.jurisdictionPacks).toEqual([])
  })
})
