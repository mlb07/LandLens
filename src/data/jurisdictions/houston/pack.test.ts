import { describe, expect, it } from 'vitest'
import { assessHoustonProposedUse, buildHoustonProfile, HOUSTON_PROPOSED_USES } from './pack'

describe('Houston jurisdiction pack', () => {
  it('models Houston as no citywide zoning without calling development unrestricted', () => {
    const profile = buildHoustonProfile({ serviceType: 'FULL', inEtj: false })
    expect(profile.zoningCode).toBe('NO CITYWIDE ZONING')
    expect(profile.standardsApply).toBe(false)
    expect(profile.useCompatibility.industrial).toBe('conditional-review')
    expect(profile.reviewFlags.join(' ')).toMatch(/not interpret.*unrestricted/i)
  })

  it('preserves mapped minimum-lot, building-line, and historic controls', () => {
    const profile = buildHoustonProfile({
      serviceType: 'FULL', inEtj: false,
      minimumLot: { LOTSIZE: 5000, ORDINANCE: '2020-1' },
      buildingLine: { BLD__LINE: 25, ORDINANCE_: '2021-2' },
      historicDistrict: { NAME: 'Old Sixth Ward', HISTORIC: 'Yes' },
    })
    expect(profile.overlays.map((item) => item.name)).toEqual(['Minimum lot size area', 'Special building line', 'Historic district'])
    expect(profile.overlays[0].detail).toBe('5000')
    expect(profile.overlays[1].detail).toBe('25')
    expect(profile.overlays[2].detail).toBe('Old Sixth Ward')
  })

  it('returns a special-review result instead of inventing a permitted-use table', () => {
    const profile = buildHoustonProfile({ serviceType: 'FULL', inEtj: false })
    const assessment = assessHoustonProposedUse(profile, 'houston-warehouse')
    expect(assessment?.status).toBe('special-review')
    expect(assessment?.explanation).toMatch(/does not use a citywide zoning use table/i)
    expect(HOUSTON_PROPOSED_USES).toHaveLength(8)
  })
})
