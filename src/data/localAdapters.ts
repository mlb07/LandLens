import type { Coordinates, DataProvenance } from '../types/site'
import type { OfficialObservation } from './officialDataProvider'
import type { EasementsOverlayInput } from './parcelOverlayProvider'
import { externalRequest } from './externalRequest'

// ─── Local jurisdiction adapter framework ───────────────────────────────
//
// Local GIS data for zoning, utility capacity, easements, and ROW is
// inherently fragmentary — each county/city publishes differently. This
// registry provides a pluggable pattern for wiring local adapters over time.
// An adapter declares the jurisdiction it covers and a query function.
// LandLens checks the registry for the point's jurisdiction and uses the
// adapter if one exists. When no adapter covers the point, the category
// remains unavailable with an honest explanation.

export type LocalCategory = 'easements' | 'zoningAtlas' | 'utilityCapacity'

export interface LocalAdapterResult {
  available: boolean
  value?: unknown
  provenance: DataProvenance
  error?: string
}

export interface LocalAdapter {
  id: string
  category: LocalCategory
  jurisdiction: string         // e.g. "Travis County, TX"
  stateCode: string
  bounds?: { south: number; west: number; north: number; east: number }
  query: (coordinates: Coordinates, signal?: AbortSignal) => Promise<LocalAdapterResult>
}

// ─── Easements observation type ─────────────────────────────────────────

export interface EasementData {
  hasRecordedEasements: boolean
  easementTypes: string[]
  sourceLayer: string
}

export type EasementsObservation = OfficialObservation<EasementData>

export interface ZoningData {
  zoningCode: string
  baseDistrict: string
  jurisdiction: string
}

export interface UtilityCapacityData {
  utilityName: string
  utilityType: 'electric' | 'water' | 'sewer' | 'multiple'
  inServiceArea: boolean
  jurisdiction: string
}

export type ZoningObservation = OfficialObservation<ZoningData>
export type UtilityCapacityObservation = OfficialObservation<UtilityCapacityData>

// ─── Registry ───────────────────────────────────────────────────────────

const registry: LocalAdapter[] = []

export function registerLocalAdapter(adapter: LocalAdapter): void {
  if (!registry.some((a) => a.id === adapter.id)) {
    registry.push(adapter)
  }
}

export function getLocalAdapters(category: LocalCategory, coordinates: Coordinates, stateCode: string): LocalAdapter[] {
  return registry.filter((a) =>
    a.category === category &&
    a.stateCode === stateCode &&
    (!a.bounds || (
      coordinates.lat >= a.bounds.south && coordinates.lat <= a.bounds.north &&
      coordinates.lng >= a.bounds.west && coordinates.lng <= a.bounds.east
    )),
  )
}

export function hasLocalCoverage(category: LocalCategory, stateCode: string): boolean {
  return registry.some((a) => a.category === category && a.stateCode === stateCode)
}

// ─── Easements fetch ────────────────────────────────────────────────────

const EASEMENTS_PROVENANCE: DataProvenance = {
  source: 'Local GIS easement/ROW overlay',
  sourceUrl: '',
  vintage: 'Local jurisdiction service',
  coverageNote: 'Easement and ROW overlays are local and fragmentary. No national easement dataset exists. A title commitment and ALTA survey remain the authoritative source. LandLens wires local GIS adapters where available.',
}

const EASEMENTS_FALLBACK_PROVENANCE: DataProvenance = {
  source: 'No local easement adapter',
  sourceUrl: 'https://www.alta.org/',
  vintage: 'N/A',
  coverageNote: 'No local GIS easement/ROW adapter is registered for this jurisdiction. Easements, encumbrances, covenants, and dedications can only be confirmed from title commitment and an ALTA/NSPS land title survey. This is the authoritative source and cannot be replaced by screening data.',
}

export async function fetchEasements(coordinates: Coordinates, stateCode: string, signal?: AbortSignal): Promise<EasementsObservation> {
  const adapters = getLocalAdapters('easements', coordinates, stateCode)
  if (!adapters.length) {
    return {
      available: false,
      provenance: EASEMENTS_FALLBACK_PROVENANCE,
      error: 'No local GIS easement adapter is registered for this jurisdiction. A title commitment and ALTA survey are required.',
    }
  }

  // Try each matching adapter until one returns data.
  for (const adapter of adapters) {
    try {
      const result = await adapter.query(coordinates, signal)
      if (result.available && result.value) {
        return {
          available: true,
          value: result.value as EasementData,
          provenance: { ...result.provenance, ...EASEMENTS_PROVENANCE },
        }
      }
    } catch {
      // Try the next adapter
    }
  }

  return {
    available: false,
    provenance: EASEMENTS_PROVENANCE,
    error: 'Local easement adapters were found but did not return usable data.',
  }
}

