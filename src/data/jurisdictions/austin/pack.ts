import type { Coordinates, DataProvenance, JurisdictionOverlay } from '../../../types/site'
import { externalRequest } from '../../externalRequest'
import {
  AUSTIN_FLUM_SOURCE_URL,
  AUSTIN_JURISDICTION_SOURCE_URL,
  AUSTIN_OVERLAY_SOURCE_URL,
  AUSTIN_STANDARDS_SOURCE_URL,
  buildAustinJurisdictionProfile,
} from '../../austinJurisdiction'
import {
  AUSTIN_PERMITTED_USES_SOURCE_URL,
  AUSTIN_PROPOSED_USES,
  assessAustinProposedUse,
} from '../../austinPermittedUses'
import type { JurisdictionPack } from '../types'

export const AUSTIN_BOUNDS = { south: 30.08, west: -98.02, north: 30.52, east: -97.53 }

export const AUSTIN_ZONING_PROVENANCE: DataProvenance = {
  source: 'City of Austin zoning, jurisdiction, overlay, and future-land-use profile',
  sourceUrl: 'https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_1/MapServer/0',
  vintage: 'Live City of Austin GIS service',
  coverageNote: 'Official point lookup from the Austin zoning atlas, jurisdiction boundary, selected zoning overlays, and neighborhood-plan future land use. Numeric standards are principal base-district values only and are applied only in full- or limited-purpose jurisdiction. The result is not an official zoning verification; exact use, overlays, compatibility, site-plan review, plats, and current adopted code control.',
}

const AUSTIN_ELECTRIC_PROVENANCE: DataProvenance = {
  source: 'Austin Energy utility service area',
  sourceUrl: 'https://maps.austintexas.gov/arcgis/rest/services/Shared/BoundariesGrids_2/MapServer/1',
  vintage: 'Live City of Austin GIS service',
  coverageNote: 'Official electric service-boundary lookup only. It does not establish electrical capacity, distribution availability, extension cost, or a right to serve; obtain a written service/capacity confirmation.',
}

async function queryAustinLayer(
  layerUrl: string,
  outFields: string,
  coordinates: Coordinates,
  signal?: AbortSignal,
): Promise<Array<Record<string, string | number | null>>> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const params = new URLSearchParams({
      f: 'json', geometry: `${coordinates.lng},${coordinates.lat}`, geometryType: 'esriGeometryPoint',
      inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields, returnGeometry: 'false',
      returnDomainNames: 'true',
    })
    const response = await externalRequest(`${layerUrl}/query?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Austin GIS service returned ${response.status}`)
    const data = await response.json() as { features?: Array<{ attributes?: Record<string, string | number | null> }>; error?: { message?: string } }
    if (data.error) throw new Error(data.error.message || 'Austin GIS query failed')
    return data.features?.flatMap((feature) => feature.attributes ? [feature.attributes] : []) || []
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

const HIGH_IMPACT_OVERLAY_LAYER_IDS = [0, 2, 3, 4, 11, 14, 16, 17, 18, 19, 21, 22, 26, 28, 29, 31, 33]

function overlayDetail(attributes: Record<string, string | number | null>): string | undefined {
  const preferredKeys = [
    'ZONING_OVERLAY_SUB_NAME', 'ZONING_OVERLAY_NAME', 'SUBDISTRICT', 'SUBDISTRICT_NAME',
    'SETBACK_TYPE', 'SETBACK_COMMENTS', 'NAME', 'LABEL',
  ]
  for (const key of preferredKeys) {
    const value = attributes[key]
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim()
  }
  return Object.entries(attributes)
    .find(([key, value]) => !/objectid|shape|globalid/i.test(key) && value !== null && String(value).trim())?.[1]
    ?.toString()
}

async function queryAustinOverlays(coordinates: Coordinates, signal?: AbortSignal): Promise<JurisdictionOverlay[]> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const delta = 0.002
    const params = new URLSearchParams({
      f: 'json', geometry: `${coordinates.lng},${coordinates.lat}`, geometryType: 'esriGeometryPoint', sr: '4326', tolerance: '1',
      mapExtent: `${coordinates.lng - delta},${coordinates.lat - delta},${coordinates.lng + delta},${coordinates.lat + delta}`,
      imageDisplay: '800,600,96', returnGeometry: 'false', returnFieldName: 'true',
      layers: `all:${HIGH_IMPACT_OVERLAY_LAYER_IDS.join(',')}`,
    })
    const response = await externalRequest(`${AUSTIN_OVERLAY_SOURCE_URL}/identify?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Austin overlay service returned ${response.status}`)
    const data = await response.json() as {
      results?: Array<{ layerId: number; layerName: string; attributes?: Record<string, string | number | null> }>
      error?: { message?: string }
    }
    if (data.error) throw new Error(data.error.message || 'Austin overlay identify failed')
    const seen = new Set<string>()
    return (data.results ?? []).flatMap((result) => {
      const detail = overlayDetail(result.attributes ?? {})
      const key = `${result.layerId}:${detail ?? ''}`
      if (seen.has(key)) return []
      seen.add(key)
      return [{ name: result.layerName, detail, layerId: result.layerId }]
    })
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

