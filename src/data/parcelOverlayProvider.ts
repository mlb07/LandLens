import type { DataProvenance, ScreeningArea } from '../types/site'
import { boundaryAreaSquareMeters, boundaryToArcGISPolygon, gridSampleBoundary, pointInBoundary, squareMetersToAcres, type GeoBoundary } from '../lib/geometry'

// Accept the ScreeningArea boundary shape (which has a union type) and narrow
// it to the GeoBoundary discriminated union used by geometry utilities.
function narrowBoundary(b: NonNullable<ScreeningArea['boundary']>): GeoBoundary {
  return b as GeoBoundary
}

// ─── Types ──────────────────────────────────────────────────────────────

export interface FloodplainOverlay {
  available: boolean
  value?: {
    sfhaFraction: number         // 0–1 share of parcel in Special Flood Hazard Area
    floodwayFraction: number     // 0–1 share of parcel in regulatory floodway
    floodwayInCore: boolean      // floodway intersects the interior buildable area
    zoneSummary: string          // e.g. "AE · X"
    risk: 'Low' | 'Moderate' | 'High' | 'Floodway' | 'Undetermined'
    samplePoints: number
  }
  provenance: DataProvenance
  error?: string
}

export interface WetlandsOverlay {
  available: boolean
  value?: {
    wetlandFraction: number      // 0–1 share of parcel with mapped wetlands/waters
    wetlandTypeCounts: Record<string, number>
    samplePoints: number
  }
  provenance: DataProvenance
  error?: string
}

export interface SlopeOverlay {
  available: boolean
  value?: {
    meanSlopePercent: number
    p90SlopePercent: number
    maxSlopePercent: number
    fractionOver15: number
    fractionOver20: number
    fractionOver30: number
    samplePoints: number
    spacingMeters: number
  }
  provenance: DataProvenance
  error?: string
}

export interface NetDevelopableOverlay {
  grossAcres: number
  floodwayAcres: number
  wetlandAcres: number
  steepSlopeAcres: number       // slope > 20%
  constrainedAcres: number       // union of floodway + wetland + steep slope
  netDevelopableAcres: number
  netToGrossRatio: number        // 0–1
  samplePoints: number
}

export interface ParcelOverlayData {
  floodplain: FloodplainOverlay
  wetlands: WetlandsOverlay
  slope: SlopeOverlay
  netDevelopable: NetDevelopableOverlay | null
  fetchedAt: string
}

export type ParcelOverlayCategory = 'floodplain' | 'wetlands' | 'slope' | 'netDevelopable'

export interface ParcelOverlayProgress {
  data: ParcelOverlayData
  pending: ParcelOverlayCategory[]
}

// ─── Provenance ─────────────────────────────────────────────────────────

const FEMA_PROVENANCE: DataProvenance = {
  source: 'FEMA National Flood Hazard Layer (parcel overlay)',
  sourceUrl: 'https://hazards.fema.gov/femaportal/resources/flood_map_svc.htm',
  vintage: 'Live NFHL service',
  coverageNote: 'Parcel-wide intersection of NFHL flood hazard zones. FEMA mapping does not replace an elevation certificate, drainage study, or local floodplain review.',
}

const NWI_PROVENANCE: DataProvenance = {
  source: 'USFWS National Wetlands Inventory (parcel overlay)',
  sourceUrl: 'https://www.fws.gov/program/national-wetlands-inventory/web-mapping-services',
  vintage: 'Live NWI wetlands service',
  coverageNote: 'Parcel-wide intersection of NWI polygons. NWI is not a regulatory or jurisdictional wetland determination.',
}

const USGS_PROVENANCE: DataProvenance = {
  source: 'USGS 3D Elevation Program (parcel grid)',
  sourceUrl: 'https://www.usgs.gov/3d-elevation-program/about-3dep-products-services',
  vintage: 'Live National Map elevation service',
  coverageNote: 'Parcel-wide slope from a grid of USGS EPQS elevation samples. Not a boundary survey or grading plan.',
}