const ZONING_FALLBACK_PROVENANCE: DataProvenance = {
  source: 'No local zoning atlas adapter',
  sourceUrl: '',
  vintage: 'N/A',
  coverageNote: 'No official zoning-atlas adapter is registered for this jurisdiction. Confirm the zoning district, overlays, permitted use, development standards, and entitlement path with the local planning department.',
}

const UTILITY_FALLBACK_PROVENANCE: DataProvenance = {
  source: 'No local utility-service adapter',
  sourceUrl: '',
  vintage: 'N/A',
  coverageNote: 'No local utility-service adapter is registered for this jurisdiction. A utility service map does not prove capacity, allocation, extension cost, or a right to serve; obtain written will-serve/capacity letters.',
}

async function fetchLocalObservation<T>(
  category: 'zoningAtlas' | 'utilityCapacity',
  coordinates: Coordinates,
  stateCode: string,
  fallback: DataProvenance,
  signal?: AbortSignal,
): Promise<OfficialObservation<T>> {
  const adapters = getLocalAdapters(category, coordinates, stateCode)
  if (!adapters.length) return { available: false, provenance: fallback, error: `No local ${category === 'zoningAtlas' ? 'zoning-atlas' : 'utility-service'} adapter is registered for this jurisdiction.` }
  for (const adapter of adapters) {
    try {
      const result = await adapter.query(coordinates, signal)
      if (result.available && result.value) return { available: true, value: result.value as T, provenance: result.provenance }
    } catch {
      // Continue to another authoritative adapter covering the same point.
    }
  }
  return { available: false, provenance: fallback, error: `Local ${category === 'zoningAtlas' ? 'zoning-atlas' : 'utility-service'} adapters did not return usable data.` }
}

export function fetchZoningAtlas(coordinates: Coordinates, stateCode: string, signal?: AbortSignal): Promise<ZoningObservation> {
  return fetchLocalObservation<ZoningData>('zoningAtlas', coordinates, stateCode, ZONING_FALLBACK_PROVENANCE, signal)
}

export function fetchUtilityCapacity(coordinates: Coordinates, stateCode: string, signal?: AbortSignal): Promise<UtilityCapacityObservation> {
  return fetchLocalObservation<UtilityCapacityData>('utilityCapacity', coordinates, stateCode, UTILITY_FALLBACK_PROVENANCE, signal)
}

// Resolve the parcel-wide easements overlay from the registered local
// easement adapter for the state. Returns null when no adapter is registered
// (the caller — parcelOverlayProvider — surfaces the standard ALTA/title
// fallback). Returns an EasementsOverlayInput with whatever presence/
// absence signal the adapter can return. Easement polygon geometry is
// returned only when an adapter publishes it; otherwise we surface presence
// only and the overlay code applies a conservative placeholder fraction.
export async function fetchEasementsOverlayForParcel(
  coordinates: Coordinates,
  stateCode: string,
  signal?: AbortSignal,
): Promise<EasementsOverlayInput | null> {
  const adapters = getLocalAdapters('easements', coordinates, stateCode)
  if (!adapters.length) return null
  for (const adapter of adapters) {
    try {
      const result = await adapter.query(coordinates, signal)
      if (result.available && result.value) {
        const v = result.value as EasementData & { polygonRings?: number[][][] }
        return {
          hasRecordedEasements: v.hasRecordedEasements,
          easementTypes: v.easementTypes,
          sourceLayer: v.sourceLayer,
          polygonRings: v.polygonRings,
        }
      }
    } catch {
      // try next adapter
    }
  }
  return null
}

// ─── Coverage summary ───────────────────────────────────────────────────

export function getLocalCoverageSummary(): Record<LocalCategory, string[]> {
  const summary: Record<LocalCategory, string[]> = { easements: [], zoningAtlas: [], utilityCapacity: [] }
  for (const adapter of registry) {
    if (!summary[adapter.category].includes(adapter.jurisdiction)) {
      summary[adapter.category].push(adapter.jurisdiction)
    }
  }
  return summary
}

// ─── Registered adapters ────────────────────────────────────────────────
//
// Concrete adapters are registered at module load. Each one is a thin wrapper
// over a verified public GIS service. See PROJECT_RECORD.md before adding a
// new jurisdiction — adapters must point at authoritative sources and degrade
// honestly when the service is offline or CORS-blocked.

