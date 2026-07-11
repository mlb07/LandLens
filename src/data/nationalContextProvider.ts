import type { Coordinates, DataProvenance } from '../types/site'
import type { OfficialObservation } from './officialDataProvider'
import { externalRequest } from './externalRequest'

const SEWER_PROVENANCE: DataProvenance = {
  source: 'EPA National Sewershed Dataset',
  sourceUrl: 'https://www.epa.gov/cwns/sewersheds',
  vintage: 'Version 1.1, January 2026; live EPA feature service',
  coverageNote: 'EPA says sewersheds are not authoritative property-level connection records. Most boundaries are modeled, private systems are excluded, and local utilities remain the binding source.',
}

const PROTECTED_LANDS_PROVENANCE: DataProvenance = {
  source: 'USGS Protected Areas Database of the United States (PAD-US)',
  sourceUrl: 'https://www.usgs.gov/programs/gap-analysis-project/science/pad-us-web-services',
  vintage: 'PAD-US 4.1; live USGS feature service',
  coverageNote: 'PAD-US aggregates fee lands, easements, and management designations. An intersection is a title and agency-review flag, not proof that development is prohibited; source agencies may be newer.',
}

const TRANSPORTATION_PROVENANCE: DataProvenance = {
  source: 'USDOT BTS National Transportation Atlas Database — North American Rail Network',
  sourceUrl: 'https://www.bts.gov/ntad',
  vintage: 'April 28, 2026 rail network',
  coverageNote: 'Rail proximity is transportation context only. It does not establish a crossing, siding, freight service, legal access, noise level, or development approval.',
}

const BROADBAND_PROVENANCE: DataProvenance = {
  source: 'FCC Broadband Data Collection / National Broadband Map',
  sourceUrl: 'https://broadbandmap.fcc.gov/home',
  vintage: 'Current FCC National Broadband Map',
  coverageNote: 'Provider-reported availability is tied to FCC Broadband Serviceable Locations. The underlying Location Fabric is licensed; the public map should be checked and challenged where inaccurate.',
}

interface ArcGisFeature {
  attributes: Record<string, string | number | null>
  geometry?: { paths?: number[][][] }
}

interface ArcGisFeatureSet {
  features?: ArcGisFeature[]
  error?: { message?: string }
}

async function getJson<T>(url: string, signal?: AbortSignal, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await externalRequest(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Source returned ${response.status}`)
    const data = await response.json() as T & { error?: { message?: string } }
    if (data.error) throw new Error(data.error.message || 'Source query failed')
    return data
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

function unavailable<T>(provenance: DataProvenance, error: unknown): OfficialObservation<T> {
  return { available: false, provenance, error: error instanceof Error ? error.message : String(error) }
}

function pointQuery(coordinates: Coordinates, outFields: string) {
  return new URLSearchParams({
    f: 'json',
    geometry: `${coordinates.lng},${coordinates.lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'false',
    resultRecordCount: '20',
  })
}

export interface SewerData {
  inMappedSewershed: boolean
  facilityName: string
  cwnsId: string
  npdesId: string
  method: 'sourced' | 'modeled' | 'unknown'
  meanModelProbability?: number
  source: string
  echoUrl: string
}

export type SewerObservation = OfficialObservation<SewerData>

export async function fetchSewerService(coordinates: Coordinates, signal?: AbortSignal): Promise<SewerObservation> {
  try {
    const params = pointQuery(coordinates, 'CWNS_ID,FACILITY_NAME,Method,Mean_Prob,Source,NPDES_ID,ECHO_URL')
    const data = await getJson<ArcGisFeatureSet>(
      `https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/National_Sewershed_Web_Map_Internal_WFL1/FeatureServer/8/query?${params}`,
      signal,
    )
    const attributes = data.features?.[0]?.attributes
    if (!attributes) {
      return { available: true, value: { inMappedSewershed: false, facilityName: '', cwnsId: '', npdesId: '', method: 'unknown', source: '', echoUrl: '' }, provenance: SEWER_PROVENANCE }
    }
    const rawMethod = String(attributes.Method || '').toLowerCase()
    const probability = Number(attributes.Mean_Prob)
    return {
      available: true,
      value: {
        inMappedSewershed: true,
        facilityName: String(attributes.FACILITY_NAME || ''),
        cwnsId: String(attributes.CWNS_ID || ''),
        npdesId: String(attributes.NPDES_ID || ''),
        method: rawMethod === 'sourced' ? 'sourced' : rawMethod === 'modeled' ? 'modeled' : 'unknown',
        meanModelProbability: Number.isFinite(probability) ? probability : undefined,
        source: String(attributes.Source || ''),
        echoUrl: String(attributes.ECHO_URL || ''),
      },
      provenance: SEWER_PROVENANCE,
    }
  } catch (error) {
    return unavailable(SEWER_PROVENANCE, error)
  }
}

export interface ProtectedLandInterest {
  category: string
  featureClass: string
  unitName: string
  publicAccess: string
  gapStatus: string
  managerType: string
  managerName: string
  designationType: string
}

export interface ProtectedLandsData {
  intersects: boolean
  interests: ProtectedLandInterest[]
  highestProtectionStatus?: number
  hasFeeInterest: boolean
  hasEasementOrDesignation: boolean
}

export type ProtectedLandsObservation = OfficialObservation<ProtectedLandsData>