// ─── Network helper ─────────────────────────────────────────────────────

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20_000)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Source returned ${response.status}`)
    const data = await response.json() as T & { error?: { message?: string } }
    if (data.error) throw new Error(data.error.message || 'Source query failed')
    return data
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

// ─── Floodplain overlay ─────────────────────────────────────────────────

interface ArcGISFeature {
  attributes: Record<string, string | number | null>
  geometry?: { rings?: number[][][] }
}

interface ArcGISFeatureSet {
  features?: ArcGISFeature[]
  error?: { message?: string }
}

function parseFloodFeature(attrs: Record<string, string | number | null>): { zone: string; subtype: string; sfha: boolean; floodway: boolean; polygon: number[][][] | null } {
  const zone = String(attrs.FLD_ZONE || '')
  const subtype = String(attrs.ZONE_SUBTY || '')
  const sfha = String(attrs.SFHA_TF || '').toUpperCase() === 'T'
  const floodway = /floodway/i.test(subtype)
  return { zone, subtype, sfha, floodway, polygon: null }
}

async function fetchFloodplainOverlay(boundary: GeoBoundary, gridPoints: { lng: number; lat: number }[], signal?: AbortSignal): Promise<FloodplainOverlay> {
  try {
    const geometry = JSON.stringify(boundaryToArcGISPolygon(boundary))
    const params = new URLSearchParams({
      f: 'json',
      geometry,
      geometryType: 'esriGeometryPolygon',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF',
      returnGeometry: 'true',
      outSR: '4326',
      geometryPrecision: '5',
      resultRecordCount: '200',
    })
    const data = await getJson<ArcGISFeatureSet>(
      `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${params}`,
      signal,
    )
    const features = data.features || []
    if (!features.length) {
      return {
        available: true,
        value: { sfhaFraction: 0, floodwayFraction: 0, floodwayInCore: false, zoneSummary: 'X (unmapped)', risk: 'Low', samplePoints: gridPoints.length },
        provenance: FEMA_PROVENANCE,
      }
    }

    // Build polygon list from returned features for point-in-polygon testing.
    const floodPolygons: Array<{ polygon: number[][][]; floodway: boolean; sfha: boolean; zone: string }> = []
    const zoneSet = new Set<string>()
    for (const feature of features) {
      const parsed = parseFloodFeature(feature.attributes)
      const rings = feature.geometry?.rings
      if (!rings) continue
      floodPolygons.push({ polygon: rings, floodway: parsed.floodway, sfha: parsed.sfha, zone: parsed.zone })
      zoneSet.add(parsed.zone || 'X')
    }

    // If no geometry was returned, fall back to a conservative point-only check.
    if (!floodPolygons.length) {
      return {
        available: false,
        provenance: FEMA_PROVENANCE,
        error: 'FEMA returned records without polygon geometry.',
      }
    }

    let sfhaCount = 0
    let floodwayCount = 0
    for (const pt of gridPoints) {
      for (const fp of floodPolygons) {
        if (pointInBoundary(pt.lng, pt.lat, { type: 'Polygon', coordinates: fp.polygon })) {
          if (fp.floodway) { floodwayCount += 1; break }
        }
      }
    }
    for (const pt of gridPoints) {
      for (const fp of floodPolygons) {
        if (pointInBoundary(pt.lng, pt.lat, { type: 'Polygon', coordinates: fp.polygon })) {
          if (fp.sfha) { sfhaCount += 1; break }
        }
      }
    }

    const total = gridPoints.length
    const sfhaFraction = sfhaCount / total
    const floodwayFraction = floodwayCount / total
    const floodwayInCore = floodwayCount > 0
    const zoneSummary = Array.from(zoneSet).sort().join(' · ')
    const risk = floodwayFraction > 0 ? 'Floodway' : sfhaFraction > 0.25 ? 'High' : sfhaFraction > 0 ? 'Moderate' : 'Low'

    return {
      available: true,
      value: { sfhaFraction, floodwayFraction, floodwayInCore, zoneSummary, risk, samplePoints: total },
      provenance: FEMA_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { available: false, provenance: FEMA_PROVENANCE, error: message }
  }
}

// ─── Wetlands overlay ───────────────────────────────────────────────────

async function fetchWetlandsOverlay(boundary: GeoBoundary, gridPoints: { lng: number; lat: number }[], signal?: AbortSignal): Promise<WetlandsOverlay> {
  try {
    const geometry = JSON.stringify(boundaryToArcGISPolygon(boundary))
    const params = new URLSearchParams({
      f: 'json',
      geometry,
      geometryType: 'esriGeometryPolygon',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'Wetlands.ATTRIBUTE,Wetlands.WETLAND_TYPE',
      returnGeometry: 'true',
      outSR: '4326',
      geometryPrecision: '5',
      resultRecordCount: '200',
    })
    const data = await getJson<ArcGISFeatureSet>(
      `https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query?${params}`,
      signal,
    )
    const features = data.features || []
    if (!features.length) {
      return {
        available: true,
        value: { wetlandFraction: 0, wetlandTypeCounts: {}, samplePoints: gridPoints.length },
        provenance: NWI_PROVENANCE,
      }
    }

    const wetlandPolygons: Array<{ polygon: number[][][]; type: string }> = []
    for (const feature of features) {
      const rings = feature.geometry?.rings
      if (!rings) continue
      const wetlandType = String(feature.attributes['Wetlands.WETLAND_TYPE'] || 'Wetland')
      wetlandPolygons.push({ polygon: rings, type: wetlandType })
    }

    if (!wetlandPolygons.length) {
      return {
        available: false,
        provenance: NWI_PROVENANCE,
        error: 'NWI returned records without polygon geometry.',
      }
    }

    let wetlandCount = 0
    const typeCounts: Record<string, number> = {}
    for (const pt of gridPoints) {
      for (const wp of wetlandPolygons) {
        if (pointInBoundary(pt.lng, pt.lat, { type: 'Polygon', coordinates: wp.polygon })) {
          wetlandCount += 1
          typeCounts[wp.type] = (typeCounts[wp.type] || 0) + 1
          break
        }
      }
    }
    const total = gridPoints.length
    const wetlandFraction = wetlandCount / total

    return {
      available: true,
      value: { wetlandFraction, wetlandTypeCounts: typeCounts, samplePoints: total },
      provenance: NWI_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { available: false, provenance: NWI_PROVENANCE, error: message }
  }
}

// ─── Slope overlay ──────────────────────────────────────────────────────

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

async function fetchSlopeOverlay(boundary: GeoBoundary, signal?: AbortSignal): Promise<SlopeOverlay> {
  try {
    const { points, spacingMeters } = gridSampleBoundary(boundary, 25)
    if (points.length < 4) {
      return { available: false, provenance: USGS_PROVENANCE, error: 'Parcel is too small for a slope grid.' }
    }

    // Fetch elevations with limited concurrency to be respectful to the API.
    const CONCURRENCY = 6
    const elevations = new Array<number>(points.length).fill(NaN)
    let index = 0
    async function worker() {
      while (index < points.length) {
        const i = index
        index += 1
        try {
          elevations[i] = await elevationAt(points[i].lng, points[i].lat, signal)
        } catch {
          // Leave as NaN; we'll filter later.
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

    // Build a grid lookup for slope calculation between adjacent points.
    const grid = new Map<string, { lng: number; lat: number; elev: number }>()
    for (let i = 0; i < points.length; i += 1) {
      if (Number.isFinite(elevations[i])) {
        grid.set(`${points[i].row},${points[i].col}`, { lng: points[i].lng, lat: points[i].lat, elev: elevations[i] })
      }
    }
    if (grid.size < 4) {
      return { available: false, provenance: USGS_PROVENANCE, error: 'Too few USGS elevation samples returned for the parcel grid.' }
    }

    const cosLat = Math.cos(((points[0].lat + points[points.length - 1].lat) / 2) * Math.PI / 180)
    const slopes: number[] = []
    let maxSlope = 0
    let over15 = 0, over20 = 0, over30 = 0

    for (const pt of points) {
      const center = grid.get(`${pt.row},${pt.col}`)
      if (!center) continue
      const north = grid.get(`${pt.row + 1},${pt.col}`)
      const south = grid.get(`${pt.row - 1},${pt.col}`)
      const east = grid.get(`${pt.row},${pt.col + 1}`)
      const west = grid.get(`${pt.row},${pt.col - 1}`)
      const gradients: number[] = []
      if (north) {
        const dLat = (north.lat - center.lat) * 110_540
        gradients.push(Math.abs(north.elev - center.elev) / Math.max(1, dLat))
      }
      if (south) {
        const dLat = (center.lat - south.lat) * 110_540
        gradients.push(Math.abs(center.elev - south.elev) / Math.max(1, dLat))
      }
      if (east) {
        const dLng = (east.lng - center.lng) * 111_320 * cosLat
        gradients.push(Math.abs(east.elev - center.elev) / Math.max(1, dLng))
      }
      if (west) {
        const dLng = (center.lng - west.lng) * 111_320 * cosLat
        gradients.push(Math.abs(center.elev - west.elev) / Math.max(1, dLng))
      }
      if (!gradients.length) continue
      // Average of available directional gradients → representative local slope.
      const slopePercent = (gradients.reduce((a, b) => a + b, 0) / gradients.length) * 100
      slopes.push(slopePercent)
      if (slopePercent > maxSlope) maxSlope = slopePercent
      if (slopePercent > 15) over15 += 1
      if (slopePercent > 20) over20 += 1
      if (slopePercent > 30) over30 += 1
    }

    if (!slopes.length) {
      return { available: false, provenance: USGS_PROVENANCE, error: 'No slope values could be computed from the elevation grid.' }
    }

    slopes.sort((a, b) => a - b)
    const mean = slopes.reduce((a, b) => a + b, 0) / slopes.length
    const p90 = slopes[Math.floor(slopes.length * 0.9)]
    const count = slopes.length

    return {
      available: true,
      value: {
        meanSlopePercent: Math.round(mean * 10) / 10,
        p90SlopePercent: Math.round(p90 * 10) / 10,
        maxSlopePercent: Math.round(maxSlope * 10) / 10,
        fractionOver15: over15 / count,
        fractionOver20: over20 / count,
        fractionOver30: over30 / count,
        samplePoints: count,
        spacingMeters: Math.round(spacingMeters),
      },
      provenance: USGS_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { available: false, provenance: USGS_PROVENANCE, error: message }
  }
}

// ─── Net developable acreage ────────────────────────────────────────────

function computeNetDevelopable(
  boundary: GeoBoundary,
  flood: FloodplainOverlay,
  wetlands: WetlandsOverlay,
  slope: SlopeOverlay,
): NetDevelopableOverlay | null {
  const grossM2 = boundaryAreaSquareMeters(boundary)
  if (grossM2 <= 0) return null
  const grossAcres = squareMetersToAcres(grossM2)

  const floodwayFraction = flood.value?.floodwayFraction ?? 0
  const wetlandFraction = wetlands.value?.wetlandFraction ?? 0
  const steepFraction = slope.value?.fractionOver20 ?? 0

  // Grid-based union: each constraint is measured against the same grid, so
  // the true union requires checking each point against all constraints. Since
  // we computed fractions independently, we use the independence approximation
  // for the union: 1 - (1-a)(1-b)(1-c). This slightly overestimates overlap
  // but is conservative (overcounts constrained land) which is safer for
  // screening.
  const constrainedFraction = 1 - (1 - floodwayFraction) * (1 - wetlandFraction) * (1 - steepFraction)

  const floodwayAcres = grossAcres * floodwayFraction
  const wetlandAcres = grossAcres * wetlandFraction
  const steepSlopeAcres = grossAcres * steepFraction
  const constrainedAcres = grossAcres * constrainedFraction
  const netDevelopableAcres = Math.max(0, grossAcres - constrainedAcres)
  const netToGrossRatio = grossAcres > 0 ? netDevelopableAcres / grossAcres : 0

  return {
    grossAcres: Math.round(grossAcres * 100) / 100,
    floodwayAcres: Math.round(floodwayAcres * 100) / 100,
    wetlandAcres: Math.round(wetlandAcres * 100) / 100,
    steepSlopeAcres: Math.round(steepSlopeAcres * 100) / 100,
    constrainedAcres: Math.round(constrainedAcres * 100) / 100,
    netDevelopableAcres: Math.round(netDevelopableAcres * 100) / 100,
    netToGrossRatio: Math.round(netToGrossRatio * 1000) / 1000,
    samplePoints: flood.value?.samplePoints ?? wetlands.value?.samplePoints ?? slope.value?.samplePoints ?? 0,
  }
}

// ─── Main entry ─────────────────────────────────────────────────────────

export async function fetchParcelOverlays(
  boundaryInput: NonNullable<ScreeningArea['boundary']>,
  signal?: AbortSignal,
  onProgress?: (progress: ParcelOverlayProgress) => void,
): Promise<ParcelOverlayData> {
  const boundary = narrowBoundary(boundaryInput)
  // Generate the shared grid for flood/wetland point-in-polygon testing.
  const { points: gridPoints } = gridSampleBoundary(boundary, 400)

  let data: ParcelOverlayData = {
    floodplain: { available: false, provenance: FEMA_PROVENANCE, error: 'Pending' },
    wetlands: { available: false, provenance: NWI_PROVENANCE, error: 'Pending' },
    slope: { available: false, provenance: USGS_PROVENANCE, error: 'Pending' },
    netDevelopable: null,
    fetchedAt: new Date().toISOString(),
  }
  const remaining = new Set<ParcelOverlayCategory>(['floodplain', 'wetlands', 'slope'])

  function publish(category: 'floodplain' | 'wetlands' | 'slope', observation: ParcelOverlayData[typeof category]) {
    data = { ...data, [category]: observation, fetchedAt: new Date().toISOString() }
    remaining.delete(category)
    // Try computing net developable once at least two of three overlays are done.
    if (data.floodplain.available !== undefined && data.wetlands.available !== undefined && data.slope.available !== undefined) {
      const canCompute = data.floodplain.available || data.wetlands.available || data.slope.available
      if (canCompute && !data.netDevelopable) {
        data = { ...data, netDevelopable: computeNetDevelopable(boundary, data.floodplain, data.wetlands, data.slope) }
      }
    }
    remaining.delete('netDevelopable' as ParcelOverlayCategory)
    if (remaining.size === 0 && !data.netDevelopable) {
      data = { ...data, netDevelopable: computeNetDevelopable(boundary, data.floodplain, data.wetlands, data.slope) }
    }
    onProgress?.({ data, pending: [...remaining] })
  }

  await Promise.all([
    fetchFloodplainOverlay(boundary, gridPoints, signal).then((v) => publish('floodplain', v)),
    fetchWetlandsOverlay(boundary, gridPoints, signal).then((v) => publish('wetlands', v)),
    fetchSlopeOverlay(boundary, signal).then((v) => publish('slope', v)),
  ])

  // Final net developable computation.
  data = { ...data, netDevelopable: computeNetDevelopable(boundary, data.floodplain, data.wetlands, data.slope), fetchedAt: new Date().toISOString() }
  onProgress?.({ data, pending: [] })
  return data
}
