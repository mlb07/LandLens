import { describe, it, expect } from 'vitest'
import { analyzeSite } from './scoring'
import { EMPTY_SITE_INPUTS } from '../types/site'
import type { ParcelSelection, SiteAnalysis } from '../types/site'
import type { OfficialSiteData } from '../data/officialDataProvider'
import type { ParcelOverlayData } from '../data/parcelOverlayProvider'
import type { RegionalHazardData } from '../data/regionalHazardProvider'

// Calibration fixtures: four synthetic parcels from "prime pad" to "swampy
// hillside" that pin the score distribution to the recentered scale —
// roughly 75+ / ~50 / ~40 / <30. If anchor changes silently drift the
// distribution back toward the 90s (or crush it), these tests fail.

const COORDS = { lat: 30.27, lng: -97.74 }
const PROV = { source: 'test', sourceUrl: 'x' }

function official(overrides: Partial<OfficialSiteData>): OfficialSiteData {
  return {
    flood: { available: true, value: { zone: 'X', subtype: '', sfha: false, floodway: false, risk: 'Low' }, provenance: PROV },
    slope: { available: true, value: { slopePercent: 3, centerElevationMeters: 150, sampleRadiusMeters: 50 }, provenance: PROV },
    road: { available: true, value: { nearestDistanceMeters: 20, roadName: 'Main St', roadClass: 'Primary' as const }, provenance: PROV },
    demographics: { available: true, value: { growthPercent: 12, currentPopulation: 10000, priorPopulation: 8000, geography: 'Tract 1' }, provenance: PROV },
    environmental: { available: true, value: { mappedWetland: false }, provenance: PROV },
    soils: { available: true, value: { mukey: '123', mapUnitName: 'Sandy loam', drainageClass: 'Well drained', hydricClass: 'No', dominantRating: 'slight' as const, septicRating: 'Slight', dwellingRating: 'Slight', hydric: false }, provenance: PROV },
    contamination: { available: true, value: { facilityCount: 0, nearestDistanceMeters: 0, hasMajorFlag: false, facilityTypes: [], nearestName: '' }, provenance: PROV },
    species: { available: true, value: { criticalHabitatHit: false, criticalHabitatLayers: [], speciesCount: 0 }, provenance: PROV },
    utilityService: { available: true, value: { inWaterServiceArea: true, pwsName: 'City Water', pwsId: '1', boundaryMethod: 'sourced', dataProviderType: 'Utility', dataSourceUrl: 'x', populationServed: 100000, serviceConnections: 40000 }, provenance: PROV },
    sewerService: { available: true, value: { inMappedSewershed: true, facilityName: 'Central WWTP', cwnsId: '1', npdesId: 'TX1', method: 'sourced', source: 'Utility', echoUrl: 'x' }, provenance: PROV },
    broadband: { available: true, value: { lookupUrl: 'x', embeddedAvailability: false, dataAccess: 'public-map' }, provenance: PROV },
    protectedLands: { available: true, value: { intersects: false, interests: [], hasFeeInterest: false, hasEasementOrDesignation: false }, provenance: PROV },
    transportation: { available: true, value: { railWithinFiveKm: false, railOwner: '', passengerService: '', strategicRailNetwork: false }, provenance: PROV },
    bps: { available: true, value: { permitsPerThousand2023: 5, permitsPerThousand2024: 7, permitTrend: 40, totalPermits2024: 500, countyName: 'Travis County' }, provenance: PROV },
    stormwater: { available: true, value: { drainageDirection: 'S', slopeTowardLowPoint: 2.5, hasPositiveOutfall: true, flatnessIndex: 0.6, estimatedDetentionSuitability: 'good' as const, nearestWaterBodyDistanceMeters: 0, screeningLevel: 'good' as const }, provenance: PROV },
    easements: { available: false, provenance: PROV, error: 'No local adapter' },
    authority: { available: true, value: { authorityName: 'Test City', authorityType: 'incorporated-place' as const, incorporatedPlace: 'Test City', countyName: 'Test County', stateCode: 'TX', sourceVintage: 'Current', coverageNote: 'Routing only', resolvedAt: new Date().toISOString() }, provenance: PROV },
    fetchedAt: new Date().toISOString(),
    ...overrides,
  }
}