// Travis County, TX: easement/ROW screening adapter.
//
// Travis County does not publish a dedicated countywide easement polygon
// service that LandLens can verify. We wire the already-verified Travis
// County Tax Maps parcel layer and inspect its returned parcel attributes for
// any easement/ROW flag fields (common Texas appraisal-district field names
// such as EASEMENT, EAS, EAS_YN, NUM_EAS, ROW, ROW_YN). If such a field is
// present on the parcel that contains the selected point and its value is
// truthy, the adapter reports a recorded-easement flag at that parcel.
// Otherwise the adapter reports no recorded easement from this source.
//
// Texas appraisal-district parcel layers do not generally expose a dedicated
// countywide easement polygon service, but several publish the parcel row with
// easement/ROW flag attributes. Each `makeTexasCountyEasementAdapter` factory
// below points at the already-verified county parcel FeatureServer used by the
// `parcelProvider.ts` registry and inspects the returned attributes for any
// easement/ROW flag field name (a common Texas appraisal-district convention).
// A positive flag may undercount easements and the overlay applies only a small
// placeholder acreage subtraction. A title commitment and ALTA/NSPS land title
// survey remain the authoritative source — `EASEMENTS_OVERLAY_PROVENANCE` says
// so explicitly to the user.

// Field names commonly used by Texas appraisal district parcel layers to flag
// easements or ROW on the parcel row itself. None are guaranteed to exist on
// every release; LandLens inspects whatever the service returns at query time.
const EASEMENT_FIELD_NAMES = [
  'easement', 'eas_yn', 'eas_flag', 'num_eas', 'easements',
  'has_easement', 'easement_yn',
  'row', 'row_yn', 'row_flag', 'has_row',
]

function truthyEasementValue(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false
  const str = String(value).trim().toLowerCase()
  if (!str) return false
  return /^(y|yes|t|true|1|easement|row)/.test(str) && !/^(no|n|false|f|0)$/.test(str)
}

interface TexasCountyEasementSpec {
  id: string
  jurisdiction: string
  serviceUrl: string
  bounds: { south: number; west: number; north: number; east: number }
  sourceName: string
  sourceUrl: string
  timeoutMs?: number
}

function makeTexasCountyEasementAdapter(spec: TexasCountyEasementSpec): LocalAdapter {
  const provenance: DataProvenance = {
    source: `${spec.sourceName} (easement flag)`,
    sourceUrl: spec.sourceUrl,
    vintage: 'Live county parcel service',
    coverageNote: `${spec.jurisdiction} does not expose a dedicated countywide easement polygon service. LandLens inspects the parcel layer for recorded-easement/ROW attributes on the parcel that contains the point. This screens for easement-flagged parcels only; a title commitment and ALTA/NSPS land title survey remain the authoritative source.`,
  }
  async function query(coordinates: Coordinates, signal?: AbortSignal): Promise<LocalAdapterResult> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), spec.timeoutMs ?? 12_000)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const params = new URLSearchParams({
        f: 'json',
        geometry: `${coordinates.lng},${coordinates.lat}`,
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: 'false',
        outSR: '4326',
      })
      const response = await externalRequest(
        `${spec.serviceUrl}/query?${params}`,
        { signal: controller.signal },
      )
      if (!response.ok) throw new Error(`${spec.jurisdiction} parcel service returned ${response.status}`)
      const data = await response.json() as { features?: Array<{ attributes?: Record<string, string | number | null> }>; error?: { message?: string } }
      if (data.error) throw new Error(data.error.message || `${spec.jurisdiction} parcel query failed`)
      const feature = data.features?.[0]
      if (!feature || !feature.attributes) {
        return { available: false, provenance, error: `No ${spec.jurisdiction} parcel found at this point.` }
      }
      const matchedTypes: string[] = []
      const lowerAttr = new Map<string, string>()
      for (const [k, v] of Object.entries(feature.attributes)) {
        lowerAttr.set(k.toLowerCase(), String(v ?? ''))
      }
      for (const candidate of EASEMENT_FIELD_NAMES) {
        const value = lowerAttr.get(candidate.toLowerCase())
        if (value !== undefined && truthyEasementValue(value)) {
          matchedTypes.push(candidate.toUpperCase())
        }
      }
      return {
        available: true,
        value: {
          hasRecordedEasements: matchedTypes.length > 0,
          easementTypes: matchedTypes.length ? matchedTypes : ['none flag'],
          sourceLayer: spec.sourceName,
        } as EasementData,
        provenance,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { available: false, provenance, error: message }
    } finally {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }
  return {
    id: spec.id,
    category: 'easements',
    jurisdiction: spec.jurisdiction,
    stateCode: 'TX',
    bounds: spec.bounds,
    query,
  }
}

