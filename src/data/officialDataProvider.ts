import type { Coordinates, DataProvenance, JurisdictionAuthority } from '../types/site'
import { fetchBps, fetchContamination, fetchSoils, fetchSpecies, fetchUtilityService, type BpsObservation, type ContaminationObservation, type SoilsObservation, type SpeciesObservation, type UtilityObservation } from './nationalAdapters'
import { fetchEasements, fetchUtilityCapacity, fetchZoningAtlas, type EasementsObservation, type UtilityCapacityObservation, type ZoningObservation } from './localAdapters'
import { fetchStormwater, type StormwaterObservation } from './stormwaterProvider'
import { externalRequest } from './externalRequest'
import { CENSUS_AUTHORITY_PROVENANCE, fetchJurisdictionAuthority } from './jurisdictions/authorityProvider'
import { fetchBroadband, fetchProtectedLands, fetchSewerService, fetchTransportation, type BroadbandObservation, type ProtectedLandsObservation, type SewerObservation, type TransportationObservation } from './nationalContextProvider'

export interface OfficialObservation<T> {
  available: boolean
  value?: T
  provenance: DataProvenance
  error?: string
}

export interface OfficialSiteData {
  flood: OfficialObservation<{
    zone: string
    subtype: string
    sfha: boolean
    floodway: boolean
    risk: 'Low' | 'Moderate' | 'High' | 'Floodway' | 'Undetermined'
  }>
  slope: OfficialObservation<{
    slopePercent: number
    centerElevationMeters: number
    resolutionMeters?: number
    sampleRadiusMeters: number
  }>
  road: OfficialObservation<{
    nearestDistanceMeters: number
    roadName: string
    roadClass: 'Primary' | 'Secondary' | 'Local'
  }>
  demographics: OfficialObservation<{
    growthPercent: number
    currentPopulation: number
    priorPopulation: number
    geography: string
  }>
  environmental: OfficialObservation<{
    mappedWetland: boolean
    wetlandType?: string
    classification?: string
  }>
  soils: SoilsObservation
  contamination: ContaminationObservation
  species: SpeciesObservation
  utilityService: UtilityObservation
  sewerService: SewerObservation
  broadband: BroadbandObservation
  protectedLands: ProtectedLandsObservation
  transportation: TransportationObservation
  bps: BpsObservation
  stormwater: StormwaterObservation
  easements: EasementsObservation
  zoning?: ZoningObservation
  localUtility?: UtilityCapacityObservation
  authority: OfficialObservation<JurisdictionAuthority>
  fetchedAt: string
}

export type OfficialCategory = 'flood' | 'slope' | 'road' | 'demographics' | 'environmental' | 'soils' | 'contamination' | 'species' | 'utilityService' | 'sewerService' | 'broadband' | 'protectedLands' | 'transportation' | 'bps' | 'stormwater' | 'easements' | 'zoning' | 'localUtility' | 'authority'

export const OFFICIAL_SOURCE_COUNT = 19

export interface OfficialSiteProgress {
  data: OfficialSiteData
  pending: OfficialCategory[]
}

const FEMA_SOURCE: DataProvenance = {
  source: 'FEMA National Flood Hazard Layer',
  sourceUrl: 'https://hazards.fema.gov/femaportal/resources/flood_map_svc.htm',
  vintage: 'Live NFHL service',
  coverageNote: 'Point intersection only; a parcel-wide overlay and elevation certificate may produce a different result.',
}

const USGS_SOURCE: DataProvenance = {
  source: 'USGS 3D Elevation Program',
  sourceUrl: 'https://www.usgs.gov/3d-elevation-program/about-3dep-products-services',
  vintage: 'Live National Map elevation service',
  coverageNote: 'Local terrain estimate from four samples around the point; not a boundary survey or grading plan.',
}

const ROAD_SOURCE: DataProvenance = {
  source: 'U.S. Census TIGERweb Transportation',
  sourceUrl: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer',
  vintage: 'January 1, 2025 roads',
  coverageNote: 'Measures distance to a mapped road. It does not prove legal access, frontage, curb-cut approval, or road capacity.',
}

