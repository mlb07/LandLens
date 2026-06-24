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
    netDevelopable: { grossAcres: 10, floodwayAcres: 0, wetlandAcres: 0, steepSlopeAcres: 0, constrainedAcres: 0, netDevelopableAcres: 10, netToGrossRatio: 1.0, samplePoints: 400 },
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
