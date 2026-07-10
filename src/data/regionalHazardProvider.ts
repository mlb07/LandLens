import type { Coordinates, DataProvenance } from '../types/site'
import { externalRequest } from './externalRequest'

// ─── Types ──────────────────────────────────────────────────────────────

export type HazardType = 'seaLevelRise' | 'wildfire' | 'radon'

export interface HazardResult {
  type: HazardType
  available: boolean
  level: 'none' | 'low' | 'moderate' | 'high' | 'severe'
  penalty: number          // 0 to -5 contribution from this hazard
  summary: string
  detail: string
  provenance: DataProvenance
  error?: string
}

export interface RegionalHazardData {
  hazards: HazardResult[]
  totalPenalty: number     // sum of all hazard penalties, clamped to [-5, 0]
  available: boolean       // true if at least one hazard source returned data
  fetchedAt: string
}

// ─── Provenance ─────────────────────────────────────────────────────────

const SLR_PROVENANCE: DataProvenance = {
  source: 'NOAA Sea Level Rise Inundation',
  sourceUrl: 'https://coast.noaa.gov/slr/',
  vintage: 'Live NOAA SLR ArcGIS service',
  coverageNote: 'Point-in-polygon test for 1.5 ft (0.46m) sea-level rise inundation. Only applies to coastal areas; returns "none" for inland points. Does not account for local subsidence, storm surge, or future acceleration scenarios.',
}

const WILDFIRE_PROVENANCE: DataProvenance = {
  source: 'USFS Wildfire Hazard Potential',
  sourceUrl: 'https://www.fs.usda.gov/rmrs/wildfire-hazard-potential',
  vintage: '2024 Wildfire Hazard Potential',
  coverageNote: 'Point-in-polygon test for USFS Wildfire Hazard Potential classes. WHP is an index of relative wildfire risk based on vegetation, fire behavior, and historical fire occurrence. It does not replace a site-specific defensible-space or insurance review.',
}