function overlaysFixture(overrides: Partial<ParcelOverlayData>): ParcelOverlayData {
  return {
    floodplain: { available: true, value: { sfhaFraction: 0, floodwayFraction: 0, floodwayInCore: false, zoneSummary: 'X', risk: 'Low' as const, samplePoints: 400 }, provenance: PROV },
    wetlands: { available: true, value: { wetlandFraction: 0, wetlandTypeCounts: {}, samplePoints: 400 }, provenance: PROV },
    slope: { available: true, value: { meanSlopePercent: 3, p90SlopePercent: 5, maxSlopePercent: 8, fractionOver15: 0, fractionOver20: 0, fractionOver30: 0, samplePoints: 25, spacingMeters: 40 }, provenance: PROV },
    soils: { available: true, value: { hydricFraction: 0, severeFraction: 0, moderateFraction: 0, dominantRating: 'slight' as const, soilTypeCounts: { 'Sandy loam': 1 }, samplePoints: 400 }, provenance: PROV },
    stormwater: { available: true, value: { drainageDirection: 'S', slopeTowardLowPoint: 2.5, hasPositiveOutfall: true, flatnessIndex: 0.6, estimatedDetentionSuitability: 'good' as const, screeningLevel: 'good' as const, samplePoints: 25, spacingMeters: 40 }, provenance: PROV },
    easements: { available: true, value: { easementFraction: 0, easementTypes: [], sourceLayer: 'County GIS', samplePoints: 400 }, provenance: PROV },
    contamination: { available: true, value: { facilityCount: 0, hasMajorFlag: false, facilityTypes: [], nearestName: '', bufferMeters: 100, samplePoints: 400 }, provenance: PROV },
    species: { available: true, value: { criticalHabitatHit: false, criticalHabitatLayers: [], speciesCount: 0, habitatFraction: 0, samplePoints: 400 }, provenance: PROV },
    setback: { available: true, value: { setbackFraction: 0.1, setbackDistanceMeters: 7.6, frontSetbackMeters: 7.6, sideSetbackMeters: 3.0, rearSetbackMeters: 7.6, intendedUse: 'residential', samplePoints: 400 }, provenance: PROV },
    buildableEnvelope: { available: false, provenance: PROV, error: 'fixture' },
    netDevelopable: { grossAcres: 10, floodwayAcres: 0, wetlandAcres: 0, steepSlopeAcres: 0, soilConstrainedAcres: 0, easementAcres: 0, setbackAcres: 1, constrainedAcres: 1, netDevelopableAcres: 9, netToGrossRatio: 0.9, samplePoints: 400 },
    fetchedAt: new Date().toISOString(),
    ...overrides,
  }
}

function hazardsFixture(penalties: { slr?: number; wildfire?: number; radon?: number }): RegionalHazardData {
  const total = Math.max(-5, (penalties.slr ?? 0) + (penalties.wildfire ?? 0) + (penalties.radon ?? 0))
  return {
    hazards: [
      { type: 'seaLevelRise', available: true, level: (penalties.slr ?? 0) < 0 ? 'severe' : 'none', penalty: penalties.slr ?? 0, summary: '', detail: '', provenance: PROV },
      { type: 'wildfire', available: true, level: (penalties.wildfire ?? 0) <= -3 ? 'high' : (penalties.wildfire ?? 0) < 0 ? 'moderate' : 'low', penalty: penalties.wildfire ?? 0, summary: '', detail: '', provenance: PROV },
      { type: 'radon', available: true, level: (penalties.radon ?? 0) < 0 ? 'high' : 'low', penalty: penalties.radon ?? 0, summary: '', detail: '', provenance: PROV },
    ],
    totalPenalty: total, available: true, fetchedAt: new Date().toISOString(),
  }
}

