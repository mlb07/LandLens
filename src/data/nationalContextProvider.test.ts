import { describe, expect, it } from 'vitest'
import { fetchBroadband, normalizeProtectedLandFeatures } from './nationalContextProvider'

describe('national context normalization', () => {
  it('preserves overlapping PAD-US fee, designation, and protection facts', () => {
    const result = normalizeProtectedLandFeatures([
      { attributes: { Category: 'Fee', FeatClass: 'Fee', Unit_Nm: 'Example Refuge', Pub_Access: 'Restricted', GAP_Sts: '2', MngTp_Desc: 'Federal', MngNm_Desc: 'FWS', DesTp_Desc: '' } },
      { attributes: { Category: 'Designation', FeatClass: 'Designation', Unit_Nm: 'Example Wilderness', Pub_Access: 'Open', GAP_Sts: '1', MngTp_Desc: 'Federal', MngNm_Desc: 'FWS', DesTp_Desc: 'Wilderness' } },
    ])
    expect(result.intersects).toBe(true)
    expect(result.hasFeeInterest).toBe(true)
    expect(result.hasEasementOrDesignation).toBe(true)
    expect(result.highestProtectionStatus).toBe(1)
    expect(result.interests).toHaveLength(2)
  })

  it('returns an explicit empty intersection without inventing restrictions', () => {
    expect(normalizeProtectedLandFeatures([])).toEqual({
      intersects: false,
      interests: [],
      highestProtectionStatus: undefined,
      hasFeeInterest: false,
      hasEasementOrDesignation: false,
    })
  })

  it('exposes FCC as an official public-map reference, not embedded Fabric data', async () => {
    const result = await fetchBroadband({ lat: 30.2672, lng: -97.7431 })
    expect(result.available).toBe(true)
    expect(result.value).toMatchObject({ embeddedAvailability: false, dataAccess: 'public-map' })
    expect(result.value?.lookupUrl).toBe('https://broadbandmap.fcc.gov/home')
    expect(result.provenance.coverageNote).toContain('Location Fabric is licensed')
  })
})
