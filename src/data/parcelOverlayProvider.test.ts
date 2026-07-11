import { describe, it, expect } from 'vitest'
import {
  computeSlopeFromElevations,
  computeStormwaterFromElevations,
  computeEasementsOverlayFromAdapter,
  computeBuildableEnvelope,
  computeNetDevelopable,
  computeSetbackOverlay,
  ringsToWkt,
  buildEasementsOverlay,
  type SharedElevations,
  type ParcelOverlayData,
  type EasementsOverlayInput,
} from './parcelOverlayProvider'
import { gridSampleBoundary, type GeoBoundary } from '../lib/geometry'

// A 1 km x 1 km square boundary centered on Austin. Area = ~24.7 acres.
const SQUARE_BOUNDARY: GeoBoundary = {
  type: 'Polygon',
  coordinates: [[
    [-97.7446, 30.2647], [-97.7334, 30.2647], [-97.7334, 30.2737], [-97.7446, 30.2737], [-97.7446, 30.2647],
  ]],
}

function makeGridPoints(boundary: GeoBoundary, rows = 5, cols = 5): { lng: number; lat: number; row: number; col: number }[] {
  // Reuse the production grid sampler for point-in-polygon-correct points.
  return gridSampleBoundary(boundary, rows * cols).points
}

describe('ringsToWkt', () => {
  it('formats a single-ring polygon as WKT', () => {
    const wkt = ringsToWkt([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]])
    expect(wkt).toBe('POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))')
  })

  it('formats a polygon with a hole as two rings', () => {
    const wkt = ringsToWkt([
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]],
    ])
    expect(wkt).toBe('POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0), (2 2, 4 2, 4 4, 2 4, 2 2))')
  })

  it('handles negative coordinates (US longitudes)', () => {
    const wkt = ringsToWkt([[[-97.74, 30.27], [-97.73, 30.27], [-97.73, 30.28], [-97.74, 30.28], [-97.74, 30.27]]])
    expect(wkt).toContain('-97.74 30.27')
  })
})

describe('computeSlopeFromElevations', () => {
  it('returns a low-slope result for a flat grid', () => {
    // 3x3 flat grid at elevation 150 m.
    const points = []
    for (let row = 0; row <= 2; row++) {
      for (let col = 0; col <= 2; col++) {
        points.push({ lng: -97.74 + col * 0.001, lat: 30.27 + row * 0.001, row, col })
      }
    }
    const grid = new Map<string, { lng: number; lat: number; elev: number }>()
    for (const p of points) grid.set(`${p.row},${p.col}`, { ...p, elev: 150 })
    const shared: SharedElevations = { points, spacingMeters: 100, elevations: points.map(() => 150), grid }
    const result = computeSlopeFromElevations(shared)
    expect(result.available).toBe(true)
    expect(result.value!.meanSlopePercent).toBe(0)
    expect(result.value!.maxSlopePercent).toBe(0)
    expect(result.value!.fractionOver20).toBe(0)
  })

  it('returns a steep-slope result when adjacent cells differ by >20% grade', () => {
    // 3x3 grid where the north row is 60 m higher than the south row.
    // 60 m / ~111 m = ~54% gradient between rows. Even when averaged with
    // the zero east-west gradient at corner cells, the max slope exceeds 20%.
    const points = []
    for (let row = 0; row <= 2; row++) {
      for (let col = 0; col <= 2; col++) {
        points.push({ lng: -97.74 + col * 0.001, lat: 30.27 + row * 0.001, row, col })
      }
    }
    const grid = new Map<string, { lng: number; lat: number; elev: number }>()
    for (const p of points) {
      const elev = p.row === 2 ? 270 : p.row === 1 ? 210 : 150
      grid.set(`${p.row},${p.col}`, { ...p, elev })
    }
    const shared: SharedElevations = { points, spacingMeters: 111, elevations: points.map((p) => grid.get(`${p.row},${p.col}`)!.elev), grid }
    const result = computeSlopeFromElevations(shared)
    expect(result.available).toBe(true)
    expect(result.value!.maxSlopePercent).toBeGreaterThan(20)
  })

  it('returns unavailable when fewer than 4 elevation samples are present', () => {
    const points = [{ lng: -97.74, lat: 30.27, row: 0, col: 0 }]
    const grid = new Map<string, { lng: number; lat: number; elev: number }>()
    grid.set('0,0', { lng: -97.74, lat: 30.27, elev: 150 })
    const shared: SharedElevations = { points, spacingMeters: 100, elevations: [150], grid }
    const result = computeSlopeFromElevations(shared)
    expect(result.available).toBe(false)
  })
})

