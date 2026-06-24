import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import stateTopology from './us-states-10m.json'
import type { Coordinates } from '../types/site'

export type StateCode = typeof stateDefinitions[number]['code']

interface TopologyGeometry {
  id: string
  type: 'Polygon' | 'MultiPolygon'
  arcs: number[][] | number[][][]
  properties: { name: string }
}

interface StateTopology {
  transform: { scale: [number, number]; translate: [number, number] }
  arcs: number[][][]
  objects: { states: { geometries: TopologyGeometry[] } }
}

export interface StateDefinition {
  code: string
  fips: string
  name: string
  center: Coordinates
  maxFitZoom?: number
}

export const stateDefinitions = [
  { code: 'AL', fips: '01', name: 'Alabama', center: { lat: 32.3777, lng: -86.3006 } },
  { code: 'AK', fips: '02', name: 'Alaska', center: { lat: 58.3019, lng: -134.4197 }, maxFitZoom: 4 },
  { code: 'AZ', fips: '04', name: 'Arizona', center: { lat: 33.4484, lng: -112.074 } },
  { code: 'AR', fips: '05', name: 'Arkansas', center: { lat: 34.7465, lng: -92.2896 } },
  { code: 'CA', fips: '06', name: 'California', center: { lat: 38.5816, lng: -121.4944 } },
  { code: 'CO', fips: '08', name: 'Colorado', center: { lat: 39.7392, lng: -104.9903 } },
  { code: 'CT', fips: '09', name: 'Connecticut', center: { lat: 41.7658, lng: -72.6734 }, maxFitZoom: 8 },
  { code: 'DE', fips: '10', name: 'Delaware', center: { lat: 39.1582, lng: -75.5244 }, maxFitZoom: 8 },
  { code: 'FL', fips: '12', name: 'Florida', center: { lat: 30.4383, lng: -84.2807 } },
  { code: 'GA', fips: '13', name: 'Georgia', center: { lat: 33.749, lng: -84.388 } },
  { code: 'HI', fips: '15', name: 'Hawaii', center: { lat: 21.3099, lng: -157.8581 }, maxFitZoom: 7 },
  { code: 'ID', fips: '16', name: 'Idaho', center: { lat: 43.615, lng: -116.2023 } },
  { code: 'IL', fips: '17', name: 'Illinois', center: { lat: 39.7983, lng: -89.6544 } },
  { code: 'IN', fips: '18', name: 'Indiana', center: { lat: 39.7684, lng: -86.1581 } },
  { code: 'IA', fips: '19', name: 'Iowa', center: { lat: 41.5868, lng: -93.625 } },
  { code: 'KS', fips: '20', name: 'Kansas', center: { lat: 39.0473, lng: -95.6752 } },
  { code: 'KY', fips: '21', name: 'Kentucky', center: { lat: 38.2009, lng: -84.8777 } },
  { code: 'LA', fips: '22', name: 'Louisiana', center: { lat: 30.4515, lng: -91.1871 } },
  { code: 'ME', fips: '23', name: 'Maine', center: { lat: 44.3106, lng: -69.7795 } },
  { code: 'MD', fips: '24', name: 'Maryland', center: { lat: 38.9784, lng: -76.4922 } },
  { code: 'MA', fips: '25', name: 'Massachusetts', center: { lat: 42.3601, lng: -71.0589 }, maxFitZoom: 8 },
  { code: 'MI', fips: '26', name: 'Michigan', center: { lat: 42.7325, lng: -84.5555 } },
  { code: 'MN', fips: '27', name: 'Minnesota', center: { lat: 44.9537, lng: -93.09 } },
  { code: 'MS', fips: '28', name: 'Mississippi', center: { lat: 32.2988, lng: -90.1848 } },
  { code: 'MO', fips: '29', name: 'Missouri', center: { lat: 38.5767, lng: -92.1735 } },
  { code: 'MT', fips: '30', name: 'Montana', center: { lat: 46.5891, lng: -112.0391 } },
  { code: 'NE', fips: '31', name: 'Nebraska', center: { lat: 40.8136, lng: -96.7026 } },
  { code: 'NV', fips: '32', name: 'Nevada', center: { lat: 39.1638, lng: -119.7674 } },
  { code: 'NH', fips: '33', name: 'New Hampshire', center: { lat: 43.2081, lng: -71.5376 } },
  { code: 'NJ', fips: '34', name: 'New Jersey', center: { lat: 40.2171, lng: -74.7429 } },
  { code: 'NM', fips: '35', name: 'New Mexico', center: { lat: 35.687, lng: -105.9378 } },
  { code: 'NY', fips: '36', name: 'New York', center: { lat: 42.6526, lng: -73.7562 } },
  { code: 'NC', fips: '37', name: 'North Carolina', center: { lat: 35.7796, lng: -78.6382 } },
  { code: 'ND', fips: '38', name: 'North Dakota', center: { lat: 46.8083, lng: -100.7837 } },
  { code: 'OH', fips: '39', name: 'Ohio', center: { lat: 39.9612, lng: -82.9988 } },
  { code: 'OK', fips: '40', name: 'Oklahoma', center: { lat: 35.4676, lng: -97.5164 } },
  { code: 'OR', fips: '41', name: 'Oregon', center: { lat: 44.9429, lng: -123.0351 } },
  { code: 'PA', fips: '42', name: 'Pennsylvania', center: { lat: 40.2732, lng: -76.8867 } },
  { code: 'RI', fips: '44', name: 'Rhode Island', center: { lat: 41.824, lng: -71.4128 }, maxFitZoom: 9 },
  { code: 'SC', fips: '45', name: 'South Carolina', center: { lat: 34.0007, lng: -81.0348 } },
  { code: 'SD', fips: '46', name: 'South Dakota', center: { lat: 44.3683, lng: -100.351 } },
  { code: 'TN', fips: '47', name: 'Tennessee', center: { lat: 36.1627, lng: -86.7816 } },
  { code: 'TX', fips: '48', name: 'Texas', center: { lat: 30.2672, lng: -97.7431 } },
  { code: 'UT', fips: '49', name: 'Utah', center: { lat: 40.7608, lng: -111.891 } },
  { code: 'VT', fips: '50', name: 'Vermont', center: { lat: 44.2601, lng: -72.5754 } },
  { code: 'VA', fips: '51', name: 'Virginia', center: { lat: 37.5407, lng: -77.436 } },
  { code: 'WA', fips: '53', name: 'Washington', center: { lat: 47.0379, lng: -122.9007 } },
  { code: 'WV', fips: '54', name: 'West Virginia', center: { lat: 38.3498, lng: -81.6326 } },
  { code: 'WI', fips: '55', name: 'Wisconsin', center: { lat: 43.0731, lng: -89.4012 } },
  { code: 'WY', fips: '56', name: 'Wyoming', center: { lat: 41.14, lng: -104.8202 } },
] as const satisfies readonly StateDefinition[]