const CENSUS_SOURCE: DataProvenance = {
  source: 'U.S. Census ACS 5-year estimates',
  sourceUrl: 'https://www.census.gov/data/developers/data-sets/acs-5year/2024.html',
  vintage: '2019–2024 ACS 5-year estimates',
  coverageNote: 'Tract population change is a market context signal, not a demand or absorption study.',
}

const WETLAND_SOURCE: DataProvenance = {
  source: 'U.S. Fish & Wildlife Service National Wetlands Inventory',
  sourceUrl: 'https://www.fws.gov/program/national-wetlands-inventory/web-mapping-services',
  vintage: 'Live NWI wetlands service',
  coverageNote: 'Point intersection only. NWI is not a regulatory or jurisdictional wetland determination.',
}

function unavailable<T>(provenance: DataProvenance, error: unknown): OfficialObservation<T> {
  const message = error instanceof Error ? error.message : String(error)
  return { available: false, provenance, error: message }
}

function pending<T>(provenance: DataProvenance): OfficialObservation<T> {
  return { available: false, provenance, error: 'Source check is still in progress' }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let lastError: unknown = new Error('Source query failed')
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12_000)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const response = await externalRequest(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`Source returned ${response.status}`)
      const data = await response.json() as T & { error?: { message?: string } }
      if (data.error) throw new Error(data.error.message || 'Source query failed')
      return data
    } catch (error) {
      lastError = error
      if (signal?.aborted || attempt === 1) throw error
      await new Promise((resolve) => window.setTimeout(resolve, 350))
    } finally {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }
  throw lastError
}

async function fetchFlood(coordinates: Coordinates, signal?: AbortSignal): Promise<OfficialSiteData['flood']> {
  try {
    const params = new URLSearchParams({
      f: 'json', geometry: `${coordinates.lng},${coordinates.lat}`, geometryType: 'esriGeometryPoint',
      inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF,DFIRM_ID', returnGeometry: 'false',
    })
    const data = await getJson<{ features?: Array<{ attributes: Record<string, string | null> }> }>(
      `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${params}`, signal,
    )
    const attributes = data.features?.[0]?.attributes
    if (!attributes) throw new Error('No mapped flood-hazard zone at this point')
    const zone = String(attributes.FLD_ZONE || 'Unknown')
    const subtype = String(attributes.ZONE_SUBTY || '')
    const sfha = String(attributes.SFHA_TF || '').toUpperCase() === 'T'
    const floodway = /floodway/i.test(subtype)
    const risk = floodway ? 'Floodway' : sfha ? 'High' : /0\.2|moderate/i.test(subtype) ? 'Moderate' : zone === 'D' ? 'Undetermined' : 'Low'
    return { available: true, value: { zone, subtype, sfha, floodway, risk }, provenance: FEMA_SOURCE }
  } catch (error) {
    return unavailable(FEMA_SOURCE, error)
  }
}

interface ElevationResponse {
  value?: number
  elevation?: number
  resolution?: number
}

async function elevationAt(coordinates: Coordinates, signal?: AbortSignal) {
  const params = new URLSearchParams({ x: String(coordinates.lng), y: String(coordinates.lat), units: 'Meters', wkid: '4326', includeDate: 'false' })
  const result = await getJson<ElevationResponse>(`https://epqs.nationalmap.gov/v1/json?${params}`, signal)
  const elevation = Number(result.value ?? result.elevation)
  if (!Number.isFinite(elevation)) throw new Error('No elevation returned for this point')
  return { elevation, resolution: Number.isFinite(Number(result.resolution)) ? Number(result.resolution) : undefined }
}