describe('computeStormwaterFromElevations', () => {
  it('reports positive outfall when most cells sit above the parcel low point', () => {
    // 3x3 grid with a clear low point at the SW corner.
    const points = []
    for (let row = 0; row <= 2; row++) {
      for (let col = 0; col <= 2; col++) {
        points.push({ lng: -97.74 + col * 0.001, lat: 30.27 + row * 0.001, row, col })
      }
    }
    const grid = new Map<string, { lng: number; lat: number; elev: number }>()
    for (const p of points) {
      // Elevation increases to the NE; SW is the low point.
      const elev = 150 + p.row * 5 + p.col * 5
      grid.set(`${p.row},${p.col}`, { ...p, elev })
    }
    const shared: SharedElevations = { points, spacingMeters: 111, elevations: points.map((p) => grid.get(`${p.row},${p.col}`)!.elev), grid }
    const result = computeStormwaterFromElevations(shared)
    expect(result.available).toBe(true)
    expect(result.value!.hasPositiveOutfall).toBe(true)
    expect(['SW', 'S', 'W']).toContain(result.value!.drainageDirection)
  })

  it('reports no positive outfall when the parcel is perfectly flat', () => {
    const points = []
    for (let row = 0; row <= 2; row++) {
      for (let col = 0; col <= 2; col++) {
        points.push({ lng: -97.74 + col * 0.001, lat: 30.27 + row * 0.001, row, col })
      }
    }
    const grid = new Map<string, { lng: number; lat: number; elev: number }>()
    for (const p of points) grid.set(`${p.row},${p.col}`, { ...p, elev: 150 })
    const shared: SharedElevations = { points, spacingMeters: 111, elevations: points.map(() => 150), grid }
    const result = computeStormwaterFromElevations(shared)
    expect(result.available).toBe(true)
    expect(result.value!.hasPositiveOutfall).toBe(false)
    expect(result.value!.drainageDirection).toBe('Flat')
    expect(result.value!.flatnessIndex).toBe(1)
  })
})

describe('computeEasementsOverlayFromAdapter / buildEasementsOverlay', () => {
  const gridPoints = makeGridPoints(SQUARE_BOUNDARY)

  it('returns unavailable when no adapter result is supplied', () => {
    const result = buildEasementsOverlay(gridPoints, null)
    expect(result.available).toBe(false)
    expect(result.error).toContain('No local GIS easement adapter')
  })

  it('applies a 5% placeholder fraction when the adapter reports presence without polygon geometry', () => {
    const input: EasementsOverlayInput = {
      hasRecordedEasements: true,
      easementTypes: ['EASEMENT'],
      sourceLayer: 'Test parcel layer',
    }
    const result = computeEasementsOverlayFromAdapter(gridPoints, input)
    expect(result.available).toBe(true)
    expect(result.value!.easementFraction).toBe(0.05)
    expect(result.value!.easementTypes).toContain('EASEMENT')
  })

  it('reports zero fraction when the adapter reports no easements', () => {
    const input: EasementsOverlayInput = {
      hasRecordedEasements: false,
      easementTypes: ['none flag'],
      sourceLayer: 'Test parcel layer',
    }
    const result = computeEasementsOverlayFromAdapter(gridPoints, input)
    expect(result.available).toBe(true)
    expect(result.value!.easementFraction).toBe(0)
  })

  it('intersects returned easement polygons against the parcel grid', () => {
    // A polygon that covers the SW quadrant of the square boundary.
    const swQuadrantRing: number[][] = [
      [-97.7446, 30.2647], [-97.7390, 30.2647], [-97.7390, 30.2692], [-97.7446, 30.2692], [-97.7446, 30.2647],
    ]
    const input: EasementsOverlayInput = {
      hasRecordedEasements: true,
      easementTypes: ['ROW'],
      sourceLayer: 'Test parcel layer',
      polygonRings: [swQuadrantRing],
    }
    const result = computeEasementsOverlayFromAdapter(gridPoints, input)
    expect(result.available).toBe(true)
    expect(result.value!.easementFraction).toBeGreaterThan(0)
    expect(result.value!.easementFraction).toBeLessThan(1)
    expect(result.value!.easementTypes).toContain('ROW')
  })
})

