import { describe, it, expect } from 'vitest'
import { analyzeSite, CATEGORY_WEIGHTS } from './scoring'
import { EMPTY_SITE_INPUTS } from '../types/site'
import type { OfficialSiteData } from '../data/officialDataProvider'
import type { ParcelOverlayData } from '../data/parcelOverlayProvider'
import type { RegionalHazardData } from '../data/regionalHazardProvider'

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
  utilityService: { available: true, value: { inWaterServiceArea: true, pwsName: 'City Water', pwsId: '12345', hasSewer: true }, provenance: { source: 'EPA', sourceUrl: 'x' } },
  bps: { available: true, value: { permitsPerThousand2023: 5, permitsPerThousand2024: 7, permitTrend: 40, totalPermits2024: 500, countyName: 'Travis County' }, provenance: { source: 'Census', sourceUrl: 'x' } },
  stormwater: { available: true, value: { drainageDirection: 'S', slopeTowardLowPoint: 2.5, hasPositiveOutfall: true, flatnessIndex: 0.6, estimatedDetentionSuitability: 'moderate' as const, nearestWaterBodyDistanceMeters: 0, screeningLevel: 'good' as const }, provenance: { source: 'USGS', sourceUrl: 'x' } },
  easements: { available: false, provenance: { source: 'No adapter', sourceUrl: 'x' }, error: 'No local adapter' },
  fetchedAt: new Date().toISOString(),
}

describe('scoring weights', () => {
  it('all 13 category weights sum to 100', () => {
    const total = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })

  it('has exactly 13 categories', () => {
    expect(Object.keys(CATEGORY_WEIGHTS)).toHaveLength(13)
  })
})

describe('analyzeSite — basic scenarios', () => {
  it('returns unscored with no data and no inputs', () => {
    const result = analyzeSite(COORDS, EMPTY_SITE_INPUTS)
    expect(result.finalScore).toBeNull()
    expect(result.verdict).toBe('Not enough verified data')
  })

  it('returns a score with full official data and good inputs', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial)
    expect(result.finalScore).not.toBeNull()
    expect(result.finalScore!).toBeGreaterThan(80)
    expect(result.verdict).toContain('Strong')
  })

  it('produces exactly 13 metrics', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial)
    expect(Object.keys(result.metrics)).toHaveLength(13)
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
    expect(result.metrics.zoning.score).toBeGreaterThanOrEqual(80)
  })

  it('detects "conditional" as moderate', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: 'conditional use permit' }, fullOfficial)
    expect(result.metrics.zoning.score).toBe(50)
  })

  it('detects "rezoning" as conditional', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, zoningNotes: 'rezoning needed' }, fullOfficial)
    expect(result.metrics.zoning.score).toBe(50)
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
    netDevelopable: { grossAcres: 10, floodwayAcres: 0, wetlandAcres: 0, steepSlopeAcres: 0, soilConstrainedAcres: 0, easementAcres: 0, constrainedAcres: 0, netDevelopableAcres: 10, netToGrossRatio: 1.0, samplePoints: 400 },
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

  it('reduces net developable acres when severe soils are present', () => {
    const soilOverlays: ParcelOverlayData = {
      ...goodOverlays,
      soils: { available: true, value: { hydricFraction: 0.2, severeFraction: 0.4, moderateFraction: 0.1, dominantRating: 'severe' as const, soilTypeCounts: { 'Clay': 1 }, samplePoints: 400 }, provenance: { source: 'NRCS', sourceUrl: 'x' } },
      netDevelopable: { grossAcres: 10, floodwayAcres: 0, wetlandAcres: 0, steepSlopeAcres: 0, soilConstrainedAcres: 4, easementAcres: 0, constrainedAcres: 4, netDevelopableAcres: 6, netToGrossRatio: 0.6, samplePoints: 400 },
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
      netDevelopable: { grossAcres: 10, floodwayAcres: 0, wetlandAcres: 0, steepSlopeAcres: 0, soilConstrainedAcres: 0, easementAcres: 1, constrainedAcres: 1, netDevelopableAcres: 9, netToGrossRatio: 0.9, samplePoints: 400 },
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, true, easeOverlays)
    expect(result.metrics.netDevelopable.displayValue).toContain('9 net / 10 gross')
    expect(result.metrics.netDevelopable.detail).toContain('mapped easements/ROW')
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
    expect(result.metrics.netDevelopable.displayValue).toContain('10 net / 10 gross')
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

describe('analyzeSite — regional hazard modifier', () => {
  it('applies no penalty when hazards are clear', () => {
    const clearHazards: RegionalHazardData = {
      hazards: [
        { type: 'seaLevelRise', available: true, level: 'none', penalty: 0, summary: '', detail: '', provenance: { source: 'NOAA', sourceUrl: 'x' } },
        { type: 'wildfire', available: true, level: 'low', penalty: 0, summary: '', detail: '', provenance: { source: 'USFS', sourceUrl: 'x' } },
        { type: 'radon', available: true, level: 'low', penalty: 0, summary: '', detail: '', provenance: { source: 'EPA', sourceUrl: 'x' } },
      ],
      totalPenalty: 0, available: true, fetchedAt: new Date().toISOString(),
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, false, null, clearHazards)
    expect(result.regionalHazardModifier).toBe(0)
  })

  it('applies -3 for sea-level rise inundation', () => {
    const slrHazards: RegionalHazardData = {
      hazards: [
        { type: 'seaLevelRise', available: true, level: 'severe', penalty: -3, summary: '', detail: '', provenance: { source: 'NOAA', sourceUrl: 'x' } },
        { type: 'wildfire', available: true, level: 'none', penalty: 0, summary: '', detail: '', provenance: { source: 'USFS', sourceUrl: 'x' } },
        { type: 'radon', available: true, level: 'low', penalty: 0, summary: '', detail: '', provenance: { source: 'EPA', sourceUrl: 'x' } },
      ],
      totalPenalty: -3, available: true, fetchedAt: new Date().toISOString(),
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, false, null, slrHazards)
    expect(result.regionalHazardModifier).toBe(-3)
    expect(result.finalScore).toBeLessThan(result.rawScore!)
  })

  it('clamps combined hazards to -5', () => {
    const allHazards: RegionalHazardData = {
      hazards: [
        { type: 'seaLevelRise', available: true, level: 'severe', penalty: -3, summary: '', detail: '', provenance: { source: 'NOAA', sourceUrl: 'x' } },
        { type: 'wildfire', available: true, level: 'severe', penalty: -4, summary: '', detail: '', provenance: { source: 'USFS', sourceUrl: 'x' } },
        { type: 'radon', available: true, level: 'high', penalty: -2, summary: '', detail: '', provenance: { source: 'EPA', sourceUrl: 'x' } },
      ],
      totalPenalty: -5, available: true, fetchedAt: new Date().toISOString(),
    }
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial, false, null, allHazards)
    expect(result.regionalHazardModifier).toBe(-5)
  })
})

describe('analyzeSite — verdict bands', () => {
  it('returns "Strong shortlist candidate" for 85+', () => {
    const result = analyzeSite(COORDS, GOOD_INPUTS, fullOfficial)
    expect(result.verdictTone).toBe('strong')
  })

  it('returns "Manual diligence required" for any gate', () => {
    const result = analyzeSite(COORDS, { ...GOOD_INPUTS, roadFrontage: 'no' }, fullOfficial)
    expect(result.verdictTone).toBe('manual')
  })
})