// ── Archetype 1: prime verified parcel ─────────────────────────────────
// Parcel-wide overlays all clean, 90% net-to-gross, sourced water + sewer,
// road at the parcel edge with assessor frontage, hot market, clear hazards,
// user-reported by-right zoning.
function primeParcel(): SiteAnalysis {
  const parcel: ParcelSelection = { status: 'found', message: 'matched', id: 'P-PRIME', facts: { frontageFeet: 150 }, provenance: PROV }
  return analyzeSite(
    COORDS,
    { ...EMPTY_SITE_INPUTS, acres: '10', roadFrontage: 'yes', utilitiesNearby: 'yes', zoningNotes: 'by-right permitted' },
    official({}),
    true,
    overlaysFixture({}),
    hazardsFixture({}),
    parcel,
  )
}

// ── Archetype 2: average parcel ────────────────────────────────────────
// Point data only, everything unremarkable: modeled water only, moderate
// soils, 120 m to a road, flat-ish market, 2 acres, nothing verified beyond
// the point screens.
function averageParcel(): SiteAnalysis {
  return analyzeSite(
    COORDS,
    { ...EMPTY_SITE_INPUTS, acres: '2', zoningNotes: 'Listing mentions residential zoning nearby' },
    official({
      slope: { available: true, value: { slopePercent: 6, centerElevationMeters: 150, sampleRadiusMeters: 50 }, provenance: PROV },
      road: { available: true, value: { nearestDistanceMeters: 120, roadName: 'County Rd', roadClass: 'Secondary' as const }, provenance: PROV },
      demographics: { available: true, value: { growthPercent: 2, currentPopulation: 10200, priorPopulation: 10000, geography: 'Tract 1' }, provenance: PROV },
      soils: { available: true, value: { mukey: '9', mapUnitName: 'Clay loam', drainageClass: 'Moderately well drained', hydricClass: 'No', dominantRating: 'moderate' as const, septicRating: 'Moderate', dwellingRating: 'Moderate', hydric: false }, provenance: PROV },
      contamination: { available: true, value: { facilityCount: 1, nearestDistanceMeters: 600, hasMajorFlag: false, facilityTypes: ['NPDES'], nearestName: 'Car wash' }, provenance: PROV },
      utilityService: { available: true, value: { inWaterServiceArea: true, pwsName: 'MUD 12', pwsId: '2', boundaryMethod: 'modeled', dataProviderType: 'Utility', dataSourceUrl: 'x', populationServed: 4000, serviceConnections: 1500 }, provenance: PROV },
      sewerService: { available: true, value: { inMappedSewershed: false, facilityName: '', cwnsId: '', npdesId: '', method: 'modeled' as const, source: 'EPA', echoUrl: 'x' }, provenance: PROV },
      stormwater: { available: true, value: { drainageDirection: 'S', slopeTowardLowPoint: 0.8, hasPositiveOutfall: true, flatnessIndex: 0.8, estimatedDetentionSuitability: 'moderate' as const, nearestWaterBodyDistanceMeters: 0, screeningLevel: 'moderate' as const }, provenance: PROV },
      bps: { available: true, value: { permitsPerThousand2023: 3, permitsPerThousand2024: 3.1, permitTrend: 2, totalPermits2024: 40, countyName: 'Rural County' }, provenance: PROV },
    }),
  )
}

