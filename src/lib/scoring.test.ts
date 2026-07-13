import { describe, it, expect } from 'vitest'
import { analyzeSite, CATEGORY_WEIGHTS } from './scoring'
import { EMPTY_SITE_INPUTS } from '../types/site'
import type { OfficialSiteData } from '../data/officialDataProvider'
import type { ParcelOverlayData } from '../data/parcelOverlayProvider'
import type { RegionalHazardData } from '../data/regionalHazardProvider'
import type { ParcelSelection } from '../types/site'
import { buildAustinJurisdictionProfile } from '../data/austinJurisdiction'
import { registerDefaultJurisdictionPacks } from '../data/jurisdictions/defaultPacks'

registerDefaultJurisdictionPacks()

const COORDS = { lat: 30.27, lng: -97.74 }
const GOOD_INPUTS = { ...EMPTY_SITE_INPUTS, acres: '10', roadFrontage: 'yes' as const, utilitiesNearby: 'yes' as const, zoningNotes: 'by-right permitted', location: 'Austin, TX' }

const fullOfficial: OfficialSiteData = {
  flood: { available: true, value: { zone: 'X', subtype: '', sfha: false, floodway: false, risk: 'Low' }, provenance: { source: 'FEMA', sourceUrl: 'x' } },
  slope: { available: true, value: { slopePercent: 3, centerElevationMeters: 150, sampleRadiusMeters: 50 }, provenance: { source: 'USGS', sourceUrl: 'x' } },
  road: { available: true, value: { nearestDistanceMeters: 20, roadName: 'Main St', roadClass: 'Primary' as const }, provenance: { source: 'Census', sourceUrl: 'x' } },
  demographics: { available: true, value: { growthPercent: 12, currentPopulation: 10000, priorPopulation: 8000, geography: 'Tract 1' }, provenance: { source: 'Census', sourceUrl: 'x' } },
  environmental: { available: true, value: { mappedWetland: false }, provenance: { source: 'NWI', sourceUrl: 'x' } },
  soils: { available: true, value: { mukey: '123', mapUnitName: 'Sandy loam', drainageClass: 'Well drained', hydricClass: 'No', dominantRating: 'slight' as const, septicRating: 'Slight', dwellingRating: 'Slight', hydric: false }, provenance: { source: 'NRCS', sourceUrl: 'x' } },
  contamination: { available: true, value: { facilityCount: 0, nearestDistanceMeters: 0, hasMajorFlag: false, facilityTypes: [], nearestName: '' }, provenance: { source: 'EPA', sourceUrl: 'x' } },
  species: { available: true, value: { criticalHabitatHit: false, criticalHabitatLayers: [], speciesCount: 0 }, provenance: { source: 'USFWS', sourceUrl: 'x' } },
  utilityService: { available: true, value: { inWaterServiceArea: true, pwsName: 'City Water', pwsId: '12345', boundaryMethod: 'sourced', dataProviderType: 'Utility', dataSourceUrl: 'x', populationServed: 100000, serviceConnections: 40000 }, provenance: { source: 'EPA', sourceUrl: 'x' } },
  sewerService: { available: true, value: { inMappedSewershed: true, facilityName: 'Central WWTP', cwnsId: '1', npdesId: 'TX1', method: 'sourced', source: 'Utility', echoUrl: 'x' }, provenance: { source: 'EPA', sourceUrl: 'x' } },
  broadband: { available: true, value: { lookupUrl: 'https://broadbandmap.fcc.gov/', embeddedAvailability: false, dataAccess: 'public-map' }, provenance: { source: 'FCC', sourceUrl: 'x' } },
  protectedLands: { available: true, value: { intersects: false, interests: [], hasFeeInterest: false, hasEasementOrDesignation: false }, provenance: { source: 'USGS', sourceUrl: 'x' } },
  transportation: { available: true, value: { railWithinFiveKm: true, nearestRailDistanceMeters: 1000, railOwner: 'UP', passengerService: 'Amtrak', strategicRailNetwork: true }, provenance: { source: 'BTS', sourceUrl: 'x' } },
  bps: { available: true, value: { permitsPerThousand2023: 5, permitsPerThousand2024: 7, permitTrend: 40, totalPermits2024: 500, countyName: 'Travis County' }, provenance: { source: 'Census', sourceUrl: 'x' } },
  stormwater: { available: true, value: { drainageDirection: 'S', slopeTowardLowPoint: 2.5, hasPositiveOutfall: true, flatnessIndex: 0.6, estimatedDetentionSuitability: 'moderate' as const, nearestWaterBodyDistanceMeters: 0, screeningLevel: 'good' as const }, provenance: { source: 'USGS', sourceUrl: 'x' } },
  easements: { available: false, provenance: { source: 'No adapter', sourceUrl: 'x' }, error: 'No local adapter' },
  authority: { available: true, value: { authorityName: 'Austin city', authorityType: 'incorporated-place', incorporatedPlace: 'Austin city', countyName: 'Travis County', stateCode: 'TX', sourceVintage: 'Current', coverageNote: 'Routing only', resolvedAt: new Date().toISOString() }, provenance: { source: 'Census', sourceUrl: 'x' } },
  fetchedAt: new Date().toISOString(),
}

