import type { Coordinates, DataProvenance } from '../types/site'
import type { OfficialObservation } from './officialDataProvider'
import { externalRequest } from './externalRequest'

// ─── Provenance ─────────────────────────────────────────────────────────

const STORMWATER_PROVENANCE: DataProvenance = {
  source: 'USGS 3DEP derived drainage analysis',
  sourceUrl: 'https://www.usgs.gov/3d-elevation-program/about-3dep-products-services',
  vintage: 'Live National Map elevation service',
  coverageNote: 'Flow-direction and drainage analysis derived from USGS EPQS elevation samples. This is a screening proxy, not a civil stormwater concept or outfall survey. Local stormwater criteria and a civil concept plan are required.',
}

// ─── Network helper ─────────────────────────────────────────────────────

async function getJson<T>(url: string, signal?: AbortSignal, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await externalRequest(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Source returned ${response.status}`)
    return await response.json() as T
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

function unavailable<T>(provenance: DataProvenance, error: unknown): OfficialObservation<T> {
  const message = error instanceof Error ? error.message : String(error)
  return { available: false, provenance, error: message }
}

// ─── Stormwater / outfall screening ─────────────────────────────────────

export interface StormwaterData {
  drainageDirection: string        // N/NE/E/SE/S/SW/W/NW/Flat
  slopeTowardLowPoint: number       // percent grade of dominant drainage
  hasPositiveOutfall: boolean       // true if terrain drains away from the point
  flatnessIndex: number             // 0-1, how flat the surrounding terrain is
  estimatedDetentionSuitability: 'good' | 'moderate' | 'poor' | 'unknown'
  nearestWaterBodyDistanceMeters: number  // rough estimate from NWI/hydrography
  screeningLevel: 'good' | 'moderate' | 'challenging' | 'unknown'
}

export type StormwaterObservation = OfficialObservation<StormwaterData>

interface ElevationResponse {
  value?: number
  elevation?: number
}

async function elevationAt(lng: number, lat: number, signal?: AbortSignal): Promise<number> {
  const params = new URLSearchParams({ x: String(lng), y: String(lat), units: 'Meters', wkid: '4326', includeDate: 'false' })
  const result = await getJson<ElevationResponse>(`https://epqs.nationalmap.gov/v1/json?${params}`, signal)
  const elevation = Number(result.value ?? result.elevation)
  if (!Number.isFinite(elevation)) throw new Error('No elevation returned')
  return elevation
}

export async function fetchStormwater(coordinates: Coordinates, signal?: AbortSignal): Promise<StormwaterObservation> {
  try {
    // Sample elevations in 8 directions to determine drainage pattern.
    const radius = 100 // meters
    const latDelta = radius / 111_320
    const lngDelta = radius / (111_320 * Math.cos(coordinates.lat * Math.PI / 180))
    const directions = [
      { name: 'N', lng: 0, lat: latDelta },
      { name: 'NE', lng: lngDelta, lat: latDelta },
      { name: 'E', lng: lngDelta, lat: 0 },
      { name: 'SE', lng: lngDelta, lat: -latDelta },
      { name: 'S', lng: 0, lat: -latDelta },
      { name: 'SW', lng: -lngDelta, lat: -latDelta },
      { name: 'W', lng: -lngDelta, lat: 0 },
      { name: 'NW', lng: -lngDelta, lat: latDelta },
    ]

    // Fetch center + 8 surrounding elevations with limited concurrency.
    const points = [{ lng: coordinates.lng, lat: coordinates.lat, name: 'C' }, ...directions.map((d) => ({ lng: coordinates.lng + d.lng, lat: coordinates.lat + d.lat, name: d.name }))]
    const elevations = new Map<string, number>()
    const CONCURRENCY = 5
    let index = 0
    async function worker() {
      while (index < points.length) {
        const i = index
        index += 1
        try {
          const elev = await elevationAt(points[i].lng, points[i].lat, signal)
          elevations.set(points[i].name, elev)
        } catch {
          // Leave unset
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

    const centerElev = elevations.get('C')
    if (centerElev === undefined) throw new Error('No center elevation returned')

    // Compute elevation differences from center in each direction.
    const diffs: Array<{ name: string; dx: number; dy: number; elevDiff: number }> = []
    for (const dir of directions) {
      const elev = elevations.get(dir.name)
      if (elev !== undefined) {
        // Positive diff means the surrounding point is higher (water flows toward center).
        // Negative diff means the surrounding point is lower (water flows away from center).
        diffs.push({ name: dir.name, dx: dir.lng, dy: dir.lat, elevDiff: elev - centerElev })
      }
    }

    if (diffs.length < 4) throw new Error('Too few elevation samples for drainage analysis')

    // Find the dominant drainage direction (the direction with the steepest descent from center).
    let steepestDescent = { name: 'Flat', dx: 0, dy: 0, gradient: 0 }
    let totalFlatness = 0
    for (const diff of diffs) {
      const distance = radius
      const gradient = -diff.elevDiff / distance // positive = downhill from center
      if (gradient > steepestDescent.gradient) {
        steepestDescent = { name: diff.name, dx: diff.dx, dy: diff.dy, gradient }
      }
      totalFlatness += Math.abs(diff.elevDiff)
    }

    const avgElevDiff = totalFlatness / diffs.length
    const flatnessIndex = Math.max(0, Math.min(1, 1 - avgElevDiff / 3)) // 3m difference = not flat
    const slopeTowardLowPoint = Math.abs(steepestDescent.gradient) * 100

    // Positive outfall = terrain drains away from the point (steepest descent is negative elevDiff, meaning downhill).
    const hasPositiveOutfall = steepestDescent.gradient > 0.001

    // Drainage direction = direction water flows TO (downhill).
    const drainageDirection = hasPositiveOutfall ? steepestDescent.name : 'Flat'

    // Detention suitability: flat sites are good for detention, steep sites are poor.
    const estimatedDetentionSuitability: StormwaterData['estimatedDetentionSuitability'] =
      flatnessIndex > 0.7 ? 'good' : flatnessIndex > 0.4 ? 'moderate' : flatnessIndex > 0.1 ? 'poor' : 'unknown'

    // Overall screening level.
    const screeningLevel: StormwaterData['screeningLevel'] =
      hasPositiveOutfall && flatnessIndex < 0.7 ? 'good'
        : hasPositiveOutfall && flatnessIndex >= 0.7 ? 'moderate'
          : !hasPositiveOutfall && flatnessIndex >= 0.7 ? 'challenging'
            : 'unknown'

    return {
      available: true,
      value: {
        drainageDirection,
        slopeTowardLowPoint: Math.round(slopeTowardLowPoint * 10) / 10,
        hasPositiveOutfall,
        flatnessIndex: Math.round(flatnessIndex * 100) / 100,
        estimatedDetentionSuitability,
        nearestWaterBodyDistanceMeters: 0, // not computed without hydrography overlay
        screeningLevel,
      },
      provenance: STORMWATER_PROVENANCE,
    }
  } catch (error) {
    return unavailable(STORMWATER_PROVENANCE, error)
  }
}