// ── Archetype 3: constrained parcel ────────────────────────────────────
// 30% SFHA, 15% wetlands, 12% mean slope, mostly-moderate soils, flat
// stormwater with no clear outfall, an easement bite, conditional zoning,
// soft market, moderate wildfire/radon exposure.
function constrainedParcel(): SiteAnalysis {
  return analyzeSite(
    COORDS,
    { ...EMPTY_SITE_INPUTS, acres: '10', zoningNotes: 'conditional use permit likely' },
    official({
      road: { available: true, value: { nearestDistanceMeters: 200, roadName: 'FM 100', roadClass: 'Secondary' as const }, provenance: PROV },
      demographics: { available: true, value: { growthPercent: -2, currentPopulation: 9800, priorPopulation: 10000, geography: 'Tract 1' }, provenance: PROV },
      utilityService: { available: true, value: { inWaterServiceArea: true, pwsName: 'MUD 9', pwsId: '3', boundaryMethod: 'modeled', dataProviderType: 'Utility', dataSourceUrl: 'x', populationServed: 2000, serviceConnections: 700 }, provenance: PROV },
      sewerService: { available: true, value: { inMappedSewershed: false, facilityName: '', cwnsId: '', npdesId: '', method: 'modeled' as const, source: 'EPA', echoUrl: 'x' }, provenance: PROV },
      bps: { available: true, value: { permitsPerThousand2023: 3, permitsPerThousand2024: 2.9, permitTrend: -3, totalPermits2024: 25, countyName: 'Rural County' }, provenance: PROV },
    }),
    true,
    overlaysFixture({
      floodplain: { available: true, value: { sfhaFraction: 0.3, floodwayFraction: 0, floodwayInCore: false, zoneSummary: 'AE', risk: 'High' as const, samplePoints: 400 }, provenance: PROV },
      wetlands: { available: true, value: { wetlandFraction: 0.15, wetlandTypeCounts: { PEM1: 1 }, samplePoints: 400 }, provenance: PROV },
      slope: { available: true, value: { meanSlopePercent: 12, p90SlopePercent: 20, maxSlopePercent: 28, fractionOver15: 0.25, fractionOver20: 0.1, fractionOver30: 0, samplePoints: 25, spacingMeters: 40 }, provenance: PROV },
      soils: { available: true, value: { hydricFraction: 0.1, severeFraction: 0.1, moderateFraction: 0.3, dominantRating: 'moderate' as const, soilTypeCounts: { Clay: 1 }, samplePoints: 400 }, provenance: PROV },
      stormwater: { available: true, value: { drainageDirection: 'flat', slopeTowardLowPoint: 0.2, hasPositiveOutfall: false, flatnessIndex: 1, estimatedDetentionSuitability: 'poor' as const, screeningLevel: 'challenging' as const, samplePoints: 25, spacingMeters: 40 }, provenance: PROV },
      easements: { available: true, value: { easementFraction: 0.05, easementTypes: ['UTILITY'], sourceLayer: 'County GIS', samplePoints: 400 }, provenance: PROV },
      contamination: { available: true, value: { facilityCount: 3, hasMajorFlag: false, facilityTypes: ['NPDES'], nearestName: 'Gas station', bufferMeters: 100, samplePoints: 400 }, provenance: PROV },
      netDevelopable: { grossAcres: 10, floodwayAcres: 0, wetlandAcres: 1.5, steepSlopeAcres: 1, soilConstrainedAcres: 2, easementAcres: 0.5, setbackAcres: 0.5, constrainedAcres: 5.5, netDevelopableAcres: 4.5, netToGrossRatio: 0.45, samplePoints: 400 },
    }),
    hazardsFixture({ wildfire: -1, radon: -1 }),
  )
}