describe('scoring weights', () => {
  it('all 14 category weights sum to 100', () => {
    const total = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })

  it('has exactly 14 categories', () => {
    expect(Object.keys(CATEGORY_WEIGHTS)).toHaveLength(14)
  })
})

describe('analyzeSite — basic scenarios', () => {
  it('returns unscored with no data and no inputs', () => {
    const result = analyzeSite(COORDS, EMPTY_SITE_INPUTS)
    expect(result.finalScore).toBeNull()
    expect(result.verdict).toBe('Not enough verified data')
  })

  it('returns a mid-to-upper score with full official point data and good inputs', () => {
    // Good point-level evidence + user-reported by-right zoning lands in the
    // "viable" band on the recentered scale — "strong" is reserved for
    // parcel-wide verified evidence with affirmative strengths.
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial)
    expect(result.finalScore).not.toBeNull()
    expect(result.finalScore!).toBeGreaterThanOrEqual(60)
    expect(result.finalScore!).toBeLessThanOrEqual(75)
    expect(result.verdict).toContain('Viable')
  })

  it('produces exactly 14 metrics', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial)
    expect(Object.keys(result.metrics)).toHaveLength(14)
  })
})

describe('analyzeSite — hard gates', () => {
  it('triggers legal-access gate when roadFrontage is no', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, roadFrontage: 'no' }, fullOfficial)
    expect(result.gatedToManual).toBe(true)
    expect(result.hardGates.find((g) => g.id === 'legal-access')?.triggered).toBe(true)
    expect(result.verdict).toBe('Manual diligence required')
    expect(result.verdictTone).toBe('manual')
  })

  it('triggers utility-path gate when utilitiesNearby is no', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, utilitiesNearby: 'no' }, fullOfficial)
    expect(result.gatedToManual).toBe(true)
    expect(result.hardGates.find((g) => g.id === 'utility-path')?.triggered).toBe(true)
  })

  it('triggers floodway-in-core gate from point floodway', () => {
    const floodOfficial = { ...fullOfficial, flood: { ...fullOfficial.flood, value: { ...fullOfficial.flood.value!, floodway: true, risk: 'Floodway' as const } } }
    const result = analyzeSite(COORDS, GOOD_INPUTS, floodOfficial)
    expect(result.gatedToManual).toBe(true)
    expect(result.hardGates.find((g) => g.id === 'floodway-in-core')?.triggered).toBe(true)
  })

  it('triggers contamination gate on major flag', () => {
    const contaminated = { ...fullOfficial, contamination: { ...fullOfficial.contamination, value: { ...fullOfficial.contamination.value!, facilityCount: 3, hasMajorFlag: true } } }
    const result = analyzeSite(COORDS, GOOD_INPUTS, contaminated)
    expect(result.gatedToManual).toBe(true)
    expect(result.hardGates.find((g) => g.id === 'contamination')?.triggered).toBe(true)
  })

  it('triggers species-historic gate on critical habitat', () => {
    const habitat = { ...fullOfficial, species: { ...fullOfficial.species, value: { ...fullOfficial.species.value!, criticalHabitatHit: true, speciesCount: 1, criticalHabitatLayers: ['Bird'] } } }
    const result = analyzeSite(COORDS, GOOD_INPUTS, habitat)
    expect(result.gatedToManual).toBe(true)
    expect(result.hardGates.find((g) => g.id === 'species-historic')?.triggered).toBe(true)
  })

  it('triggers net-yield gate on tiny acreage', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, acres: '0.05', intendedUse: 'residential' }, fullOfficial)
    expect(result.gatedToManual).toBe(true)
    expect(result.hardGates.find((g) => g.id === 'net-yield')?.triggered).toBe(true)
  })

  it('triggers use-permitted gate on prohibited zoning notes', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: 'use is prohibited' }, fullOfficial)
    expect(result.hardGates.find((g) => g.id === 'use-permitted')?.triggered).toBe(true)
  })
})