// The verified Texas county parcel layers (mirrors parcelProvider.ts). Each
// adapter here queries the same authoritative parcel FeatureServer the parcel
// registry uses, then inspects returned attributes for easement/ROW flags.
const TX_COUNTY_EASEMENT_SPECS: TexasCountyEasementSpec[] = [
  {
    id: 'travis-county-tx-easements',
    jurisdiction: 'Travis County, TX',
    serviceUrl: 'https://taxmaps.traviscountytx.gov/arcgis/rest/services/Parcels/FeatureServer/0',
    bounds: { south: 30.01, west: -98.2, north: 30.65, east: -97.36 },
    sourceName: 'Travis County Tax Maps parcel layer',
    sourceUrl: 'https://taxmaps.traviscountytx.gov/arcgis/rest/services/Parcels/FeatureServer/0',
  },
  {
    id: 'dallas-county-tx-easements',
    jurisdiction: 'Dallas County, TX',
    serviceUrl: 'https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/CRMHostedLayers/FeatureServer/13',
    bounds: { south: 32.55, west: -97.04, north: 33.06, east: -96.51 },
    sourceName: 'City of Dallas GIS certified tax parcels',
    sourceUrl: 'https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/CRMHostedLayers/FeatureServer/13',
  },
  {
    id: 'harris-county-tx-easements',
    jurisdiction: 'Harris County, TX',
    serviceUrl: 'https://services.arcgis.com/su8ic9KbA7PYVxPS/arcgis/rest/services/Harris_County_Parcels/FeatureServer/1',
    bounds: { south: 29.49, west: -95.98, north: 30.19, east: -94.89 },
    sourceName: 'Harris County GIS / HCAD parcel polygons',
    sourceUrl: 'https://services.arcgis.com/su8ic9KbA7PYVxPS/arcgis/rest/services/Harris_County_Parcels/FeatureServer/1',
  },
  {
    id: 'bexar-county-tx-easements',
    jurisdiction: 'Bexar County, TX',
    serviceUrl: 'https://maps.bcad.org/arcgis/rest/services/PAMapSearch/MapServer/6',
    bounds: { south: 29.11, west: -98.82, north: 29.77, east: -98.11 },
    sourceName: 'Bexar Appraisal District public parcel layer',
    sourceUrl: 'https://maps.bcad.org/arcgis/rest/services/PAMapSearch/MapServer/6',
  },
  {
    id: 'collin-county-tx-easements',
    jurisdiction: 'Collin County, TX',
    serviceUrl: 'https://services2.arcgis.com/uXyoacYrZTPTKD3R/arcgis/rest/services/CCAD_Parcel_Feature_Set/FeatureServer/4',
    bounds: { south: 32.89, west: -96.93, north: 33.47, east: -96.23 },
    sourceName: 'Collin Central Appraisal District parcels',
    sourceUrl: 'https://services2.arcgis.com/uXyoacYrZTPTKD3R/arcgis/rest/services/CCAD_Parcel_Feature_Set/FeatureServer/4',
  },
  {
    id: 'williamson-county-tx-easements',
    jurisdiction: 'Williamson County, TX',
    serviceUrl: 'https://services1.arcgis.com/Xff0bbfp6vwIWmlU/arcgis/rest/services/WCAD_Tax_Parcels/FeatureServer/0',
    bounds: { south: 30.39, west: -98.06, north: 30.91, east: -97.14 },
    sourceName: 'Williamson Central Appraisal District tax parcels',
    sourceUrl: 'https://services1.arcgis.com/Xff0bbfp6vwIWmlU/arcgis/rest/services/WCAD_Tax_Parcels/FeatureServer/0',
  },
  {
    id: 'montgomery-county-tx-easements',
    jurisdiction: 'Montgomery County, TX',
    serviceUrl: 'https://services1.arcgis.com/PRoAPGnMSUqvTrzq/arcgis/rest/services/Tax_Parcel_view/FeatureServer/0',
    bounds: { south: 30.01, west: -95.87, north: 30.64, east: -95.07 },
    sourceName: 'Montgomery County GIS / MCAD Tax Parcel View',
    sourceUrl: 'https://services1.arcgis.com/PRoAPGnMSUqvTrzq/arcgis/rest/services/Tax_Parcel_view/FeatureServer/0',
  },
  {
    id: 'tarrant-county-tx-easements',
    jurisdiction: 'Tarrant County, TX',
    serviceUrl: 'https://services3.arcgis.com/9GbPfrQRyZbRsXU4/arcgis/rest/services/Basemap_Layer/FeatureServer/113',
    bounds: { south: 32.49, west: -97.61, north: 33.06, east: -97.0 },
    sourceName: 'Tarrant Appraisal District parcel layer',
    sourceUrl: 'https://services3.arcgis.com/9GbPfrQRyZbRsXU4/arcgis/rest/services/Basemap_Layer/FeatureServer/113',
  },
]