const RADON_PROVENANCE: DataProvenance = {
  source: 'EPA Radon Zones',
  sourceUrl: 'https://www.epa.gov/radon/epa-map-radon-zones',
  vintage: 'EPA Map of Radon Zones',
  coverageNote: 'County-level radon zone classification. Zone 1 (highest potential) has predicted indoor radon ≥ 4 pCi/L. This is a county-level screening, not a building-specific radon test. All new construction in Zone 1 should use radon-resistant building techniques.',
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

interface ArcGISFeatureSet {
  features?: Array<{ attributes: Record<string, string | number | null>; geometry?: unknown }>
  error?: { message?: string }
}

// ─── 1. Sea-Level Rise (NOAA) ──────────────────────────────────────────

async function fetchSeaLevelRise(coordinates: Coordinates, signal?: AbortSignal): Promise<HazardResult> {
  try {
    // NOAA SLR inundation layer for 1.5 ft (0.46m) rise.
    // Layer 3 in the SLR service is the 1.5ft scenario.
    const params = new URLSearchParams({
      f: 'json',
      geometry: `${coordinates.lng},${coordinates.lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'OBJECTID',
      returnGeometry: 'false',
      resultRecordCount: '1',
    })
    const data = await getJson<ArcGISFeatureSet>(
      'https://coast.noaa.gov/arcgis/rest/services/Slr/Slr_1ft/MapServer/3/query?' + params,
      signal,
    )
    const hit = (data.features || []).length > 0
    const level = hit ? 'severe' : 'none'
    const penalty = hit ? -3 : 0
    return {
      type: 'seaLevelRise',
      available: true,
      level,
      penalty,
      summary: hit
        ? 'The selected point is within the projected 1.5 ft sea-level rise inundation area.'
        : 'The selected point is not within the projected 1.5 ft sea-level rise inundation area.',
      detail: hit
        ? 'NOAA maps this point as inundated under a 1.5 ft (0.46m) sea-level rise scenario. This does not account for local subsidence, storm surge compounding, or future acceleration. Coastal sites should review local resilience plans and FEMA coastal zones.'
        : 'No NOAA sea-level rise inundation projected at this point. Inland points always return "none". This does not rule out storm surge or nuisance flooding.',
      provenance: SLR_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      type: 'seaLevelRise', available: false, level: 'none', penalty: 0,
      summary: 'Sea-level rise screening is unavailable.',
      detail: `NOAA SLR service could not be queried: ${message}. This may be a CORS limitation or the point is outside coastal coverage. Coastal sites should check NOAA's SLR viewer manually.`,
      provenance: SLR_PROVENANCE, error: message,
    }
  }
}

// ─── 2. Wildfire (USFS WHP) ────────────────────────────────────────────

async function fetchWildfire(coordinates: Coordinates, signal?: AbortSignal): Promise<HazardResult> {
  try {
    // USFS Wildfire Hazard Potential hosted on ArcGIS Online.
    // WHP2024 layer — query for the WHP class at the point.
    const params = new URLSearchParams({
      f: 'json',
      geometry: `${coordinates.lng},${coordinates.lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'WHP',
      returnGeometry: 'false',
      resultRecordCount: '1',
    })
    const data = await getJson<ArcGISFeatureSet>(
      'https://services9.arcgis.com/RHvpFAMq1mKnKjvP/arcgis/rest/services/Wildfire_Hazard_Potential_2024_USGS_view/FeatureServer/0/query?' + params,
      signal,
    )
    const features = data.features || []
    if (!features.length) {
      return {
        type: 'wildfire', available: true, level: 'none', penalty: 0,
        summary: 'No wildfire hazard potential mapped at this point.',
        detail: 'The USFS WHP index does not map this point. This may mean the point is in a non-vegetated or urban area with no wildfire hazard data. Does not replace a local defensible-space review.',
        provenance: WILDFIRE_PROVENANCE,
      }
    }
    const whpValue = Number(features[0].attributes.WHP) || 0
    // WHP classes: 0=None, 1=Low, 2=Moderate, 3=High, 4=Very High, 5=Non-burnable
    const level: HazardResult['level'] = whpValue >= 4 ? 'severe' : whpValue === 3 ? 'high' : whpValue === 2 ? 'moderate' : whpValue <= 1 ? 'low' : 'none'
    const penalty = whpValue >= 4 ? -4 : whpValue === 3 ? -2 : whpValue === 2 ? -1 : 0
    return {
      type: 'wildfire', available: true, level, penalty,
      summary: level === 'severe' ? 'Very high wildfire hazard potential at this point.'
        : level === 'high' ? 'High wildfire hazard potential at this point.'
          : level === 'moderate' ? 'Moderate wildfire hazard potential at this point.'
            : level === 'low' ? 'Low wildfire hazard potential at this point.'
              : 'No wildfire hazard potential mapped at this point.',
      detail: `USFS WHP class: ${whpValue} (0=None, 1=Low, 2=Moderate, 3=High, 4=Very High). WHP is an index of relative wildfire risk based on vegetation, fire behavior modeling, and historical occurrence. Does not replace a site-specific defensible-space assessment, insurance wildfire risk score, or local fire code review.`,
      provenance: WILDFIRE_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      type: 'wildfire', available: false, level: 'none', penalty: 0,
      summary: 'Wildfire hazard screening is unavailable.',
      detail: `USFS WHP service could not be queried: ${message}. This may be a CORS limitation or service issue. Western and forested sites should check local fire hazard maps manually.`,
      provenance: WILDFIRE_PROVENANCE, error: message,
    }
  }
}

// ─── 3. Radon (EPA Radon Zones) ────────────────────────────────────────

async function fetchRadon(coordinates: Coordinates, signal?: AbortSignal): Promise<HazardResult> {
  try {
    // EPA Radon Zones are a county-level polygon dataset.
    // We use the geocoding approach: geocode to county, then look up the zone.
    // The EPA radon zone map is available as an ArcGIS REST service.
    const params = new URLSearchParams({
      f: 'json',
      geometry: `${coordinates.lng},${coordinates.lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'STATE,COUNTY,RADONZONE',
      returnGeometry: 'false',
      resultRecordCount: '1',
    })
    const data = await getJson<ArcGISFeatureSet>(
      'https://geodata.epa.gov/arcgis/rest/services/Research/USA_Radon_Zones/MapServer/0/query?' + params,
      signal,
    )
    const features = data.features || []
    if (!features.length) {
      return {
        type: 'radon', available: false, level: 'none', penalty: 0,
        summary: 'No EPA radon zone mapping at this point.',
        detail: 'EPA radon zone data does not cover this point. All buildings should still be tested for radon regardless of zone classification.',
        provenance: RADON_PROVENANCE, error: 'No coverage',
      }
    }
    const zone = Number(features[0].attributes.RADONZONE) || 0
    // EPA zones: 1 = highest (≥4 pCi/L predicted), 2 = moderate (2-4 pCi/L), 3 = low (<2 pCi/L)
    const level: HazardResult['level'] = zone === 1 ? 'high' : zone === 2 ? 'moderate' : 'low'
    const penalty = zone === 1 ? -2 : 0
    const countyName = String(features[0].attributes.COUNTY || '')
    const stateName = String(features[0].attributes.STATE || '')
    return {
      type: 'radon', available: true, level, penalty,
      summary: zone === 1 ? `EPA Radon Zone 1 (highest potential) in ${countyName} ${stateName}.`
        : zone === 2 ? `EPA Radon Zone 2 (moderate potential) in ${countyName} ${stateName}.`
          : `EPA Radon Zone 3 (low potential) in ${countyName} ${stateName}.`,
      detail: `EPA Radon Zone ${zone}: ${zone === 1 ? 'predicted indoor radon ≥ 4 pCi/L. New construction should use radon-resistant building techniques.' : zone === 2 ? 'predicted indoor radon 2–4 pCi/L. Consider radon testing.' : 'predicted indoor radon < 2 pCi/L.'} This is a county-level screening, not a building-specific test. All buildings should be tested regardless of zone.`,
      provenance: RADON_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      type: 'radon', available: false, level: 'none', penalty: 0,
      summary: 'Radon zone screening is unavailable.',
      detail: `EPA radon zone service could not be queried: ${message}. This may be a CORS limitation. Check the EPA radon zone map manually. All buildings should be tested for radon regardless of zone.`,
      provenance: RADON_PROVENANCE, error: message,
    }
  }
}

// ─── Main entry ─────────────────────────────────────────────────────────

export async function fetchRegionalHazards(coordinates: Coordinates, signal?: AbortSignal): Promise<RegionalHazardData> {
  const [slr, wildfire, radon] = await Promise.all([
    fetchSeaLevelRise(coordinates, signal),
    fetchWildfire(coordinates, signal),
    fetchRadon(coordinates, signal),
  ])

  const hazards = [slr, wildfire, radon]
  const availableCount = hazards.filter((h) => h.available).length
  const totalPenalty = Math.max(-5, Math.max(-5, hazards.reduce((sum, h) => sum + h.penalty, 0)))

  return {
    hazards,
    totalPenalty,
    available: availableCount > 0,
    fetchedAt: new Date().toISOString(),
  }
}