describe('analyzeSite — zoning regex', () => {
  it('uses the Austin jurisdiction profile for a conservative district-family screen', () => {
    const profile = buildAustinJurisdictionProfile({
      zoningCode: 'SF-3-NP', baseDistrict: 'SF-3', jurisdictionCode: 'FULL', jurisdictionLabel: 'FULL PURPOSE',
      overlays: [{ name: 'Residential Design Standards', layerId: 22 }],
    })
    const official: OfficialSiteData = {
      ...fullOfficial,
      zoning: { available: true, value: { zoningCode: 'SF-3-NP', baseDistrict: 'SF-3', jurisdiction: 'FULL PURPOSE', profile }, provenance: { source: 'City of Austin', sourceUrl: 'x' } },
    }
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: '', intendedUse: 'residential' }, official)
    expect(result.metrics.zoning.status).toBe('official')
    expect(result.metrics.zoning.score).toBe(62)
    expect(result.metrics.zoning.detail).toContain('Austin/Travis development profile')
    expect(result.redFlags.some((flag) => flag.includes('mapped zoning overlay'))).toBe(true)
    expect(result.unknowns).not.toContain('Zoning and future land use have not been verified.')
  })

  it('does not turn a coarse Austin family conflict into a legal hard gate', () => {
    const profile = buildAustinJurisdictionProfile({ zoningCode: 'SF-3', baseDistrict: 'SF-3', jurisdictionCode: 'FULL' })
    const official: OfficialSiteData = {
      ...fullOfficial,
      zoning: { available: true, value: { zoningCode: 'SF-3', baseDistrict: 'SF-3', jurisdiction: 'FULL PURPOSE', profile }, provenance: { source: 'City of Austin', sourceUrl: 'x' } },
    }
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: '', intendedUse: 'industrial' }, official)
    expect(result.metrics.zoning.score).toBe(22)
    expect(result.redFlags.some((flag) => flag.includes('likely conflict'))).toBe(true)
    expect(result.hardGates.find((gate) => gate.id === 'use-permitted')?.triggered).toBe(false)
  })

  it('scores a §25-2-491 permitted proposed use with combining-district review', () => {
    const profile = buildAustinJurisdictionProfile({ zoningCode: 'SF-3-NP', baseDistrict: 'SF', jurisdictionCode: 'FULL' })
    const official: OfficialSiteData = {
      ...fullOfficial,
      zoning: { available: true, value: { zoningCode: 'SF-3-NP', baseDistrict: 'SF-3', jurisdiction: 'FULL PURPOSE', profile }, provenance: { source: 'City of Austin', sourceUrl: 'x' } },
    }
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: '', proposedUse: 'single_family' }, official)
    expect(result.metrics.zoning.score).toBe(72)
    expect(result.metrics.zoning.summary).toContain('listed as permitted')
    expect(result.strengths.some((strength) => strength.includes('base-use table'))).toBe(true)
  })

  it('hard-gates an exact use that the base table does not permit', () => {
    const profile = buildAustinJurisdictionProfile({ zoningCode: 'SF-3-NP', baseDistrict: 'SF', jurisdictionCode: 'FULL' })
    const official: OfficialSiteData = {
      ...fullOfficial,
      zoning: { available: true, value: { zoningCode: 'SF-3-NP', baseDistrict: 'SF-3', jurisdiction: 'FULL PURPOSE', profile }, provenance: { source: 'City of Austin', sourceUrl: 'x' } },
    }
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: '', proposedUse: 'multifamily' }, official)
    expect(result.metrics.zoning.score).toBe(10)
    expect(result.hardGates.find((gate) => gate.id === 'use-permitted')?.triggered).toBe(true)
    expect(result.redFlags.some((flag) => flag.includes('not permitted'))).toBe(true)
  })

  it('routes a prohibited base cell with MU combining zoning to special review', () => {
    const profile = buildAustinJurisdictionProfile({ zoningCode: 'SF-3-MU-CO-NP', baseDistrict: 'SF', jurisdictionCode: 'FULL' })
    const official: OfficialSiteData = {
      ...fullOfficial,
      zoning: { available: true, value: { zoningCode: 'SF-3-MU-CO-NP', baseDistrict: 'SF-3', jurisdiction: 'FULL PURPOSE', profile }, provenance: { source: 'City of Austin', sourceUrl: 'x' } },
    }
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: '', intendedUse: 'commercial', proposedUse: 'restaurant_general' }, official)
    expect(result.metrics.zoning.score).toBe(40)
    expect(result.hardGates.find((gate) => gate.id === 'use-permitted')?.triggered).toBe(false)
    expect(result.redFlags.some((flag) => flag.includes('combining-district review'))).toBe(true)
  })

  it('detects "prohibited"', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: 'prohibited use' }, fullOfficial)
    expect(result.metrics.zoning.score).toBeLessThanOrEqual(20)
  })

  it('detects "not allowed"', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: 'not allowed' }, fullOfficial)
    expect(result.metrics.zoning.score).toBeLessThanOrEqual(20)
  })

  it('detects "by-right" as strong', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: 'by-right permitted' }, fullOfficial)
    expect(result.metrics.zoning.score).toBeGreaterThanOrEqual(70)
  })

  it('detects "conditional" as moderate', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: 'conditional use permit' }, fullOfficial)
    expect(result.metrics.zoning.score).toBe(42)
  })

  it('detects "rezoning" as conditional', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: 'rezoning needed' }, fullOfficial)
    expect(result.metrics.zoning.score).toBe(42)
  })
})