async function fetchSlope(coordinates: Coordinates, signal?: AbortSignal): Promise<OfficialSiteData['slope']> {
  try {
    const radius = 50
    const latDelta = radius / 111_320
    const lngDelta = radius / (111_320 * Math.cos(coordinates.lat * Math.PI / 180))
    const samples = await Promise.all([
      coordinates,
      { lat: coordinates.lat + latDelta, lng: coordinates.lng },
      { lat: coordinates.lat - latDelta, lng: coordinates.lng },
      { lat: coordinates.lat, lng: coordinates.lng + lngDelta },
      { lat: coordinates.lat, lng: coordinates.lng - lngDelta },
    ].map((point) => elevationAt(point, signal)))
    const [center, north, south, east, west] = samples
    const northSouthGradient = (north.elevation - south.elevation) / (radius * 2)
    const eastWestGradient = (east.elevation - west.elevation) / (radius * 2)
    const slopePercent = Math.sqrt(northSouthGradient ** 2 + eastWestGradient ** 2) * 100
    return {
      available: true,
      value: {
        slopePercent: Math.round(slopePercent * 10) / 10,
        centerElevationMeters: Math.round(center.elevation * 10) / 10,
        resolutionMeters: center.resolution,
        sampleRadiusMeters: radius,
      },
      provenance: USGS_SOURCE,
    }
  } catch (error) {
    return unavailable(USGS_SOURCE, error)
  }
}

interface RoadFeature {
  attributes: Record<string, string | null>
  geometry?: { paths?: number[][][] }
}

function pointToSegmentDistance(point: [number, number], start: [number, number], end: [number, number]) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1])
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy))
}

function roadDistanceMeters(coordinates: Coordinates, feature: RoadFeature) {
  const cosLat = Math.cos(coordinates.lat * Math.PI / 180)
  const local = ([lng, lat]: number[]): [number, number] => [(lng - coordinates.lng) * 111_320 * cosLat, (lat - coordinates.lat) * 110_540]
  let minimum = Number.POSITIVE_INFINITY
  for (const path of feature.geometry?.paths || []) {
    for (let index = 1; index < path.length; index += 1) {
      minimum = Math.min(minimum, pointToSegmentDistance([0, 0], local(path[index - 1]), local(path[index])))
    }
  }
  return minimum
}

async function fetchRoads(coordinates: Coordinates, signal?: AbortSignal): Promise<OfficialSiteData['road']> {
  try {
    const layers = [{ id: 2, label: 'Primary' }, { id: 6, label: 'Secondary' }, { id: 8, label: 'Local' }] as const
    const responses = await Promise.all(layers.map(async (layer) => {
      const params = new URLSearchParams({
        f: 'json', geometry: `${coordinates.lng},${coordinates.lat}`, geometryType: 'esriGeometryPoint',
        inSR: '4326', spatialRel: 'esriSpatialRelIntersects', distance: '500', units: 'esriSRUnit_Meter',
        outFields: 'BASENAME,NAME,MTFCC', returnGeometry: 'true', outSR: '4326', resultRecordCount: '40',
      })
      const data = await getJson<{ features?: RoadFeature[] }>(
        `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/${layer.id}/query?${params}`, signal,
      )
      return (data.features || []).map((feature) => ({ feature, roadClass: layer.label }))
    }))
    const candidates = responses.flat().map((item) => ({ ...item, distance: roadDistanceMeters(coordinates, item.feature) })).filter((item) => Number.isFinite(item.distance))
    const nearest = candidates.sort((a, b) => a.distance - b.distance)[0]
    if (!nearest) throw new Error('No mapped road found within 500 meters')
    const name = String(nearest.feature.attributes.NAME || nearest.feature.attributes.BASENAME || 'Unnamed mapped road')
    return {
      available: true,
      value: { nearestDistanceMeters: Math.round(nearest.distance), roadName: name, roadClass: nearest.roadClass },
      provenance: ROAD_SOURCE,
    }
  } catch (error) {
    return unavailable(ROAD_SOURCE, error)
  }
}

interface GeocoderResponse {
  result?: { geographies?: Record<string, Array<Record<string, string>>> }
}