function firstAttribute(attributes: Record<string, string | number | null> | undefined, keys: string[]): string | undefined {
  if (!attributes) return undefined
  for (const key of keys) {
    const match = Object.entries(attributes).find(([candidate]) => candidate.toUpperCase() === key)
    if (match?.[1] !== null && match?.[1] !== undefined && String(match[1]).trim()) return String(match[1]).trim()
  }
  return undefined
}

export const austinJurisdictionPack: JurisdictionPack = {
  id: 'austin-travis',
  profileId: 'austin-travis-v1',
  label: 'Austin/Travis jurisdiction pack',
  stateCode: 'TX',
  bounds: AUSTIN_BOUNDS,
  description: 'Verified City of Austin zoning, jurisdiction, overlay, future-land-use, standards, and proposed-use intelligence.',
  proposedUseLabel: 'Austin proposed-use detail',
  proposedUseHelpText: 'Checks the selected use against Austin LDC §25-2-491. Other code provisions and overlays can supersede the base table.',
  proposedUses: AUSTIN_PROPOSED_USES,
  sources: [
    { id: 'jurisdiction', label: 'Jurisdiction', url: AUSTIN_JURISDICTION_SOURCE_URL, role: 'authority' },
    { id: 'zoning', label: 'Zoning atlas', url: AUSTIN_ZONING_PROVENANCE.sourceUrl, role: 'zoning' },
    { id: 'overlays', label: 'Overlays', url: AUSTIN_OVERLAY_SOURCE_URL, role: 'overlays' },
    { id: 'future-land-use', label: 'Future land use', url: AUSTIN_FLUM_SOURCE_URL, role: 'future-land-use' },
    { id: 'standards', label: 'Base standards', url: AUSTIN_STANDARDS_SOURCE_URL, role: 'standards' },
    { id: 'permitted-uses', label: 'Permitted uses', url: AUSTIN_PERMITTED_USES_SOURCE_URL, role: 'permitted-uses' },
  ],
  assessUse: assessAustinProposedUse,
  async queryUtility(coordinates, signal) {
    try {
      const attributes = (await queryAustinLayer(AUSTIN_ELECTRIC_PROVENANCE.sourceUrl, 'SERVICE_AREA', coordinates, signal))[0]
      return {
        available: true,
        value: {
          utilityName: String(attributes?.SERVICE_AREA || 'Austin Energy'),
          utilityType: 'electric',
          inServiceArea: Boolean(attributes),
          jurisdiction: 'City of Austin, TX',
        },
        provenance: AUSTIN_ELECTRIC_PROVENANCE,
      }
    } catch (error) {
      return { available: false, provenance: AUSTIN_ELECTRIC_PROVENANCE, error: error instanceof Error ? error.message : String(error) }
    }
  },
  async query(coordinates, signal) {
    try {
      const [zoningResult, jurisdictionResult, overlayResult, flumResult] = await Promise.allSettled([
        queryAustinLayer(AUSTIN_ZONING_PROVENANCE.sourceUrl, 'ZONING_ZTYPE,ZONING_BASE', coordinates, signal),
        queryAustinLayer(AUSTIN_JURISDICTION_SOURCE_URL, 'CITY_NAME,JURISDICTION_LABEL,JURISDICTION_TYPE,JURISDICTION_TYPE_SPECIFICS', coordinates, signal),
        queryAustinOverlays(coordinates, signal),
        queryAustinLayer(AUSTIN_FLUM_SOURCE_URL, '*', coordinates, signal),
      ])
      const attributes = zoningResult.status === 'fulfilled' ? zoningResult.value[0] : undefined
      if (!attributes) return { available: false, provenance: AUSTIN_ZONING_PROVENANCE, error: 'No Austin zoning district was returned at this point.' }
      const jurisdictionAttributes = jurisdictionResult.status === 'fulfilled' ? jurisdictionResult.value[0] : undefined
      const flumAttributes = flumResult.status === 'fulfilled' ? flumResult.value[0] : undefined
      const zoningCode = String(attributes.ZONING_ZTYPE || '')
      const mappedBaseDistrict = String(attributes.ZONING_BASE || zoningCode)
      const profile = buildAustinJurisdictionProfile({
        zoningCode,
        baseDistrict: mappedBaseDistrict,
        cityName: firstAttribute(jurisdictionAttributes, ['CITY_NAME']),
        jurisdictionCode: firstAttribute(jurisdictionAttributes, ['JURISDICTION_TYPE']),
        jurisdictionLabel: firstAttribute(jurisdictionAttributes, ['JURISDICTION_LABEL', 'JURISDICTION_TYPE_SPECIFICS']),
        overlays: overlayResult.status === 'fulfilled' ? overlayResult.value : [],
        futureLandUse: firstAttribute(flumAttributes, ['FUTURE_LAND_USE', 'FUTURE LAND USE', 'FLUM']),
      })
      profile.sources = [
        ...(profile.sources ?? []),
        { id: 'permitted-uses', label: 'Permitted uses', url: AUSTIN_PERMITTED_USES_SOURCE_URL, role: 'permitted-uses' },
      ]
      return {
        available: true,
        value: { zoningCode, baseDistrict: profile.baseDistrict, jurisdiction: profile.jurisdictionLabel, profile },
        provenance: AUSTIN_ZONING_PROVENANCE,
      }
    } catch (error) {
      return { available: false, provenance: AUSTIN_ZONING_PROVENANCE, error: error instanceof Error ? error.message : String(error) }
    }
  },
}