describe('computeNetDevelopable', () => {
  function makeOverlays(overrides: Partial<ParcelOverlayData> = {}): ParcelOverlayData {
    return {
      floodplain: { available: true, value: { sfhaFraction: 0, floodwayFraction: 0, floodwayInCore: false, zoneSummary: 'X', risk: 'Low', samplePoints: 400 }, provenance: { source: 'FEMA', sourceUrl: 'x' } },
      wetlands: { available: true, value: { wetlandFraction: 0, wetlandTypeCounts: {}, samplePoints: 400 }, provenance: { source: 'NWI', sourceUrl: 'x' } },
      slope: { available: true, value: { meanSlopePercent: 3, p90SlopePercent: 5, maxSlopePercent: 8, fractionOver15: 0, fractionOver20: 0, fractionOver30: 0, samplePoints: 25, spacingMeters: 40 }, provenance: { source: 'USGS', sourceUrl: 'x' } },
      soils: { available: true, value: { hydricFraction: 0, severeFraction: 0, moderateFraction: 0, dominantRating: 'slight', soilTypeCounts: {}, samplePoints: 400 }, provenance: { source: 'NRCS', sourceUrl: 'x' } },
      stormwater: { available: true, value: { drainageDirection: 'S', slopeTowardLowPoint: 2.5, hasPositiveOutfall: true, flatnessIndex: 0.6, estimatedDetentionSuitability: 'good', screeningLevel: 'good', samplePoints: 25, spacingMeters: 40 }, provenance: { source: 'USGS', sourceUrl: 'x' } },
      easements: { available: true, value: { easementFraction: 0, easementTypes: [], sourceLayer: 'test', samplePoints: 400 }, provenance: { source: 'Local GIS', sourceUrl: 'x' } },
      contamination: { available: true, value: { facilityCount: 0, hasMajorFlag: false, facilityTypes: [], nearestName: '', bufferMeters: 100, samplePoints: 400 }, provenance: { source: 'EPA FRS', sourceUrl: 'x' } },
      species: { available: true, value: { criticalHabitatHit: false, criticalHabitatLayers: [], speciesCount: 0, habitatFraction: 0, samplePoints: 400 }, provenance: { source: 'USFWS ECOS', sourceUrl: 'x' } },
      setback: { available: true, value: { setbackFraction: 0, setbackDistanceMeters: 7.6, frontSetbackMeters: 7.6, sideSetbackMeters: 3.0, rearSetbackMeters: 7.6, intendedUse: 'residential', samplePoints: 400 }, provenance: { source: 'Setback', sourceUrl: 'x' } },
      buildableEnvelope: { available: false, provenance: { source: 'LandLens', sourceUrl: '' }, error: 'Not computed' },
      netDevelopable: null,
      fetchedAt: new Date().toISOString(),
      ...overrides,
    }
  }

  it('returns null for a zero-area boundary', () => {
    const degenerate: GeoBoundary = { type: 'Polygon', coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0]]] }
    expect(computeNetDevelopable(degenerate, makeOverlays())).toBeNull()
  })

  it('returns full net developable when no constraints are present', () => {
    const nd = computeNetDevelopable(SQUARE_BOUNDARY, makeOverlays())
    expect(nd).not.toBeNull()
    expect(nd!.netToGrossRatio).toBe(1)
    expect(nd!.constrainedAcres).toBe(0)
    expect(nd!.soilConstrainedAcres).toBe(0)
    expect(nd!.easementAcres).toBe(0)
  })

  it('counts overlapping spatial constraints once in the shared-grid union', () => {
    const total = gridSampleBoundary(SQUARE_BOUNDARY, 400).points.length
    const overlappingMask = Array.from({ length: Math.min(40, total) }, (_, index) => index)
    const overlays = makeOverlays({
      floodplain: { available: true, value: { sfhaFraction: 0.2, floodwayFraction: overlappingMask.length / total, floodwayInCore: true, zoneSummary: 'AE', risk: 'Floodway', samplePoints: total, constrainedGridIndices: overlappingMask }, provenance: { source: 'FEMA', sourceUrl: 'x' } },
      wetlands: { available: true, value: { wetlandFraction: overlappingMask.length / total, wetlandTypeCounts: {}, samplePoints: total, constrainedGridIndices: overlappingMask }, provenance: { source: 'NWI', sourceUrl: 'x' } },
      setback: { available: true, value: { setbackFraction: 0, setbackDistanceMeters: 7.6, frontSetbackMeters: 7.6, sideSetbackMeters: 3, rearSetbackMeters: 7.6, intendedUse: 'residential', samplePoints: total, constrainedGridIndices: [] }, provenance: { source: 'Setback', sourceUrl: 'x' } },
    })
    const envelope = computeBuildableEnvelope(SQUARE_BOUNDARY, overlays)
    const withEnvelope = { ...overlays, buildableEnvelope: envelope }
    const nd = computeNetDevelopable(SQUARE_BOUNDARY, withEnvelope)

    expect(envelope.available).toBe(true)
    expect(envelope.value!.spatialConstraintFraction).toBeCloseTo(overlappingMask.length / total, 3)
    expect(envelope.value!.buildableCellCount).toBe(total - overlappingMask.length)
    expect(envelope.value!.geometry.coordinates).toHaveLength(total - overlappingMask.length)
    expect(nd!.method).toBe('shared-grid-union')
    expect(nd!.netToGrossRatio).toBeCloseTo(1 - overlappingMask.length / total, 2)
  })

  it('applies non-spatial soil shares after the exact spatial union', () => {
    const total = gridSampleBoundary(SQUARE_BOUNDARY, 400).points.length
    const spatialMask = Array.from({ length: Math.min(40, total) }, (_, index) => index)
    const overlays = makeOverlays({
      floodplain: { available: true, value: { sfhaFraction: 0, floodwayFraction: spatialMask.length / total, floodwayInCore: true, zoneSummary: 'AE', risk: 'Floodway', samplePoints: total, constrainedGridIndices: spatialMask }, provenance: { source: 'FEMA', sourceUrl: 'x' } },
      soils: { available: true, value: { hydricFraction: 0.2, severeFraction: 0.1, moderateFraction: 0, dominantRating: 'severe', soilTypeCounts: {}, samplePoints: total }, provenance: { source: 'NRCS', sourceUrl: 'x' } },
    })
    const envelope = computeBuildableEnvelope(SQUARE_BOUNDARY, overlays)
    const spatialRatio = 1 - spatialMask.length / total

    expect(envelope.value!.aggregateAdjustmentFraction).toBe(0.2)
    expect(envelope.value!.aggregateAdjustments).toContain('NRCS hydric/severe soil share')
    expect(envelope.value!.adjustedNetAcres).toBeCloseTo(envelope.value!.spatialBuildableAcres * 0.8, 1)
    expect(envelope.value!.adjustedNetAcres / (envelope.value!.spatialBuildableAcres / spatialRatio)).toBeCloseTo(spatialRatio * 0.8, 2)
  })

  it('subtracts floodway fraction from net developable', () => {
    const overlays = makeOverlays({
      floodplain: { available: true, value: { sfhaFraction: 0.5, floodwayFraction: 0.2, floodwayInCore: true, zoneSummary: 'AE', risk: 'Floodway', samplePoints: 400 }, provenance: { source: 'FEMA', sourceUrl: 'x' } },
    })
    const nd = computeNetDevelopable(SQUARE_BOUNDARY, overlays)
    expect(nd!.floodwayAcres).toBeCloseTo(nd!.grossAcres * 0.2, 1)
    expect(nd!.netToGrossRatio).toBeLessThan(1)
  })

  it('subtracts hydric/severe soils using the max of the two fractions', () => {
    const overlays = makeOverlays({
      soils: { available: true, value: { hydricFraction: 0.3, severeFraction: 0.4, moderateFraction: 0.1, dominantRating: 'severe', soilTypeCounts: {}, samplePoints: 400 }, provenance: { source: 'NRCS', sourceUrl: 'x' } },
    })
    const nd = computeNetDevelopable(SQUARE_BOUNDARY, overlays)
    // Soil constraint uses max(hydric, severe) = 0.4
    expect(nd!.soilConstrainedAcres).toBeCloseTo(nd!.grossAcres * 0.4, 1)
  })

  it('subtracts easement fraction from net developable', () => {
    const overlays = makeOverlays({
      easements: { available: true, value: { easementFraction: 0.1, easementTypes: ['EASEMENT'], sourceLayer: 'test', samplePoints: 400 }, provenance: { source: 'Local GIS', sourceUrl: 'x' } },
    })
    const nd = computeNetDevelopable(SQUARE_BOUNDARY, overlays)
    expect(nd!.easementAcres).toBeCloseTo(nd!.grossAcres * 0.1, 1)
  })

  it('applies the 5-factor independence approximation for the union', () => {
    // Set every constraint to 0.2. Independence approximation gives
    // 1 - (1-0.2)^5 = 1 - 0.32768 = 0.67232.
    const overlays = makeOverlays({
      floodplain: { available: true, value: { sfhaFraction: 0, floodwayFraction: 0.2, floodwayInCore: true, zoneSummary: 'AE', risk: 'Floodway', samplePoints: 400 }, provenance: { source: 'FEMA', sourceUrl: 'x' } },
      wetlands: { available: true, value: { wetlandFraction: 0.2, wetlandTypeCounts: {}, samplePoints: 400 }, provenance: { source: 'NWI', sourceUrl: 'x' } },
      slope: { available: true, value: { meanSlopePercent: 10, p90SlopePercent: 18, maxSlopePercent: 22, fractionOver15: 0.3, fractionOver20: 0.2, fractionOver30: 0, samplePoints: 25, spacingMeters: 40 }, provenance: { source: 'USGS', sourceUrl: 'x' } },
      soils: { available: true, value: { hydricFraction: 0.2, severeFraction: 0.2, moderateFraction: 0, dominantRating: 'severe', soilTypeCounts: {}, samplePoints: 400 }, provenance: { source: 'NRCS', sourceUrl: 'x' } },
      easements: { available: true, value: { easementFraction: 0.2, easementTypes: ['EASEMENT'], sourceLayer: 'test', samplePoints: 400 }, provenance: { source: 'Local GIS', sourceUrl: 'x' } },
    })
    const nd = computeNetDevelopable(SQUARE_BOUNDARY, overlays)
    const expectedFraction = 1 - Math.pow(0.8, 5)
    expect(nd!.constrainedAcres).toBeCloseTo(nd!.grossAcres * expectedFraction, 1)
    expect(nd!.netToGrossRatio).toBeCloseTo(1 - expectedFraction, 2)
  })

  it('does not subtract contamination or critical habitat from net developable', () => {
    // Even with a major contamination flag + 50% critical habitat coverage,
    // the constrained acres should only reflect the 6 land-use constraints
    // (here all zero), not the gates.
    const overlays = makeOverlays({
      contamination: { available: true, value: { facilityCount: 3, hasMajorFlag: true, facilityTypes: ['RCRA'], nearestName: 'Acme', bufferMeters: 100, samplePoints: 400 }, provenance: { source: 'EPA FRS', sourceUrl: 'x' } },
      species: { available: true, value: { criticalHabitatHit: true, criticalHabitatLayers: ['Warbler'], speciesCount: 1, habitatFraction: 0.5, samplePoints: 400 }, provenance: { source: 'USFWS ECOS', sourceUrl: 'x' } },
    })
    const nd = computeNetDevelopable(SQUARE_BOUNDARY, overlays)
    expect(nd!.constrainedAcres).toBe(0)
    expect(nd!.netToGrossRatio).toBe(1)
  })

  it('subtracts setback fraction from net developable', () => {
    const overlays = makeOverlays({
      setback: { available: true, value: { setbackFraction: 0.15, setbackDistanceMeters: 15.2, frontSetbackMeters: 15.2, sideSetbackMeters: 6.1, rearSetbackMeters: 9.1, intendedUse: 'commercial', samplePoints: 400 }, provenance: { source: 'Setback', sourceUrl: 'x' } },
    })
    const nd = computeNetDevelopable(SQUARE_BOUNDARY, overlays)
    expect(nd!.setbackAcres).toBeCloseTo(nd!.grossAcres * 0.15, 1)
    expect(nd!.netToGrossRatio).toBeLessThan(1)
  })

  it('applies the 6-factor independence approximation for the union including setbacks', () => {
    // Set every constraint including setback to 0.15.
    // Independence approximation: 1 - (1-0.15)^6 = 1 - 0.85^6 ≈ 0.6228
    const overlays = makeOverlays({
      floodplain: { available: true, value: { sfhaFraction: 0, floodwayFraction: 0.15, floodwayInCore: true, zoneSummary: 'AE', risk: 'Floodway', samplePoints: 400 }, provenance: { source: 'FEMA', sourceUrl: 'x' } },
      wetlands: { available: true, value: { wetlandFraction: 0.15, wetlandTypeCounts: {}, samplePoints: 400 }, provenance: { source: 'NWI', sourceUrl: 'x' } },
      slope: { available: true, value: { meanSlopePercent: 10, p90SlopePercent: 18, maxSlopePercent: 22, fractionOver15: 0.2, fractionOver20: 0.15, fractionOver30: 0, samplePoints: 25, spacingMeters: 40 }, provenance: { source: 'USGS', sourceUrl: 'x' } },
      soils: { available: true, value: { hydricFraction: 0.15, severeFraction: 0.15, moderateFraction: 0, dominantRating: 'severe', soilTypeCounts: {}, samplePoints: 400 }, provenance: { source: 'NRCS', sourceUrl: 'x' } },
      easements: { available: true, value: { easementFraction: 0.15, easementTypes: ['EASEMENT'], sourceLayer: 'test', samplePoints: 400 }, provenance: { source: 'Local GIS', sourceUrl: 'x' } },
      setback: { available: true, value: { setbackFraction: 0.15, setbackDistanceMeters: 7.6, frontSetbackMeters: 7.6, sideSetbackMeters: 3.0, rearSetbackMeters: 7.6, intendedUse: 'residential', samplePoints: 400 }, provenance: { source: 'Setback', sourceUrl: 'x' } },
    })
    const nd = computeNetDevelopable(SQUARE_BOUNDARY, overlays)
    const expectedFraction = 1 - Math.pow(0.85, 6)
    expect(nd!.constrainedAcres).toBeCloseTo(nd!.grossAcres * expectedFraction, 1)
    expect(nd!.netToGrossRatio).toBeCloseTo(1 - expectedFraction, 2)
  })
})