describe('analyzeSite — parcel overlays', () => {
  const goodOverlays: ParcelOverlayData = {
    floodplain: { available: true, value: { sfhaFraction: 0, floodwayFraction: 0, floodwayInCore: false, zoneSummary: 'X', risk: 'Low' as const, samplePoints: 400 }, provenance: { source: 'FEMA', sourceUrl: 'x' } },
    wetlands: { available: true, value: { wetlandFraction: 0, wetlandTypeCounts: {}, samplePoints: 400 }, provenance: { source: 'NWI', sourceUrl: 'x' } },
    slope: { available: true, value: { meanSlopePercent: 3, p90SlopePercent: 5, maxSlopePercent: 8, fractionOver15: 0, fractionOver20: 0, fractionOver30: 0, samplePoints: 25, spacingMeters: 40 }, provenance: { source: 'USGS', sourceUrl: 'x' } },
    soils: { available: true, value: { hydricFraction: 0, severeFraction: 0, moderateFraction: 0, dominantRating: 'slight' as const, soilTypeCounts: { 'Sandy loam': 1 }, samplePoints: 400 }, provenance: { source: 'NRCS', sourceUrl: 'x' } },
    stormwater: { available: true, value: { drainageDirection: 'S', slopeTowardLowPoint: 2.5, hasPositiveOutfall: true, flatnessIndex: 0.6, estimatedDetentionSuitability: 'good' as const, screeningLevel: 'good' as const, samplePoints: 25, spacingMeters: 40 }, provenance: { source: 'USGS', sourceUrl: 'x' } },
    easements: { available: true, value: { easementFraction: 0, easementTypes: [], sourceLayer: 'Travis County Tax Maps parcel layer', samplePoints: 400 }, provenance: { source: 'Local GIS', sourceUrl: 'x' } },
    contamination: { available: true, value: { facilityCount: 0, hasMajorFlag: false, facilityTypes: [], nearestName: '', bufferMeters: 100, samplePoints: 400 }, provenance: { source: 'EPA FRS', sourceUrl: 'x' } },
    species: { available: true, value: { criticalHabitatHit: false, criticalHabitatLayers: [], speciesCount: 0, habitatFraction: 0, samplePoints: 400 }, provenance: { source: 'USFWS ECOS', sourceUrl: 'x' } },
    setback: { available: true, value: { setbackFraction: 0.1, setbackDistanceMeters: 7.6, frontSetbackMeters: 7.6, sideSetbackMeters: 3.0, rearSetbackMeters: 7.6, intendedUse: 'residential', samplePoints: 400 }, provenance: { source: 'Setback', sourceUrl: 'x' } },
    buildableEnvelope: { available: false, provenance: { source: 'LandLens', sourceUrl: '' }, error: 'Test fixture uses supplied net acreage.' },
    netDevelopable: { grossAcres: 10, floodwayAcres: 0, wetlandAcres: 0, steepSlopeAcres: 0, soilConstrainedAcres: 0, easementAcres: 0, setbackAcres: 1, constrainedAcres: 1, netDevelopableAcres: 9, netToGrossRatio: 0.9, samplePoints: 400 },
    fetchedAt: new Date().toISOString(),
  }

  it('uses parcel-wide floodplain display when overlays available', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, goodOverlays)
    expect(result.metrics.floodplain.displayValue).toContain('SFHA')
    expect(result.metrics.floodplain.displayValue).not.toContain('(point)')
  })

  it('uses parcel-wide net developable when overlays available', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, goodOverlays)
    expect(result.metrics.netDevelopable.status).toBe('official')
    expect(result.metrics.netDevelopable.displayValue).toContain('net /')
  })

  it('identifies jurisdiction-code setbacks in net developable detail', () => {
    const localOverlays: ParcelOverlayData = {
      ...goodOverlays,
      setback: { ...goodOverlays.setback, value: { ...goodOverlays.setback.value!, standardsSource: 'jurisdiction-code' } },
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, localOverlays)
    expect(result.metrics.netDevelopable.detail).toContain('mapped jurisdiction base-district distances')
  })

  it('triggers floodway gate from overlay floodway', () => {
    const floodwayOverlays = { ...goodOverlays, floodplain: { ...goodOverlays.floodplain, value: { ...goodOverlays.floodplain.value!, floodwayFraction: 0.15, floodwayInCore: true, risk: 'Floodway' as const } } }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, floodwayOverlays)
    expect(result.hardGates.find((g) => g.id === 'floodway-in-core')?.triggered).toBe(true)
  })

  it('prefers the parcel-wide soils overlay over the point result', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, goodOverlays)
    expect(result.metrics.soils.displayValue).toContain('hydric')
    expect(result.metrics.soils.displayValue).not.toContain('Well drained')
  })

  it('prefers the parcel-wide stormwater overlay over the point result', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, goodOverlays)
    expect(result.metrics.stormwater.summary).toContain('Parcel-wide')
  })

  it('prefers the parcel-wide easements overlay when available', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, goodOverlays)
    expect(result.metrics.easements.displayValue).toContain('No mapped easements on parcel')
  })

  it('measures access from the parcel boundary when the access overlay is available', () => {
    const withAccess: ParcelOverlayData = {
      ...goodOverlays,
      access: { available: true, value: { nearestDistanceMeters: 42, roadName: 'County Rd 5', roadClass: 'Local', hasFrontage: false, roadCount: 3 }, provenance: { source: 'TIGERweb', sourceUrl: 'x' } },
    }
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, roadFrontage: 'unknown' }, fullOfficial, true, withAccess)
    expect(result.metrics.access.displayValue).toContain('42 m parcel → County Rd 5')
    expect(result.metrics.access.detail).toContain('across the whole boundary rather than the selected point')
  })

  it('credits verified frontage when a road meets the parcel boundary', () => {
    const withFrontage: ParcelOverlayData = {
      ...goodOverlays,
      access: { available: true, value: { nearestDistanceMeters: 0, roadName: 'Main St', roadClass: 'Local', hasFrontage: true, roadCount: 4 }, provenance: { source: 'TIGERweb', sourceUrl: 'x' } },
    }
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, roadFrontage: 'unknown' }, fullOfficial, true, withFrontage)
    expect(result.metrics.access.displayValue).toContain('Road meets parcel')
    expect(result.metrics.access.score!).toBeGreaterThanOrEqual(82)
  })

  it('reduces net developable acres when severe soils are present', () => {
    const soilOverlays: ParcelOverlayData = {
      ...goodOverlays,
      soils: { available: true, value: { hydricFraction: 0.2, severeFraction: 0.4, moderateFraction: 0.1, dominantRating: 'severe' as const, soilTypeCounts: { 'Clay': 1 }, samplePoints: 400 }, provenance: { source: 'NRCS', sourceUrl: 'x' } },
      netDevelopable: { grossAcres: 10, floodwayAcres: 0, wetlandAcres: 0, steepSlopeAcres: 0, soilConstrainedAcres: 4, easementAcres: 0, setbackAcres: 0, constrainedAcres: 4, netDevelopableAcres: 6, netToGrossRatio: 0.6, samplePoints: 400 },
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, soilOverlays)
    expect(result.metrics.netDevelopable.displayValue).toContain('6 net / 10 gross')
    expect(result.metrics.netDevelopable.detail).toContain('hydric/severe soils')
    expect(result.metrics.soils.score!).toBeLessThanOrEqual(20)
    expect(result.redFlags.some((f) => f.includes('severe NRCS soil ratings'))).toBe(true)
  })

  it('reduces net developable acres when easements are present', () => {
    const easeOverlays: ParcelOverlayData = {
      ...goodOverlays,
      easements: { available: true, value: { easementFraction: 0.1, easementTypes: ['EASEMENT'], sourceLayer: 'Travis County Tax Maps parcel layer', samplePoints: 400 }, provenance: { source: 'Local GIS', sourceUrl: 'x' } },
      netDevelopable: { grossAcres: 10, floodwayAcres: 0, wetlandAcres: 0, steepSlopeAcres: 0, soilConstrainedAcres: 0, easementAcres: 1, setbackAcres: 0, constrainedAcres: 1, netDevelopableAcres: 9, netToGrossRatio: 0.9, samplePoints: 400 },
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, easeOverlays)
    expect(result.metrics.netDevelopable.displayValue).toContain('9 net / 10 gross')
    expect(result.metrics.netDevelopable.detail).toContain('easements/ROW 1 ac')
  })

  it('easements overlay still renders unavailable when no adapter covers the state', () => {
    const noEasements: ParcelOverlayData = {
      ...goodOverlays,
      easements: { available: false, provenance: { source: 'No local easement adapter', sourceUrl: 'x' }, error: 'No local GIS easement adapter registered.' },
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, noEasements)
    expect(result.metrics.easements.status).toBe('unknown')
  })

  it('prefers the parcel-wide contamination overlay over the point result', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, goodOverlays)
    expect(result.metrics.contamination.displayValue).toContain('on parcel')
    expect(result.metrics.contamination.displayValue).not.toContain('(point)')
  })

  it('prefers the parcel-wide species overlay over the point result', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, goodOverlays)
    expect(result.metrics.species.displayValue).toContain('on parcel')
    expect(result.metrics.species.displayValue).not.toContain('(point)')
  })

  it('triggers contamination gate from parcel-wide overlay major flag', () => {
    const contaminated: ParcelOverlayData = {
      ...goodOverlays,
      contamination: { available: true, value: { facilityCount: 2, hasMajorFlag: true, facilityTypes: ['RCRA'], nearestName: 'Acme Chemical', bufferMeters: 100, samplePoints: 400 }, provenance: { source: 'EPA FRS', sourceUrl: 'x' } },
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, contaminated)
    expect(result.gatedToManual).toBe(true)
    expect(result.hardGates.find((g) => g.id === 'contamination')?.triggered).toBe(true)
    expect(result.metrics.contamination.displayValue).toContain('on parcel')
  })

  it('triggers species-historic gate from parcel-wide overlay habitat hit', () => {
    const habitat: ParcelOverlayData = {
      ...goodOverlays,
      species: { available: true, value: { criticalHabitatHit: true, criticalHabitatLayers: ['Golden-cheeked Warbler'], speciesCount: 1, habitatFraction: 0.35, samplePoints: 400 }, provenance: { source: 'USFWS ECOS', sourceUrl: 'x' } },
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, habitat)
    expect(result.gatedToManual).toBe(true)
    expect(result.hardGates.find((g) => g.id === 'species-historic')?.triggered).toBe(true)
    expect(result.metrics.species.displayValue).toContain('35% of parcel')
  })

  it('does NOT subtract contamination or critical habitat from net developable acreage', () => {
    // Even with a major-flag contamination + a critical-habitat hit covering
    // half the parcel, the net developable acres remain 10 (gated sites
    // still compute a score for transparency, but those categories are gates
    // — not land-use takeouts — so they should not shrink the buildable area).
    const gated: ParcelOverlayData = {
      ...goodOverlays,
      contamination: { available: true, value: { facilityCount: 2, hasMajorFlag: true, facilityTypes: ['RCRA'], nearestName: 'Acme Chemical', bufferMeters: 100, samplePoints: 400 }, provenance: { source: 'EPA FRS', sourceUrl: 'x' } },
      species: { available: true, value: { criticalHabitatHit: true, criticalHabitatLayers: ['Golden-cheeked Warbler'], speciesCount: 1, habitatFraction: 0.5, samplePoints: 400 }, provenance: { source: 'USFWS ECOS', sourceUrl: 'x' } },
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, gated)
    expect(result.metrics.netDevelopable.displayValue).toContain('9 net / 10 gross')
    expect(result.gatedToManual).toBe(true)
  })
})