async function fetchDemographics(coordinates: Coordinates, signal?: AbortSignal): Promise<OfficialSiteData['demographics']> {
  const apiKey = import.meta.env.VITE_CENSUS_API_KEY as string | undefined
  if (!apiKey) return unavailable(CENSUS_SOURCE, new Error('Add VITE_CENSUS_API_KEY to enable official population growth'))
  try {
    const geoParams = new URLSearchParams({ x: String(coordinates.lng), y: String(coordinates.lat), benchmark: 'Public_AR_Current', vintage: 'Current_Current', format: 'json' })
    const geocoder = await getJson<GeocoderResponse>(`https://geocoding.geo.census.gov/geocoder/geographies/coordinates?${geoParams}`, signal)
    const tract = geocoder.result?.geographies?.['Census Tracts']?.[0]
    if (!tract) throw new Error('No Census tract found at this point')
    const state = tract.STATE.padStart(2, '0')
    const county = tract.COUNTY.padStart(3, '0')
    const tractCode = tract.TRACT.padStart(6, '0')
    const fetchYear = async (year: number) => {
      const params = new URLSearchParams({ get: 'NAME,B01003_001E', for: `tract:${tractCode}`, in: `state:${state} county:${county}`, key: apiKey })
      const rows = await getJson<string[][]>(`https://api.census.gov/data/${year}/acs/acs5?${params}`, signal)
      const population = Number(rows[1]?.[1])
      if (!Number.isFinite(population)) throw new Error(`No ${year} ACS population estimate`)
      return { population, name: rows[1]?.[0] || 'Census tract' }
    }
    const [current, prior] = await Promise.all([fetchYear(2024), fetchYear(2019)])
    if (prior.population <= 0) throw new Error('Prior ACS population estimate is zero')
    const growthPercent = (current.population - prior.population) / prior.population * 100
    return {
      available: true,
      value: { growthPercent: Math.round(growthPercent * 10) / 10, currentPopulation: current.population, priorPopulation: prior.population, geography: current.name },
      provenance: CENSUS_SOURCE,
    }
  } catch (error) {
    return unavailable(CENSUS_SOURCE, error)
  }
}

async function fetchWetlands(coordinates: Coordinates, signal?: AbortSignal): Promise<OfficialSiteData['environmental']> {
  try {
    const params = new URLSearchParams({
      f: 'json', geometry: `${coordinates.lng},${coordinates.lat}`, geometryType: 'esriGeometryPoint',
      inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: 'Wetlands.ATTRIBUTE,Wetlands.WETLAND_TYPE', returnGeometry: 'false',
    })
    const data = await getJson<{ features?: Array<{ attributes: Record<string, string | null> }> }>(
      `https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query?${params}`, signal,
    )
    const attributes = data.features?.[0]?.attributes
    return {
      available: true,
      value: attributes ? {
        mappedWetland: true,
        wetlandType: String(attributes['Wetlands.WETLAND_TYPE'] || 'Mapped wetland'),
        classification: String(attributes['Wetlands.ATTRIBUTE'] || ''),
      } : { mappedWetland: false },
      provenance: WETLAND_SOURCE,
    }
  } catch (error) {
    return unavailable(WETLAND_SOURCE, error)
  }
}

