// GeoJSON boundary types used across the app.
export type GeoPolygon = { type: 'Polygon'; coordinates: number[][][] }
export type GeoMultiPolygon = { type: 'MultiPolygon'; coordinates: number[][][][] }
export type GeoBoundary = GeoPolygon | GeoMultiPolygon

// Ray-casting point-in-polygon test for a single ring.
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// Point-in-polygon test respecting holes. A point is inside the polygon if it
// is inside the outer ring AND not inside any hole.
function pointInPolygon(lng: number, lat: number, polygon: number[][][]): boolean {
  if (!polygon.length) return false
  if (!pointInRing(lng, lat, polygon[0])) return false
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(lng, lat, polygon[i])) return false
  }
  return true
}

export function pointInBoundary(lng: number, lat: number, boundary: GeoBoundary): boolean {
  if (boundary.type === 'Polygon') return pointInPolygon(lng, lat, boundary.coordinates)
  return boundary.coordinates.some((polygon) => pointInPolygon(lng, lat, polygon))
}

export interface BBox { west: number; south: number; east: number; north: number }

export function boundaryBBox(boundary: GeoBoundary): BBox {
  let west = Number.POSITIVE_INFINITY, south = Number.POSITIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY, north = Number.NEGATIVE_INFINITY
  const rings = boundary.type === 'Polygon' ? [boundary.coordinates[0]] : boundary.coordinates.map((p) => p[0])
  for (const ring of rings) {
    if (!ring) continue
    for (const [lng, lat] of ring) {
      if (lng < west) west = lng
      if (lat < south) south = lat
      if (lng > east) east = lng
      if (lat > north) north = lat
    }
  }
  return { west, south, east, north }
}

export interface GridPoint {
  lng: number
  lat: number
  row: number
  col: number
}

// Generate a grid of points inside the boundary. The grid is spaced to target
// roughly `targetPoints` interior samples. Returns both the grid and the
// spacing in meters for slope calculations.
export function gridSampleBoundary(boundary: GeoBoundary, targetPoints = 25): { points: GridPoint[]; spacingMeters: number } {
  const bbox = boundaryBBox(boundary)
  const latCenter = (bbox.north + bbox.south) / 2
  const latMeters = (bbox.north - bbox.south) * 110_540
  const lngMeters = (bbox.east - bbox.west) * 111_320 * Math.cos(latCenter * Math.PI / 180)
  const aspect = lngMeters / latMeters
  const rows = Math.max(2, Math.round(Math.sqrt(targetPoints / aspect)))
  const cols = Math.max(2, Math.round(Math.sqrt(targetPoints * aspect)))
  const dLat = (bbox.north - bbox.south) / rows
  const dLng = (bbox.east - bbox.west) / cols
  const spacingMeters = Math.sqrt((dLat * 110_540) ** 2 + (dLng * 111_320 * Math.cos(latCenter * Math.PI / 180)) ** 2)
  const points: GridPoint[] = []
  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= cols; col += 1) {
      const lng = bbox.west + col * dLng
      const lat = bbox.south + row * dLat
      if (pointInBoundary(lng, lat, boundary)) points.push({ lng, lat, row, col })
    }
  }
  return { points, spacingMeters }
}

// Sphere-based polygon ring area (square meters) — same algorithm as the
// existing parcelProvider implementation, extracted here for reuse.
export function ringAreaSquareMeters(ring: number[][]): number {
  if (ring.length < 3) return 0
  const radius = 6_378_137
  const radians = Math.PI / 180
  let total = 0
  for (let index = 0; index < ring.length; index += 1) {
    const lower = ring[(index + ring.length - 1) % ring.length]
    const middle = ring[index]
    const upper = ring[(index + ring.length + 1) % ring.length]
    total += (upper[0] - lower[0]) * radians * Math.sin(middle[1] * radians)
  }
  return Math.abs(total * radius * radius / 2)
}

export function boundaryAreaSquareMeters(boundary: GeoBoundary): number {
  const polygonArea = (polygon: number[][][]) => {
    const outer = ringAreaSquareMeters(polygon[0] || [])
    const holes = polygon.slice(1).reduce((sum, ring) => sum + ringAreaSquareMeters(ring), 0)
    return Math.max(0, outer - holes)
  }
  return boundary.type === 'Polygon'
    ? polygonArea(boundary.coordinates)
    : boundary.coordinates.reduce((sum, polygon) => sum + polygonArea(polygon), 0)
}

export function squareMetersToAcres(m2: number): number {
  return m2 / 4_046.8564224
}

export function acresToSquareMeters(acres: number): number {
  return acres * 4_046.8564224
}

// Convert a GeoJSON boundary to ArcGIS REST polygon JSON for query geometry.
export function boundaryToArcGISPolygon(boundary: GeoBoundary): { rings: number[][][]; spatialReference: { wkid: number } } {
  const rings: number[][][] = []
  if (boundary.type === 'Polygon') {
    for (const ring of boundary.coordinates) rings.push(ring)
  } else {
    for (const polygon of boundary.coordinates) {
      for (const ring of polygon) rings.push(ring)
    }
  }
  return { rings, spatialReference: { wkid: 4326 } }
}

// ─── Setback distance computation ──────────────────────────────────────
//
// For setback overlays we need the distance from each interior grid point
// to the nearest parcel boundary edge. We use a flat-earth approximation
// (good enough at the sub-km scale of a parcel) converting lat/lng to
// meters using the local latitude cosine.

// Haversine distance between two lng/lat points in meters.
function haversineMeters(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6_371_000
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLng = (lng2 - lng1) * toRad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Shortest distance from a point to a line segment (in lng/lat space, then
// converted to meters using the local cosine). Uses the standard projection
// of the point onto the segment parameterised t ∈ [0,1].
export function pointToSegmentMeters(lng: number, lat: number, segStart: number[], segEnd: number[]): number {
  const dx = segEnd[0] - segStart[0]
  const dy = segEnd[1] - segStart[1]
  if (dx === 0 && dy === 0) {
    return haversineMeters(lng, lat, segStart[0], segStart[1])
  }
  let t = ((lng - segStart[0]) * dx + (lat - segStart[1]) * dy) / (dx * dx + dy * dy)
  t = Math.max(0, Math.min(1, t))
  const projLng = segStart[0] + t * dx
  const projLat = segStart[1] + t * dy
  return haversineMeters(lng, lat, projLng, projLat)
}

// Shortest distance from a point to the nearest edge of a GeoBoundary
// (in meters). For a Polygon, checks the outer ring and all holes. For a
// MultiPolygon, checks every ring of every polygon. Returns 0 if the
// point is outside the boundary (already constrained by other means).
export function pointToBoundaryDistanceMeters(lng: number, lat: number, boundary: GeoBoundary): number {
  const rings: number[][][] = []
  if (boundary.type === 'Polygon') {
    for (const ring of boundary.coordinates) rings.push(ring)
  } else {
    for (const polygon of boundary.coordinates) {
      for (const ring of polygon) rings.push(ring)
    }
  }
  let minDist = Number.POSITIVE_INFINITY
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i += 1) {
      const d = pointToSegmentMeters(lng, lat, ring[i], ring[i + 1])
      if (d < minDist) minDist = d
    }
    // Close the ring if it's not already closed.
    if (ring.length > 1) {
      const last = ring[ring.length - 1]
      const first = ring[0]
      if (last[0] !== first[0] || last[1] !== first[1]) {
        const d = pointToSegmentMeters(lng, lat, last, first)
        if (d < minDist) minDist = d
      }
    }
  }
  return minDist === Number.POSITIVE_INFINITY ? 0 : minDist
}