const topology = stateTopology as unknown as StateTopology

function decodeArc(index: number): Position[] {
  const source = topology.arcs[index < 0 ? ~index : index]
  const points: Position[] = []
  let x = 0
  let y = 0
  for (const delta of source) {
    x += delta[0]
    y += delta[1]
    points.push([
      x * topology.transform.scale[0] + topology.transform.translate[0],
      y * topology.transform.scale[1] + topology.transform.translate[1],
    ])
  }
  return index < 0 ? points.reverse() : points
}

function decodeRing(arcIndexes: number[]): Position[] {
  const ring: Position[] = []
  for (const arcIndex of arcIndexes) {
    if (ring.length) ring.pop()
    ring.push(...decodeArc(arcIndex))
  }
  return ring
}

function decodeGeometry(source: TopologyGeometry): Polygon | MultiPolygon {
  if (source.type === 'Polygon') {
    return { type: 'Polygon', coordinates: (source.arcs as number[][]).map(decodeRing) }
  }
  return {
    type: 'MultiPolygon',
    coordinates: (source.arcs as number[][][]).map((polygon) => polygon.map(decodeRing)),
  }
}

const stateFeatures = new Map<string, Feature<Polygon | MultiPolygon>>(
  topology.objects.states.geometries.map((geometry) => [geometry.id, {
    type: 'Feature',
    id: geometry.id,
    properties: geometry.properties,
    geometry: decodeGeometry(geometry),
  }]),
)

const stateBounds = new Map<string, [number, number, number, number]>(
  Array.from(stateFeatures.entries()).map(([fips, feature]) => {
    const positions = feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates.flat()
      : feature.geometry.coordinates.flat(2)
    const longitudes = positions.map((position) => position[0])
    const latitudes = positions.map((position) => position[1])
    return [fips, [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)]]
  }),
)

function pointInRing(point: Coordinates, ring: Position[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > point.lat) !== (yj > point.lat)
      && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function pointInPolygon(point: Coordinates, polygon: Position[][]) {
  return pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole))
}

export function getStateDefinition(code: string): StateDefinition {
  return stateDefinitions.find((state) => state.code === code) ?? stateDefinitions.find((state) => state.code === 'TX')!
}

export function getStateFeature(code: string) {
  const state = getStateDefinition(code)
  const feature = stateFeatures.get(state.fips)
  if (!feature) throw new Error(`Missing boundary data for ${state.name}`)
  return feature
}

export function isPointInState(point: Coordinates, code: string) {
  const geometry = getStateFeature(code).geometry
  return geometry.type === 'Polygon'
    ? pointInPolygon(point, geometry.coordinates)
    : geometry.coordinates.some((polygon) => pointInPolygon(point, polygon))
}

export function findStateForPoint(point: Coordinates) {
  return stateDefinitions.find((state) => {
    const bounds = stateBounds.get(state.fips)
    if (!bounds || point.lng < bounds[0] || point.lat < bounds[1] || point.lng > bounds[2] || point.lat > bounds[3]) return false
    return isPointInState(point, state.code)
  })
}