export async function fetchOfficialSiteData(coordinates: Coordinates, signal?: AbortSignal, onProgress?: (progress: OfficialSiteProgress) => void, stateCode?: string): Promise<OfficialSiteData> {
  const cacheKey = `${coordinates.lat.toFixed(5)},${coordinates.lng.toFixed(5)}`
  const cached = officialDataCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    onProgress?.({ data: cached.data, pending: [] })
    return cached.data
  }

  let data: OfficialSiteData = {
    flood: pending(FEMA_SOURCE), slope: pending(USGS_SOURCE), road: pending(ROAD_SOURCE),
    demographics: pending(CENSUS_SOURCE), environmental: pending(WETLAND_SOURCE),
    soils: { available: false, provenance: { source: 'USDA NRCS SDA', sourceUrl: '' }, error: 'Source check is still in progress' },
    contamination: { available: false, provenance: { source: 'EPA FRS', sourceUrl: '' }, error: 'Source check is still in progress' },
    species: { available: false, provenance: { source: 'USFWS ECOS', sourceUrl: '' }, error: 'Source check is still in progress' },
    utilityService: { available: false, provenance: { source: 'EPA SDWIS', sourceUrl: '' }, error: 'Source check is still in progress' },
    sewerService: { available: false, provenance: { source: 'EPA Sewersheds', sourceUrl: '' }, error: 'Source check is still in progress' },
    broadband: { available: false, provenance: { source: 'FCC National Broadband Map', sourceUrl: '' }, error: 'Source check is still in progress' },
    protectedLands: { available: false, provenance: { source: 'USGS PAD-US', sourceUrl: '' }, error: 'Source check is still in progress' },
    transportation: { available: false, provenance: { source: 'USDOT BTS NTAD', sourceUrl: '' }, error: 'Source check is still in progress' },
    bps: { available: false, provenance: { source: 'Census BPS', sourceUrl: '' }, error: 'Source check is still in progress' },
    stormwater: { available: false, provenance: { source: 'USGS 3DEP drainage', sourceUrl: '' }, error: 'Source check is still in progress' },
    easements: { available: false, provenance: { source: 'Local GIS', sourceUrl: '' }, error: 'Source check is still in progress' },
    zoning: { available: false, provenance: { source: 'Local zoning atlas', sourceUrl: '' }, error: 'Source check is still in progress' },
    localUtility: { available: false, provenance: { source: 'Local utility service area', sourceUrl: '' }, error: 'Source check is still in progress' },
    authority: pending(CENSUS_AUTHORITY_PROVENANCE),
    fetchedAt: new Date().toISOString(),
  }
  const remaining = new Set<OfficialCategory>(['flood', 'slope', 'road', 'demographics', 'environmental', 'soils', 'contamination', 'species', 'utilityService', 'sewerService', 'broadband', 'protectedLands', 'transportation', 'bps', 'stormwater', 'easements', 'zoning', 'localUtility', 'authority'])
  const publish = <K extends OfficialCategory>(category: K, observation: OfficialSiteData[K]) => {
    data = { ...data, [category]: observation, fetchedAt: new Date().toISOString() }
    remaining.delete(category)
    onProgress?.({ data, pending: [...remaining] })
  }

  await Promise.all([
    fetchFlood(coordinates, signal).then((value) => publish('flood', value)),
    fetchSlope(coordinates, signal).then((value) => publish('slope', value)),
    fetchRoads(coordinates, signal).then((value) => publish('road', value)),
    fetchDemographics(coordinates, signal).then((value) => publish('demographics', value)),
    fetchWetlands(coordinates, signal).then((value) => publish('environmental', value)),
    fetchSoils(coordinates, signal).then((value) => publish('soils', value)),
    fetchContamination(coordinates, signal).then((value) => publish('contamination', value)),
    fetchSpecies(coordinates, signal).then((value) => publish('species', value)),
    fetchUtilityService(coordinates, signal).then((value) => publish('utilityService', value)),
    fetchSewerService(coordinates, signal).then((value) => publish('sewerService', value)),
    fetchBroadband(coordinates).then((value) => publish('broadband', value)),
    fetchProtectedLands(coordinates, signal).then((value) => publish('protectedLands', value)),
    fetchTransportation(coordinates, signal).then((value) => publish('transportation', value)),
    fetchBps(coordinates, signal).then((value) => publish('bps', value)),
    fetchStormwater(coordinates, signal).then((value) => publish('stormwater', value)),
    fetchEasements(coordinates, stateCode || 'XX', signal).then((value) => publish('easements', value)),
    fetchZoningAtlas(coordinates, stateCode || 'XX', signal).then((value) => publish('zoning', value)),
    fetchUtilityCapacity(coordinates, stateCode || 'XX', signal).then((value) => publish('localUtility', value)),
    fetchJurisdictionAuthority(coordinates, stateCode || 'XX', signal).then((value) => publish('authority', value)),
  ])
  officialDataCache.set(cacheKey, { data, expiresAt: Date.now() + 10 * 60_000 })
  return data
}

const officialDataCache = new Map<string, { data: OfficialSiteData; expiresAt: number }>()