describe('analyzeSite — intended-use market weighting', () => {
  it('gives full permit-trend credit to residential intent', () => {
    const residential = analyzeSite(COORDS, { ...GOOD_INPUTS, intendedUse: 'residential' }, fullOfficial)
    const industrial = analyzeSite(COORDS, { ...GOOD_INPUTS, intendedUse: 'industrial' }, fullOfficial)
    // Residential should score at least as high as industrial on the market
    // category because Census BPS is a residential-structure signal.
    expect(residential.metrics.market.score!).toBeGreaterThanOrEqual(industrial.metrics.market.score!)
  })

  it('caps the BPS contribution for commercial/industrial intent', () => {
    // BPS permits trend is 40% (full honest credit at residential). For industrial
    // we cap at 78; the industrial market detail should mention the limitation.
    const industrial = analyzeSite(COORDS, { ...GOOD_INPUTS, intendedUse: 'industrial' }, fullOfficial)
    expect(industrial.metrics.market.displayValue).toContain('industrial')
    expect(industrial.metrics.market.detail).toContain('indirect')
    expect(industrial.unknowns.some((u) => /industrial/.test(u))).toBe(true)
  })

  it('does not flag a market unknown for residential intent', () => {
    const residential = analyzeSite(COORDS, { ...GOOD_INPUTS, intendedUse: 'residential' }, fullOfficial)
    expect(residential.unknowns.some((u) => /indirect market signal|residential-structure signal/.test(u))).toBe(false)
  })

  it('still produces a market score when only demographics are available', () => {
    const demoOnly = analyzeSite(COORDS, { ...GOOD_INPUTS, intendedUse: 'commercial' }, { ...fullOfficial, bps: { available: false, provenance: { source: 'Census', sourceUrl: 'x' } } })
    expect(demoOnly.metrics.market.score).not.toBeNull()
    expect(demoOnly.metrics.market.displayValue).toContain('pop')
  })
})

