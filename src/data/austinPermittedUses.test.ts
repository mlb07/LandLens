import { describe, expect, it } from 'vitest'
import { buildAustinJurisdictionProfile } from './austinJurisdiction'
import { AUSTIN_PROPOSED_USES, assessAustinProposedUse, getAustinProposedUseDefinition } from './austinPermittedUses'
import type { ProposedUseId } from '../types/site'

function profile(zoningCode: string, baseDistrict: string, jurisdictionCode = 'FULL') {
  return buildAustinJurisdictionProfile({ zoningCode, baseDistrict, jurisdictionCode })
}

describe('Austin §25-2-491 proposed-use matrix', () => {
  it('publishes 30 unique high-value proposed uses', () => {
    expect(AUSTIN_PROPOSED_USES).toHaveLength(30)
    expect(new Set(AUSTIN_PROPOSED_USES.map((use) => use.key)).size).toBe(30)
  })

  it('resolves common residential uses in SF-3', () => {
    const sf3 = profile('SF-3-NP', 'SF')
    expect(assessAustinProposedUse(sf3, 'single_family')?.status).toBe('permitted')
    expect(assessAustinProposedUse(sf3, 'duplex')?.status).toBe('permitted')
    expect(assessAustinProposedUse(sf3, 'multifamily')?.status).toBe('prohibited')
  })

  it('resolves conditional and permitted commercial/civic uses', () => {
    const sf3 = profile('SF-3-NP', 'SF')
    const gr = profile('GR-NP', 'GR')
    expect(assessAustinProposedUse(sf3, 'daycare_commercial')?.status).toBe('conditional')
    expect(assessAustinProposedUse(gr, 'restaurant_general')?.status).toBe('permitted')
    expect(assessAustinProposedUse(gr, 'professional_office')?.status).toBe('permitted')
  })

  it('resolves industrial uses in LI', () => {
    const li = profile('LI', 'LI')
    expect(assessAustinProposedUse(li, 'light_manufacturing')?.status).toBe('permitted')
    expect(assessAustinProposedUse(li, 'general_warehousing')?.status).toBe('permitted')
  })

  it('routes footnoted cells to special review', () => {
    const lr = profile('LR-NP', 'LR')
    const result = assessAustinProposedUse(lr, 'general_retail_general')
    expect(result?.rawCell).toBe('11')
    expect(result?.status).toBe('special-review')
  })

  it('routes MU combining districts away from a false prohibited result', () => {
    const sf3Mu = profile('SF-3-MU-CO-NP', 'SF')
    const result = assessAustinProposedUse(sf3Mu, 'restaurant_general')
    expect(result?.status).toBe('special-review')
    expect(result?.requiresCombiningDistrictReview).toBe(true)
  })

  it('does not apply the matrix outside Austin regulatory jurisdiction', () => {
    const etj = profile('SF-3', 'SF', '2MILE')
    expect(assessAustinProposedUse(etj, 'single_family')?.status).toBe('unresolved')
  })

  it('maps proposed uses back to their broad intended-use model', () => {
    expect(getAustinProposedUseDefinition('restaurant_general')?.intendedUse).toBe('commercial')
    expect(getAustinProposedUseDefinition('light_manufacturing')?.intendedUse).toBe('industrial')
  })

  it.each<[ProposedUseId, string, string]>([
    ['single_family', 'SF-3', 'permitted'],
    ['duplex', 'SF-3', 'permitted'],
    ['two_family', 'SF-3', 'permitted'],
    ['multifamily', 'MF-3', 'permitted'],
    ['townhouse', 'SF-6', 'permitted'],
    ['condominium', 'SF-6', 'permitted'],
    ['mobile_home', 'MH', 'permitted'],
    ['bed_breakfast_group1', 'SF-3', 'permitted'],
    ['professional_office', 'NO', 'permitted'],
    ['medical_office_small', 'LO', 'permitted'],
    ['general_retail_convenience', 'LR', 'permitted'],
    ['general_retail_general', 'LR', 'special-review'],
    ['restaurant_limited', 'GO', 'conditional'],
    ['restaurant_general', 'CR', 'conditional'],
    ['food_sales', 'LR', 'permitted'],
    ['personal_services', 'LO', 'conditional'],
    ['hotel_motel', 'CR', 'conditional'],
    ['indoor_entertainment', 'CR', 'conditional'],
    ['automotive_repair', 'GR', 'permitted'],
    ['convenience_storage', 'W/LO', 'conditional'],
    ['custom_manufacturing', 'LR', 'conditional'],
    ['light_manufacturing', 'IP', 'permitted'],
    ['limited_warehousing', 'CBD', 'permitted'],
    ['general_warehousing', 'IP', 'permitted'],
    ['community_garden', 'LA', 'permitted'],
    ['urban_farm', 'LA', 'permitted'],
    ['daycare_limited', 'LA', 'conditional'],
    ['daycare_general', 'MF-1', 'permitted'],
    ['daycare_commercial', 'SF-3', 'conditional'],
    ['religious_assembly', 'CR', 'conditional'],
  ])('matches the published anchor cell for %s in %s', (proposedUse, district, expectedStatus) => {
    expect(assessAustinProposedUse(profile(district, district), proposedUse)?.status).toBe(expectedStatus)
  })
})
