import { describe, it, expect } from 'vitest'
import {
  pointInBoundary,
  gridSampleBoundary,
  boundaryBBox,
  boundaryAreaSquareMeters,
  squareMetersToAcres,
  acresToSquareMeters,
  boundaryToArcGISPolygon,
  boundaryToNearestRoadMeters,
  type GeoBoundary,
} from './geometry'

const square: GeoBoundary = {
  type: 'Polygon',
  coordinates: [[[-97.0, 30.0], [-96.9, 30.0], [-96.9, 30.1], [-97.0, 30.1], [-97.0, 30.0]]],
}

const squareWithHole: GeoBoundary = {
  type: 'Polygon',
  coordinates: [
    square.coordinates[0],
    [[-96.97, 30.02], [-96.93, 30.02], [-96.93, 30.08], [-96.97, 30.08], [-96.97, 30.02]],
  ],
}

const multiPolygon: GeoBoundary = {
  type: 'MultiPolygon',
  coordinates: [
    square.coordinates,
    [[[-96.8, 30.0], [-96.7, 30.0], [-96.7, 30.1], [-96.8, 30.1], [-96.8, 30.0]]],
  ],
}

describe('pointInBoundary', () => {
  it('returns true for a point inside a simple polygon', () => {
    expect(pointInBoundary(-96.95, 30.05, square)).toBe(true)
  })

  it('returns false for a point outside a simple polygon', () => {
    expect(pointInBoundary(-96.8, 30.05, square)).toBe(false)
  })

  it('returns true for a point on the corner', () => {
    expect(pointInBoundary(-97.0, 30.0, square)).toBe(true)
  })

  it('returns false for a point inside a hole', () => {
    expect(pointInBoundary(-96.95, 30.05, squareWithHole)).toBe(false)
  })

  it('returns true for a point in the shell but outside the hole', () => {
    expect(pointInBoundary(-96.95, 30.01, squareWithHole)).toBe(true)
  })

  it('returns true for a point inside the first polygon of a MultiPolygon', () => {
    expect(pointInBoundary(-96.95, 30.05, multiPolygon)).toBe(true)
  })

  it('returns true for a point inside the second polygon of a MultiPolygon', () => {
    expect(pointInBoundary(-96.75, 30.05, multiPolygon)).toBe(true)
  })

  it('returns false for a point outside both polygons of a MultiPolygon', () => {
    expect(pointInBoundary(-96.85, 30.05, multiPolygon)).toBe(false)
  })
})

describe('boundaryBBox', () => {
  it('computes correct bbox for a polygon', () => {
    const bbox = boundaryBBox(square)
    expect(bbox).toEqual({ west: -97.0, south: 30.0, east: -96.9, north: 30.1 })
  })

  it('computes correct bbox for a MultiPolygon spanning both parts', () => {
    const bbox = boundaryBBox(multiPolygon)
    expect(bbox).toEqual({ west: -97.0, south: 30.0, east: -96.7, north: 30.1 })
  })
})

describe('boundaryAreaSquareMeters', () => {
  it('computes a positive area for a polygon', () => {
    const area = boundaryAreaSquareMeters(square)
    expect(area).toBeGreaterThan(0)
    // ~0.1 degree square at lat 30 → roughly 26,500 acres
    expect(squareMetersToAcres(area)).toBeGreaterThan(20000)
  })

  it('reduces area when a hole is present', () => {
    const fullArea = boundaryAreaSquareMeters(square)
    const holeArea = boundaryAreaSquareMeters(squareWithHole)
    expect(holeArea).toBeLessThan(fullArea)
  })

  it('doubles area for a two-part MultiPolygon', () => {
    const oneArea = boundaryAreaSquareMeters(square)
    const twoArea = boundaryAreaSquareMeters(multiPolygon)
    expect(twoArea).toBeGreaterThan(oneArea * 1.9)
  })
})

describe('squareMetersToAcres / acresToSquareMeters', () => {
  it('round-trips correctly', () => {
    const acres = 10
    expect(squareMetersToAcres(acresToSquareMeters(acres))).toBeCloseTo(acres, 5)
  })
})

describe('gridSampleBoundary', () => {
  it('generates points inside the boundary', () => {
    const { points, spacingMeters } = gridSampleBoundary(square, 25)
    expect(points.length).toBeGreaterThan(0)
    expect(spacingMeters).toBeGreaterThan(0)
    // All points should be inside the square
    for (const pt of points) {
      expect(pointInBoundary(pt.lng, pt.lat, square)).toBe(true)
    }
  })
})

describe('boundaryToArcGISPolygon', () => {
  it('produces correct ArcGIS polygon JSON', () => {
    const arcgis = boundaryToArcGISPolygon(square)
    expect(arcgis.spatialReference.wkid).toBe(4326)
    expect(arcgis.rings).toHaveLength(1)
    expect(arcgis.rings[0]).toEqual(square.coordinates[0])
  })

  it('flattens MultiPolygon rings into a single rings array', () => {
    const arcgis = boundaryToArcGISPolygon(multiPolygon)
    expect(arcgis.rings).toHaveLength(2)
  })
})

describe('boundaryToNearestRoadMeters', () => {
  // A ~110 m square parcel near the equator (1° lat ≈ 110.5 km).
  const parcel: GeoBoundary = {
    type: 'Polygon',
    coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]],
  }

  it('measures the nearest-boundary distance to a road running outside the parcel', () => {
    // Horizontal road ~110 m north of the top edge (lat 0.001 → 0.002).
    const road = [[[-0.001, 0.002], [0.002, 0.002]]]
    const { meters, touches } = boundaryToNearestRoadMeters(parcel, road)
    expect(meters).toBeGreaterThan(95)
    expect(meters).toBeLessThan(125)
    expect(touches).toBe(false)
  })

  it('flags frontage when a road runs within a few meters of the boundary', () => {
    // Road ~4 m north of the top edge (lat 0.001 → 0.00104).
    const road = [[[-0.001, 0.00104], [0.002, 0.00104]]]
    const { meters, touches } = boundaryToNearestRoadMeters(parcel, road)
    expect(meters).toBeLessThan(6)
    expect(touches).toBe(true)
  })

  it('returns zero when a road bisects the parcel between boundary vertices', () => {
    // Vertical road through the middle; both road vertices are outside.
    const road = [[[0.0005, -0.001], [0.0005, 0.002]]]
    const { meters, touches } = boundaryToNearestRoadMeters(parcel, road)
    expect(meters).toBe(0)
    expect(touches).toBe(true)
  })

  it('returns zero when a road vertex sits inside the parcel', () => {
    const road = [[[0.0005, 0.0005], [0.0005, 0.01]]]
    const { meters, touches } = boundaryToNearestRoadMeters(parcel, road)
    expect(meters).toBe(0)
    expect(touches).toBe(true)
  })
})