export function normalizeProtectedLandFeatures(features: ArcGisFeature[]): ProtectedLandsData {
  const interests = features.map(({ attributes }) => ({
    category: String(attributes.Category || ''),
    featureClass: String(attributes.FeatClass || ''),
    unitName: String(attributes.Unit_Nm || ''),
    publicAccess: String(attributes.Pub_Access || ''),
    gapStatus: String(attributes.GAP_Sts || ''),
    managerType: String(attributes.MngTp_Desc || ''),
    managerName: String(attributes.MngNm_Desc || ''),
    designationType: String(attributes.DesTp_Desc || ''),
  }))
  const statuses = interests.map((item) => Number(item.gapStatus)).filter((value) => Number.isFinite(value) && value > 0)
  return {
    intersects: interests.length > 0,
    interests,
    highestProtectionStatus: statuses.length ? Math.min(...statuses) : undefined,
    hasFeeInterest: interests.some((item) => /fee/i.test(`${item.category} ${item.featureClass}`)),
    hasEasementOrDesignation: interests.some((item) => /easement|designation/i.test(`${item.category} ${item.featureClass}`)),
  }
}

export async function fetchProtectedLands(coordinates: Coordinates, signal?: AbortSignal): Promise<ProtectedLandsObservation> {
  try {
    const params = pointQuery(coordinates, 'Category,FeatClass,Unit_Nm,Pub_Access,GAP_Sts,MngTp_Desc,MngNm_Desc,DesTp_Desc')
    const data = await getJson<ArcGisFeatureSet>(
      `https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/PADUS_Protection_Status_by_GAP_Status_Code/FeatureServer/0/query?${params}`,
      signal,
    )
    return { available: true, value: normalizeProtectedLandFeatures(data.features || []), provenance: PROTECTED_LANDS_PROVENANCE }
  } catch (error) {
    return unavailable(PROTECTED_LANDS_PROVENANCE, error)
  }
}

const PASSENGER_CODES: Record<string, string> = {
  A: 'Amtrak', B: 'Amtrak and commuter', C: 'Commuter', D: 'Alaska Railroad passenger',
  E: 'High-speed intercity and commuter', I: 'High-speed intercity', R: 'Rapid transit', T: 'Tourist or museum',
}

function pointToSegmentDistance(point: [number, number], start: [number, number], end: [number, number]) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1])
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy))
}

function railDistanceMeters(coordinates: Coordinates, feature: ArcGisFeature) {
  const cosLat = Math.cos(coordinates.lat * Math.PI / 180)
  const local = ([lng, lat]: number[]): [number, number] => [(lng - coordinates.lng) * 111_320 * cosLat, (lat - coordinates.lat) * 110_540]
  let minimum = Number.POSITIVE_INFINITY
  for (const path of feature.geometry?.paths || []) {
    for (let index = 1; index < path.length; index += 1) minimum = Math.min(minimum, pointToSegmentDistance([0, 0], local(path[index - 1]), local(path[index])))
  }
  return minimum
}

export interface TransportationData {
  railWithinFiveKm: boolean
  nearestRailDistanceMeters?: number
  railOwner: string
  trackCount?: number
  passengerService: string
  strategicRailNetwork: boolean
}

export type TransportationObservation = OfficialObservation<TransportationData>

export async function fetchTransportation(coordinates: Coordinates, signal?: AbortSignal): Promise<TransportationObservation> {
  try {
    const params = pointQuery(coordinates, 'RROWNER1,TRACKS,PASSNGR,STRACNET')
    params.set('distance', '5000')
    params.set('units', 'esriSRUnit_Meter')
    params.set('returnGeometry', 'true')
    params.set('outSR', '4326')
    params.set('resultRecordCount', '100')
    const data = await getJson<ArcGisFeatureSet>(
      `https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines/FeatureServer/0/query?${params}`,
      signal,
    )
    const candidates = (data.features || []).map((feature) => ({ feature, distance: railDistanceMeters(coordinates, feature) })).filter((item) => Number.isFinite(item.distance))
    const nearest = candidates.sort((a, b) => a.distance - b.distance)[0]
    if (!nearest) return { available: true, value: { railWithinFiveKm: false, railOwner: '', passengerService: '', strategicRailNetwork: false }, provenance: TRANSPORTATION_PROVENANCE }
    const attributes = nearest.feature.attributes
    const passengerCode = String(attributes.PASSNGR || '')
    const trackCount = Number(attributes.TRACKS)
    return {
      available: true,
      value: {
        railWithinFiveKm: true,
        nearestRailDistanceMeters: Math.round(nearest.distance),
        railOwner: String(attributes.RROWNER1 || ''),
        trackCount: Number.isFinite(trackCount) ? trackCount : undefined,
        passengerService: PASSENGER_CODES[passengerCode] || '',
        strategicRailNetwork: Boolean(attributes.STRACNET),
      },
      provenance: TRANSPORTATION_PROVENANCE,
    }
  } catch (error) {
    return unavailable(TRANSPORTATION_PROVENANCE, error)
  }
}

export interface BroadbandData {
  lookupUrl: string
  embeddedAvailability: false
  dataAccess: 'public-map'
}

export type BroadbandObservation = OfficialObservation<BroadbandData>

export async function fetchBroadband(coordinates: Coordinates): Promise<BroadbandObservation> {
  void coordinates
  return {
    available: true,
    value: {
      lookupUrl: 'https://broadbandmap.fcc.gov/home',
      embeddedAvailability: false,
      dataAccess: 'public-map',
    },
    provenance: BROADBAND_PROVENANCE,
  }
}
