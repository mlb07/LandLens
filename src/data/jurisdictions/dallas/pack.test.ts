import { describe, expect, it } from 'vitest'
import { assessDallasProposedUse, buildDallasProfile } from './pack'

describe('Dallas jurisdiction pack', () => {
  it('classifies ordinary base-district families conservatively', () => {
    const profile = buildDallasProfile({ district: 'CR', longName: 'Community Retail' })
    expect(profile.useCompatibility.commercial).toBe('likely-compatible')
    expect(profile.useCompatibility.industrial).toBe('conditional-review')
    expect(profile.standardsApply).toBe(false)
  })

  it('does not infer use compatibility through a planned district ordinance', () => {
    const profile = buildDallasProfile({ district: 'PD', pdNumber: '193', commonName: 'Oak Lawn', overlays: [{ name: 'Height Map Overlay', layerId: 12, detail: 'H-1' }] })
    expect(profile.useCompatibility.commercial).toBe('conditional-review')
    expect(profile.reviewFlags.join(' ')).toMatch(/PD 193/i)
    expect(profile.overlays).toHaveLength(1)
  })

  it('requires exact Chapter 51A review even for a likely family match', () => {
    const profile = buildDallasProfile({ district: 'MU-2', longName: 'Mixed Use' })
    const assessment = assessDallasProposedUse(profile, 'dallas-retail')
    expect(assessment?.status).toBe('special-review')
    expect(assessment?.explanation).toMatch(/exact Chapter 51A/i)
  })
})