// ── Archetype 4: poor parcel ───────────────────────────────────────────
// 40% SFHA, 35% wetlands, steep, dominantly severe soils, big easement
// bite, only a quarter of the land usable, incompatible zoning family, no
// mapped utilities, declining market, high combined hazard exposure.
function poorParcel(): SiteAnalysis {
  // Assessor-mapped GR (commercial family) zoning conflicts with the
  // residential intended use via the conservative district-family screen.
  const parcel: ParcelSelection = { status: 'found', message: 'matched', id: 'P-POOR', facts: { zoning: 'GR', municipality: 'Test City' }, provenance: PROV }
  return analyzeSite(
    COORDS,
    { ...EMPTY_SITE_INPUTS, acres: '10' },
    official({
      road: { available: true, value: { nearestDistanceMeters: 400, roadName: 'Dirt Rd', roadClass: 'Local' as const }, provenance: PROV },
      demographics: { available: true, value: { growthPercent: -7, currentPopulation: 9300, priorPopulation: 10000, geography: 'Tract 1' }, provenance: PROV },
      utilityService: { available: true, value: { inWaterServiceArea: false, pwsName: '', pwsId: '', boundaryMethod: 'modeled' as const, dataProviderType: 'Utility', dataSourceUrl: 'x' }, provenance: PROV },
      sewerService: { available: true, value: { inMappedSewershed: false, facilityName: '', cwnsId: '', npdesId: '', method: 'modeled' as const, source: 'EPA', echoUrl: 'x' }, provenance: PROV },
      bps: { available: true, value: { permitsPerThousand2023: 2, permitsPerThousand2024: 1.7, permitTrend: -12, totalPermits2024: 8, countyName: 'Rural County' }, provenance: PROV },
    }),
    true,
    overlaysFixture({
      floodplain: { available: true, value: { sfhaFraction: 0.4, floodwayFraction: 0, floodwayInCore: false, zoneSummary: 'AE', risk: 'High' as const, samplePoints: 400 }, provenance: PROV },
      wetlands: { available: true, value: { wetlandFraction: 0.35, wetlandTypeCounts: { PFO1: 1 }, samplePoints: 400 }, provenance: PROV },
      slope: { available: true, value: { meanSlopePercent: 24, p90SlopePercent: 35, maxSlopePercent: 45, fractionOver15: 0.6, fractionOver20: 0.45, fractionOver30: 0.2, samplePoints: 25, spacingMeters: 40 }, provenance: PROV },
      soils: { available: true, value: { hydricFraction: 0.3, severeFraction: 0.4, moderateFraction: 0.2, dominantRating: 'severe' as const, soilTypeCounts: { Muck: 1 }, samplePoints: 400 }, provenance: PROV },
      stormwater: { available: true, value: { drainageDirection: 'flat', slopeTowardLowPoint: 0.1, hasPositiveOutfall: false, flatnessIndex: 1, estimatedDetentionSuitability: 'poor' as const, screeningLevel: 'challenging' as const, samplePoints: 25, spacingMeters: 40 }, provenance: PROV },
      easements: { available: true, value: { easementFraction: 0.12, easementTypes: ['PIPELINE'], sourceLayer: 'County GIS', samplePoints: 400 }, provenance: PROV },
      contamination: { available: true, value: { facilityCount: 7, hasMajorFlag: false, facilityTypes: ['UST', 'NPDES'], nearestName: 'Salvage yard', bufferMeters: 100, samplePoints: 400 }, provenance: PROV },
      netDevelopable: { grossAcres: 10, floodwayAcres: 0, wetlandAcres: 3.5, steepSlopeAcres: 3, soilConstrainedAcres: 2, easementAcres: 1.2, setbackAcres: 0.5, constrainedAcres: 7.5, netDevelopableAcres: 2.5, netToGrossRatio: 0.25, samplePoints: 400 },
    }),
    hazardsFixture({ wildfire: -3, radon: -1 }),
    parcel,
  )
}

describe('score calibration — distribution across archetypes', () => {
  const prime = primeParcel()
  const average = averageParcel()
  const constrained = constrainedParcel()
  const poor = poorParcel()

  it('none of the archetypes trip a hard gate', () => {
    expect(prime.gatedToManual).toBe(false)
    expect(average.gatedToManual).toBe(false)
    expect(constrained.gatedToManual).toBe(false)
    expect(poor.gatedToManual).toBe(false)
  })

  it('a prime verified parcel reaches the strong band (75+)', () => {
    expect(prime.finalScore!).toBeGreaterThanOrEqual(75)
    expect(prime.verdictTone).toBe('strong')
  })

  it('an average parcel scores near 50', () => {
    expect(average.finalScore!).toBeGreaterThanOrEqual(45)
    expect(average.finalScore!).toBeLessThanOrEqual(55)
  })

  it('a constrained parcel scores in the high 30s to mid 40s', () => {
    expect(constrained.finalScore!).toBeGreaterThanOrEqual(33)
    expect(constrained.finalScore!).toBeLessThanOrEqual(45)
  })

  it('a poor parcel scores below 30', () => {
    expect(poor.finalScore!).toBeLessThanOrEqual(30)
    expect(poor.verdictTone).toBe('weak')
  })

  it('scores are strictly ordered with meaningful separation', () => {
    expect(prime.finalScore!).toBeGreaterThan(average.finalScore! + 10)
    expect(average.finalScore!).toBeGreaterThan(constrained.finalScore! + 5)
    expect(constrained.finalScore!).toBeGreaterThan(poor.finalScore! + 5)
  })
})
