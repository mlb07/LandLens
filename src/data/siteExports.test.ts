import { describe, expect, it } from 'vitest'
import { analyzeSite } from '../lib/scoring'
import { EMPTY_SITE_INPUTS, type SavedSite } from '../types/site'
import { sitesToCsv, sitesToGeoJson } from './siteExports'

const boundary = {
  type: 'Polygon' as const,
  coordinates: [[[-97.75, 30.26], [-97.74, 30.26], [-97.74, 30.27], [-97.75, 30.27], [-97.75, 30.26]]],
}

function site(): SavedSite {
  const inputs = { ...EMPTY_SITE_INPUTS, name: 'North, "Test" Tract', intendedUse: 'mixed-use' as const, acres: '12.5' }
  return {
    id: 'site-1', stateCode: 'TX', coordinates: { lat: 30.265, lng: -97.745 }, inputs,
    analysis: analyzeSite({ lat: 30.265, lng: -97.745 }, inputs),
    screeningArea: { kind: 'parcel', boundary },
    parcel: { id: 'parcel-1', provenance: { source: 'Test assessor', sourceUrl: 'https://example.test' } },
    buildableEnvelope: {
      geometry: { type: 'MultiPolygon', coordinates: [[boundary.coordinates[0]]] },
      spatialBuildableAcres: 10, adjustedNetAcres: 9.5, spatialConstraintFraction: 0.2,
      aggregateAdjustmentFraction: 0.05, buildableCellCount: 80, totalCellCount: 100,
      resolutionMeters: 12, includedConstraints: ['Floodway'], aggregateAdjustments: ['Soils'], method: 'shared-grid-union',
    },
    createdAt: '2026-07-11T00:00:00.000Z', updatedAt: '2026-07-11T00:00:00.000Z',
  }
}

describe('site exports', () => {
  it('exports portfolio fields and safely quotes CSV values', () => {
    const csv = sitesToCsv([site()])
    expect(csv).toContain('adjusted_net_acres')
    expect(csv).toContain('shared-grid-union')
    expect(csv).toContain('"North, ""Test"" Tract"')
    expect(csv).toContain('9.5')
  })

  it('exports point, parcel, and buildable-envelope GeoJSON features', () => {
    const geojson = sitesToGeoJson([site()])
    expect(geojson.features).toHaveLength(3)
    expect(geojson.features.map((feature) => feature.properties?.featureType)).toEqual([
      'site-point', 'parcel-boundary', 'screening-buildable-envelope',
    ])
    expect(geojson.features[2].geometry.type).toBe('MultiPolygon')
  })
})

