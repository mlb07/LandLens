import { beforeEach, describe, expect, it } from 'vitest'
import { buildAustinJurisdictionProfile } from '../austinJurisdiction'
import { registerDefaultJurisdictionPacks } from './defaultPacks'
import {
  assessJurisdictionProposedUse,
  clearJurisdictionPacksForTests,
  getApplicableJurisdictionPacks,
  getJurisdictionCoverage,
  getJurisdictionProposedUseDefinition,
  getJurisdictionProposedUses,
  getJurisdictionSources,
} from './registry'

describe('national jurisdiction-pack registry', () => {
  beforeEach(() => {
    clearJurisdictionPacksForTests()
    registerDefaultJurisdictionPacks()
  })

  it('registers the multi-market packs as ordinary versioned packs', () => {
    expect(getJurisdictionCoverage()).toEqual([
      expect.objectContaining({ packId: 'austin-travis', profileId: 'austin-travis-v1', stateCode: 'TX', proposedUseCount: 30, hasUtility: true }),
      expect.objectContaining({ packId: 'houston', profileId: 'houston-v1', stateCode: 'TX', proposedUseCount: 8, hasUtility: false }),
      expect.objectContaining({ packId: 'charlotte', profileId: 'charlotte-v1', stateCode: 'NC', proposedUseCount: 11, hasUtility: false }),
      expect.objectContaining({ packId: 'dallas', profileId: 'dallas-v1', stateCode: 'TX', proposedUseCount: 11, hasUtility: false }),
    ])
    expect(getApplicableJurisdictionPacks({ lat: 30.2672, lng: -97.7431 }, 'TX')).toHaveLength(1)
    expect(getApplicableJurisdictionPacks({ lat: 29.7604, lng: -95.3698 }, 'TX').map((pack) => pack.id)).toEqual(['houston'])
  })

  it('resolves catalogs, assessments, and sources through the generic interface', () => {
    const profile = buildAustinJurisdictionProfile({ zoningCode: 'SF-3-NP', baseDistrict: 'SF', jurisdictionCode: 'FULL' })
    expect(getJurisdictionProposedUses(profile)).toHaveLength(30)
    expect(getJurisdictionProposedUseDefinition(profile, 'restaurant_general')?.intendedUse).toBe('commercial')
    expect(assessJurisdictionProposedUse(profile, 'single_family')?.status).toBe('permitted')
    expect(getJurisdictionSources(profile).map((source) => source.role)).toContain('permitted-uses')
  })
})