describe('analyzeSite — official parcel facts', () => {
  const parcel: ParcelSelection = {
    status: 'found', message: 'matched', id: 'P-1', facts: {
      zoning: 'CS', municipality: 'Austin', waterService: 'Austin Water', sewerService: 'City sewer', frontageFeet: 125,
    },
    provenance: { source: 'County assessor', sourceUrl: 'https://example.gov' },
  }
  const unavailableOfficial: OfficialSiteData = {
    ...fullOfficial,
    road: { available: false, provenance: { source: 'Census', sourceUrl: 'x' }, error: 'offline' },
    utilityService: { available: false, provenance: { source: 'EPA', sourceUrl: 'x' }, error: 'offline' },
    zoning: undefined,
    localUtility: undefined,
  }

  it('uses mapped parcel zoning when no local zoning adapter returns data', () => {
    const result = analyzeSite(COORDS, { ...EMPTY_SITE_INPUTS, intendedUse: 'commercial' }, unavailableOfficial, true, null, null, parcel)
    expect(result.metrics.zoning.status).toBe('official')
    expect(result.metrics.zoning.displayValue).toContain('CS')
  })

  it('does not penalize an unfamiliar local zoning code as incompatible', () => {
    const localCodeParcel = { ...parcel, facts: { ...parcel.facts, zoning: 'R-40' } }
    const result = analyzeSite(COORDS, { ...EMPTY_SITE_INPUTS, intendedUse: 'commercial' }, unavailableOfficial, true, null, null, localCodeParcel)
    expect(result.metrics.zoning.score).toBe(48)
    expect(result.metrics.zoning.summary).toContain('does not interpret automatically')
  })

  it('uses parcel water/sewer descriptors without treating them as capacity commitments', () => {
    const result = analyzeSite(COORDS, EMPTY_SITE_INPUTS, unavailableOfficial, true, null, null, parcel)
    expect(result.metrics.utilities.status).toBe('official')
    expect(result.metrics.utilities.displayValue).toContain('Austin Water')
    expect(result.metrics.utilities.detail).toContain('do not prove capacity')
  })

  it('treats a partially unavailable parcel utility record as partial evidence', () => {
    const partialParcel = { ...parcel, facts: { waterService: 'City Water', sewerService: 'None' } }
    const result = analyzeSite(COORDS, EMPTY_SITE_INPUTS, unavailableOfficial, true, null, null, partialParcel)
    expect(result.metrics.utilities.score).toBe(45)
    expect(result.metrics.utilities.summary).toContain('partial utility-service path')
  })

  it('uses assessor frontage as screening evidence but not proof of legal access', () => {
    const result = analyzeSite(COORDS, EMPTY_SITE_INPUTS, unavailableOfficial, true, null, null, parcel)
    expect(result.metrics.access.displayValue).toContain('125 ft')
    expect(result.metrics.access.detail).toContain('not proof of deeded access')
  })

  it('does not let mapped frontage override a user-reported lack of frontage', () => {
    const result = analyzeSite(COORDS, { ...EMPTY_SITE_INPUTS, roadFrontage: 'no' }, fullOfficial, true, null, null, parcel)
    expect(result.metrics.access.score).toBe(22)
    expect(result.gatedToManual).toBe(true)
  })
})