describe('computeSetbackOverlay', () => {
  // Use the ScreeningArea boundary type (type + coordinates) not just the
  // coordinates array.
  const boundary = SQUARE_BOUNDARY as unknown as NonNullable<import('../types/site').ScreeningArea['boundary']>

  it('computes a nonzero setback fraction for a real parcel boundary', () => {
    const result = computeSetbackOverlay(boundary, 'residential')
    expect(result.available).toBe(true)
    expect(result.value!.setbackFraction).toBeGreaterThan(0)
    expect(result.value!.setbackDistanceMeters).toBe(7.6) // max of 25/10/25 ft for residential
    expect(result.value!.frontSetbackMeters).toBe(7.6)   // 25 ft front
    expect(result.value!.sideSetbackMeters).toBe(3.0)    // 10 ft side
    expect(result.value!.rearSetbackMeters).toBe(7.6)    // 25 ft rear
    expect(result.value!.intendedUse).toBe('residential')
  })

  it('uses a larger setback distance for industrial intended use', () => {
    const residential = computeSetbackOverlay(boundary, 'residential')
    const industrial = computeSetbackOverlay(boundary, 'industrial')
    expect(industrial.value!.setbackDistanceMeters).toBeGreaterThan(residential.value!.setbackDistanceMeters)
    expect(industrial.value!.setbackFraction).toBeGreaterThanOrEqual(residential.value!.setbackFraction)
  })

  it('replaces generic distances with jurisdiction base standards and provenance', () => {
    const result = computeSetbackOverlay(boundary, 'residential', { lng: -97.744, lat: 30.269 }, {
      frontFeet: 25,
      sideFeet: 5,
      rearFeet: 10,
      district: 'SF-3',
      authority: 'City of Austin',
      sourceUrl: 'https://example.test/code',
      sourceSection: 'Austin LDC §25-2-492',
    })
    expect(result.available).toBe(true)
    expect(result.value!.standardsSource).toBe('jurisdiction-code')
    expect(result.value!.frontSetbackMeters).toBeCloseTo(7.62, 2)
    expect(result.value!.sideSetbackMeters).toBeCloseTo(1.524, 3)
    expect(result.value!.rearSetbackMeters).toBeCloseTo(3.048, 3)
    expect(result.provenance.source).toContain('SF-3')
    expect(result.provenance.vintage).toBe('Austin LDC §25-2-492')
  })
})
