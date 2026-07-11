import { describe, expect, it } from 'vitest'
import { assessCharlotteProposedUse, buildCharlotteProfile } from './pack'

describe('Charlotte jurisdiction pack', () => {
  it('classifies mapped zoning from the official district-family attribute', () => {
    const uptown = buildCharlotteProfile({ district: 'UC', classification: 'UPTOWN MIXED USE', overlay: 'none' })
    expect(uptown.useCompatibility.commercial).toBe('likely-compatible')
    expect(uptown.useCompatibility['mixed-use']).toBe('likely-compatible')
    expect(uptown.standardsApply).toBe(false)
  })

  it('flags conditional zoning and preserves mapped overlays and petition links', () => {
    const profile = buildCharlotteProfile({ district: 'N2-A(CD)', classification: 'MULTI-FAMILY', overlay: 'Transit Overlay', petition: '2025-001', hyperlink: 'https://example.gov/petition' })
    expect(profile.baseDistrict).toBe('N2-A')
    expect(profile.overlays[0]).toMatchObject({ name: 'Transit Overlay', detail: '2025-001' })
    expect(profile.reviewFlags.join(' ')).toMatch(/conditional/i)
    expect(profile.sources?.some((source) => source.id === 'petition')).toBe(true)
  })

  it('does not promote district-family compatibility into an invented by-right result', () => {
    const profile = buildCharlotteProfile({ district: 'CG', classification: 'COMMERCIAL', overlay: 'none' })
    const assessment = assessCharlotteProposedUse(profile, 'charlotte-restaurant')
    expect(assessment?.status).toBe('special-review')
    expect(assessment?.statusLabel).toMatch(/verify use matrix/i)
  })
})