describe('analyzeSite — regional hazards category', () => {
  it('scores just above average when hazards are clear', () => {
    const clearHazards: RegionalHazardData = {
      hazards: [
        { type: 'seaLevelRise', available: true, level: 'none', penalty: 0, summary: '', detail: '', provenance: { source: 'NOAA', sourceUrl: 'x' } },
        { type: 'wildfire', available: true, level: 'low', penalty: 0, summary: '', detail: '', provenance: { source: 'USFS', sourceUrl: 'x' } },
        { type: 'radon', available: true, level: 'low', penalty: 0, summary: '', detail: '', provenance: { source: 'EPA', sourceUrl: 'x' } },
      ],
      totalPenalty: 0, available: true, fetchedAt: new Date().toISOString(),
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, false, null, clearHazards)
    expect(result.metrics.hazards.status).toBe('official')
    expect(result.metrics.hazards.score).toBe(62)
    expect(result.metrics.hazards.displayValue).toBe('No elevated regional hazard')
  })

  it('drops the hazards category for sea-level rise inundation', () => {
    const slrHazards: RegionalHazardData = {
      hazards: [
        { type: 'seaLevelRise', available: true, level: 'severe', penalty: -3, summary: '', detail: '', provenance: { source: 'NOAA', sourceUrl: 'x' } },
        { type: 'wildfire', available: true, level: 'none', penalty: 0, summary: '', detail: '', provenance: { source: 'USFS', sourceUrl: 'x' } },
        { type: 'radon', available: true, level: 'low', penalty: 0, summary: '', detail: '', provenance: { source: 'EPA', sourceUrl: 'x' } },
      ],
      totalPenalty: -3, available: true, fetchedAt: new Date().toISOString(),
    }
    const clear = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, false, null, null)
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, false, null, slrHazards)
    expect(result.metrics.hazards.score).toBe(32)
    expect(result.metrics.hazards.displayValue).toContain('sea-level rise')
    expect(result.redFlags.some((flag) => flag.includes('sea-level rise'))).toBe(true)
    // The hazards category is scored evidence, so the raw score reflects it.
    expect(result.rawScore!).toBeLessThanOrEqual(clear.rawScore!)
  })

  it('scores worst combined exposure near the bottom of the band', () => {
    const allHazards: RegionalHazardData = {
      hazards: [
        { type: 'seaLevelRise', available: true, level: 'severe', penalty: -3, summary: '', detail: '', provenance: { source: 'NOAA', sourceUrl: 'x' } },
        { type: 'wildfire', available: true, level: 'severe', penalty: -4, summary: '', detail: '', provenance: { source: 'USFS', sourceUrl: 'x' } },
        { type: 'radon', available: true, level: 'high', penalty: -2, summary: '', detail: '', provenance: { source: 'EPA', sourceUrl: 'x' } },
      ],
      totalPenalty: -5, available: true, fetchedAt: new Date().toISOString(),
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, false, null, allHazards)
    expect(result.metrics.hazards.score).toBe(12)
  })

  it('leaves the hazards category unscored when no source responds', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, false, null, null)
    expect(result.metrics.hazards.status).toBe('unknown')
    expect(result.metrics.hazards.score).toBeNull()
  })
})

describe('analyzeSite — verdict bands', () => {
  it('returns the viable band for good point-level evidence', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial)
    expect(result.verdictTone).toBe('interesting')
  })

  it('returns "Manual diligence required" for any gate', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, roadFrontage: 'no' }, fullOfficial)
    expect(result.verdictTone).toBe('manual')
  })
})
