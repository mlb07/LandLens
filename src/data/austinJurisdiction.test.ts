import { describe, expect, it } from 'vitest'
import { buildAustinJurisdictionProfile, evaluateAustinUseCompatibility, formatAustinFutureLandUse, getAustinBaseStandards, normalizeAustinBaseDistrict } from './austinJurisdiction'

describe('Austin jurisdiction profile', () => {
  it('normalizes combining-district zoning to its base district', () => {
    expect(normalizeAustinBaseDistrict('SF-3-NP')).toBe('SF-3')
    expect(normalizeAustinBaseDistrict('GR-MU-CO-NP')).toBe('GR')
    expect(normalizeAustinBaseDistrict('W/LO-CO')).toBe('W/LO')
    expect(normalizeAustinBaseDistrict('LI-CO')).toBe('LI')
    expect(normalizeAustinBaseDistrict('PUD-NP')).toBe('PUD')
  })

  it('loads codified principal standards for a registered district', () => {
    const standards = getAustinBaseStandards('SF-3-NP')
    expect(standards).toMatchObject({
      district: 'SF-3',
      minimumLotSquareFeet: 5_750,
      maximumHeightFeet: 35,
      frontSetbackFeet: 25,
      interiorSideSetbackFeet: 5,
      rearSetbackFeet: 10,
    })
    expect(standards?.maximumImperviousCoverPercent).toBeUndefined()
  })

  it('derives a specific district when Austin GIS returns only the broad base family', () => {
    const profile = buildAustinJurisdictionProfile({ zoningCode: 'SF-3-NP', baseDistrict: 'SF', jurisdictionCode: 'FULL' })
    expect(profile.baseDistrict).toBe('SF-3')
    expect(profile.standards?.frontSetbackFeet).toBe(25)
    expect(profile.useCompatibility.residential).toBe('likely-compatible')
  })

  it('translates the official future-land-use coded domain', () => {
    expect(formatAustinFutureLandUse('100')).toBe('Single Family')
    expect(formatAustinFutureLandUse('330')).toBe('Mixed Use')
    expect(formatAustinFutureLandUse('custom label')).toBe('custom label')
  })

  it('keeps Austin ETJ standards and use conclusions unresolved', () => {
    const profile = buildAustinJurisdictionProfile({
      zoningCode: 'SF-3', baseDistrict: 'SF-3', jurisdictionCode: '2MILE',
    })
    expect(profile.standardsApply).toBe(false)
    expect(profile.standards).toBeUndefined()
    expect(profile.useCompatibility.residential).toBe('unresolved')
    expect(profile.reviewFlags[0]).toContain('not applied')
  })

  it('builds a full-purpose profile with overlays and future land use', () => {
    const profile = buildAustinJurisdictionProfile({
      zoningCode: 'SF-3-NP', baseDistrict: 'SF-3', jurisdictionCode: 'FULL',
      jurisdictionLabel: 'FULL PURPOSE', futureLandUse: 'Single Family',
      overlays: [{ name: 'Residential Design Standards', detail: 'Subchapter F', layerId: 22 }],
      verifiedAt: '2026-07-10T00:00:00.000Z',
    })
    expect(profile.standardsApply).toBe(true)
    expect(profile.standards?.district).toBe('SF-3')
    expect(profile.useCompatibility.residential).toBe('likely-compatible')
    expect(profile.useCompatibility.industrial).toBe('likely-incompatible')
    expect(profile.overlays).toHaveLength(1)
    expect(profile.futureLandUse).toBe('Single Family')
  })

  it('recognizes mixed-use combining districts without calling them by-right', () => {
    const compatibility = evaluateAustinUseCompatibility('GR', 'GR-MU-CO-NP', true)
    expect(compatibility['mixed-use']).toBe('likely-compatible')
    expect(compatibility.residential).toBe('likely-compatible')
    expect(compatibility.industrial).toBe('likely-incompatible')
  })

  it('leaves special districts unresolved', () => {
    expect(evaluateAustinUseCompatibility('PUD', 'PUD-NP', true)).toEqual({
      residential: 'unresolved', commercial: 'unresolved', 'mixed-use': 'unresolved', industrial: 'unresolved', other: 'unresolved',
    })
  })
})