const AUSTIN_BOUNDS = { south: 30.08, west: -98.02, north: 30.52, east: -97.53 }

const AUSTIN_ZONING_PROVENANCE: DataProvenance = {
  source: 'City of Austin zoning atlas',
  sourceUrl: 'https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_1/MapServer/0',
  vintage: 'Live City of Austin GIS service',
  coverageNote: 'Official zoning-district lookup for the City of Austin and surrounding mapped area. The district alone does not establish a by-right use: overlays, conditional uses, compatibility, site-plan review, and adopted code control. Confirm with Austin Planning.',
}

const AUSTIN_ELECTRIC_PROVENANCE: DataProvenance = {
  source: 'Austin Energy utility service area',
  sourceUrl: 'https://maps.austintexas.gov/arcgis/rest/services/Shared/BoundariesGrids_2/MapServer/1',
  vintage: 'Live City of Austin GIS service',
  coverageNote: 'Official electric service-boundary lookup only. It does not establish electrical capacity, distribution availability, extension cost, or a right to serve; obtain an Austin Energy service/capacity confirmation.',
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

function makeAustinZoningAdapter(): LocalAdapter {
  return {
    id: 'austin-tx-zoning-atlas', category: 'zoningAtlas', jurisdiction: 'City of Austin, TX', stateCode: 'TX', bounds: AUSTIN_BOUNDS,
    async query(coordinates, signal) {
      try {
        const attributes = (await queryAustinLayer('https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_1/MapServer/0', 'ZONING_ZTYPE,ZONING_BASE', coordinates, signal))[0]
        if (!attributes) return { available: false, provenance: AUSTIN_ZONING_PROVENANCE, error: 'No Austin zoning district was returned at this point.' }
        return { available: true, value: { zoningCode: String(attributes.ZONING_ZTYPE || ''), baseDistrict: String(attributes.ZONING_BASE || ''), jurisdiction: 'City of Austin, TX' } satisfies ZoningData, provenance: AUSTIN_ZONING_PROVENANCE }
      } catch (error) {
        return { available: false, provenance: AUSTIN_ZONING_PROVENANCE, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}

function makeAustinElectricAdapter(): LocalAdapter {
  return {
    id: 'austin-tx-electric-service-area', category: 'utilityCapacity', jurisdiction: 'Austin Energy service area, TX', stateCode: 'TX', bounds: AUSTIN_BOUNDS,
    async query(coordinates, signal) {
      try {
        const attributes = (await queryAustinLayer('https://maps.austintexas.gov/arcgis/rest/services/Shared/BoundariesGrids_2/MapServer/1', 'SERVICE_AREA', coordinates, signal))[0]
        return { available: true, value: { utilityName: String(attributes?.SERVICE_AREA || 'Austin Energy'), utilityType: 'electric', inServiceArea: Boolean(attributes), jurisdiction: 'City of Austin, TX' } satisfies UtilityCapacityData, provenance: AUSTIN_ELECTRIC_PROVENANCE }
      } catch (error) {
        return { available: false, provenance: AUSTIN_ELECTRIC_PROVENANCE, error: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}

// Register the verified local adapters at app startup. Kept as an explicit
// function rather than auto-registering at module load so that the registry
// is empty in unit tests (localAdapters.test.ts expects "starts empty" by
// default) and populated only when the production app boots. Idempotent —
// calling this more than once is safe because registerLocalAdapter dedupes
// by adapter id.
export function registerDefaultLocalAdapters(): void {
  for (const spec of TX_COUNTY_EASEMENT_SPECS) {
    registerLocalAdapter(makeTexasCountyEasementAdapter(spec))
  }
  registerLocalAdapter(makeAustinZoningAdapter())
  registerLocalAdapter(makeAustinElectricAdapter())
}
