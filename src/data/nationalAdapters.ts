import type { Coordinates, DataProvenance } from '../types/site'
import type { OfficialObservation } from './officialDataProvider'

// ─── Provenance ─────────────────────────────────────────────────────────

const SOILS_PROVENANCE: DataProvenance = {
  source: 'USDA NRCS Soil Data Access (SSURGO)',
  sourceUrl: 'https://sdmdataaccess.nrcs.usda.gov/',
  vintage: 'Live SSURGO database',
  coverageNote: 'Point-based soil map unit query. NRCS soils are mapped interpretations, not borings or field perc tests. A geotechnical report is still required.',
}

const CONTAMINATION_PROVENANCE: DataProvenance = {
  source: 'EPA Facility Registry Service (FRS)',
  sourceUrl: 'https://www.epa.gov/frs/facility-registry-service-frs',
  vintage: 'Live FRS service',
  coverageNote: 'Buffer search for EPA-regulated facilities within 1,000 meters. National databases miss some local/historic conditions. A Phase I ESA remains the diligence standard.',
}

const SPECIES_PROVENANCE: DataProvenance = {
  source: 'USFWS IPaC / ECOS Critical Habitat',
  sourceUrl: 'https://ipac.sciencefws.gov/',
  vintage: 'Live ECOS critical habitat service',
  coverageNote: 'Point intersection of USFWS critical habitat polygons. IPaC’s standard resource list is informational and not official consultation correspondence.',
}

const UTILITY_PROVENANCE: DataProvenance = {
  source: 'EPA Public Water System Service Areas (SDWIS)',
  sourceUrl: 'https://www.epa.gov/ground-water-and-drinking-water/safe-drinking-water-information-system-sdwis-federal-reporting',
  vintage: 'Live EPA water service area service',
  coverageNote: 'EPA explicitly states public water service area boundaries may differ from actual service areas and can contain modeling and attribution errors. A will-serve / capacity letter is required.',
}

const BPS_PROVENANCE: DataProvenance = {
  source: 'U.S. Census Building Permits Survey (BPS)',
  sourceUrl: 'https://www.census.gov/data/developers/data-sets/Building-Permits.html',
  vintage: '2023–2024 BPS annual totals',
  coverageNote: 'County-level building permits are a supply signal, not a demand or absorption study. Combined with ACS population trend for market support.',
}

// ─── Shared network helper ──────────────────────────────────────────────

async function getJson<T>(url: string, signal?: AbortSignal, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Source returned ${response.status}`)
    return await response.json() as T
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
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

// ─── 1. Soils (USDA NRCS SSURGO / Soil Data Access) ─────────────────────

export interface SoilData {
  mukey: string
  mapUnitName: string
  drainageClass: string
  hydricClass: string
  dominantRating: 'severe' | 'moderate' | 'slight' | 'not-rated' | 'unknown'
  septicRating: string
  dwellingRating: string
  hydric: boolean
}

export type SoilsObservation = OfficialObservation<SoilData>

export async function fetchSoils(coordinates: Coordinates, signal?: AbortSignal): Promise<SoilsObservation> {
  try {
    // Soil Data Access (SDA) POST endpoint with spatial SQL.
    // geography::Point(Latitude, Longitude, SRID) is the SQL Server syntax.
    const sql = `SELECT TOP 1
      mu.mukey, mu.muname,
      co.comppct_r, co.drainagecl, co.hydriccl,
      ci_septic.interplrat AS septic_rating,
      ci_dwell.interplrat AS dwelling_rating
    FROM mapunit mu
    INNER JOIN component co ON mu.mukey = co.mukey
    LEFT JOIN cointerp ci_septic ON co.cokey = ci_septic.cokey
      AND ci_septic.interplname = 'Septic Tank Absorption Fields'
      AND ci_septic.mrulabel = 'ENG'
    LEFT JOIN cointerp ci_dwell ON co.cokey = ci_dwell.cokey
      AND ci_dwell.interplname = 'Dwellings Without Basements'
      AND ci_dwell.mrulabel = 'ENG'
    WHERE mu.mukey IN (
      SELECT mukey FROM mupolygon
      WHERE SHAPE.STIntersects(geography::Point(${coordinates.lat}, ${coordinates.lng}, 4326)) = 1
    )
    ORDER BY co.comppct_r DESC`

    const result = await postJson<{ Table: string[][] }>(
      'https://sdmdataaccess.nrcs.usda.gov/Tabular/post.rest',
      { query: sql },
      signal,
    )

    const rows = result.Table
    if (!rows || rows.length < 2) {
      return { available: true, value: { mukey: '', mapUnitName: 'No mapped soil', drainageClass: 'unknown', hydricClass: 'No', dominantRating: 'unknown', septicRating: 'not rated', dwellingRating: 'not rated', hydric: false }, provenance: SOILS_PROVENANCE }
    }

    const header = rows[0]
    const data = rows[1]
    const idx = (name: string) => header.indexOf(name)
    const mukey = String(data[idx('mukey')] || '')
    const muname = String(data[idx('muname')] || 'Unknown soil map unit')
    const drainagecl = String(data[idx('drainagecl')] || 'unknown')
    const hydriccl = String(data[idx('hydriccl')] || 'No')
    const septicRating = String(data[idx('septic_rating')] || 'not rated')
    const dwellingRating = String(data[idx('dwelling_rating')] || 'not rated')

    const dominantRating: SoilData['dominantRating'] =
      /severe/i.test(septicRating) || /severe/i.test(dwellingRating) ? 'severe'
        : /moderate/i.test(septicRating) || /moderate/i.test(dwellingRating) ? 'moderate'
          : /slight|good|fair/i.test(septicRating) || /slight|good|fair/i.test(dwellingRating) ? 'slight'
            : 'not-rated'

    const hydric = /^yes|all prime|yes$/i.test(hydriccl)

    return {
      available: true,
      value: {
        mukey, mapUnitName: muname, drainageClass: drainagecl, hydricClass: hydriccl,
        dominantRating, septicRating, dwellingRating, hydric,
      },
      provenance: SOILS_PROVENANCE,
    }
  } catch (error) {
    return unavailable(SOILS_PROVENANCE, error)
  }
}

// ─── 2. Contamination (EPA FRS) ─────────────────────────────────────────

export interface ContaminationData {
  facilityCount: number
  nearestDistanceMeters: number
  hasMajorFlag: boolean
  facilityTypes: string[]
  nearestName: string
}

export type ContaminationObservation = OfficialObservation<ContaminationData>

interface ArcGISFeatureSet {
  features?: Array<{ attributes: Record<string, string | number | null>; geometry?: unknown }>
  error?: { message?: string }
}

export async function fetchContamination(coordinates: Coordinates, signal?: AbortSignal): Promise<ContaminationObservation> {
  try {
    // EPA FRS ArcGIS REST service — query facilities within a 1,000m buffer.
    const params = new URLSearchParams({
      f: 'json',
      geometry: `${coordinates.lng},${coordinates.lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      distance: '1000',
      units: 'esriSRUnit_Meter',
      outFields: 'REGISTRY_ID,PRIMARY_NAME,PGM_SYS_ACRNM,INTEREST_TYPE',
      returnGeometry: 'false',
      resultRecordCount: '50',
    })
    const data = await getJson<ArcGISFeatureSet>(
      'https://geodata.epa.gov/arcgis/rest/services/FRS/FRS/MapServer/0/query?' + params,
      signal,
    )
    const features = data.features || []
    if (!features.length) {
      return {
        available: true,
        value: { facilityCount: 0, nearestDistanceMeters: 0, hasMajorFlag: false, facilityTypes: [], nearestName: '' },
        provenance: CONTAMINATION_PROVENANCE,
      }
    }

    const facilityTypes = new Set<string>()
    let hasMajorFlag = false
    let nearestName = ''
    for (const feature of features) {
      const type = String(feature.attributes.INTEREST_TYPE || feature.attributes.PGM_SYS_ACRNM || 'Unknown')
      facilityTypes.add(type)
      if (/ust|lust|rcra|cercla|superfund|tri|air\s+emissions|hazardous|toxic/i.test(type)) {
        hasMajorFlag = true
      }
      if (!nearestName) nearestName = String(feature.attributes.PRIMARY_NAME || 'Unnamed facility')
    }

    return {
      available: true,
      value: {
        facilityCount: features.length,
        nearestDistanceMeters: 0, // FRS doesn't return distance without geometry
        hasMajorFlag,
        facilityTypes: Array.from(facilityTypes).slice(0, 5),
        nearestName,
      },
      provenance: CONTAMINATION_PROVENANCE,
    }
  } catch (error) {
    return unavailable(CONTAMINATION_PROVENANCE, error)
  }
}

// ─── 3. Species / Critical Habitat (USFWS ECOS) ─────────────────────────

export interface SpeciesData {
  criticalHabitatHit: boolean
  criticalHabitatLayers: string[]
  speciesCount: number
}

export type SpeciesObservation = OfficialObservation<SpeciesData>

export async function fetchSpecies(coordinates: Coordinates, signal?: AbortSignal): Promise<SpeciesObservation> {
  try {
    // USFWS ECOS ArcGIS REST service for critical habitat.
    // Layer 0: Critical Habitat polygons
    const params = new URLSearchParams({
      f: 'json',
      geometry: `${coordinates.lng},${coordinates.lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'COMNAME,SCINAME,STATUS,UNIT_TYPE',
      returnGeometry: 'false',
      resultRecordCount: '20',
    })
    const data = await getJson<ArcGISFeatureSet>(
      'https://ecos.fws.gov/arcgis/rest/services/EndangeredSpecies/CriticalHabitat/MapServer/0/query?' + params,
      signal,
    )
    const features = data.features || []
    if (!features.length) {
      return {
        available: true,
        value: { criticalHabitatHit: false, criticalHabitatLayers: [], speciesCount: 0 },
        provenance: SPECIES_PROVENANCE,
      }
    }

    const layers = new Set<string>()
    for (const feature of features) {
      const name = String(feature.attributes.COMNAME || feature.attributes.SCINAME || 'Unknown species')
      const unitType = String(feature.attributes.UNIT_TYPE || '')
      layers.add(unitType ? `${name} (${unitType})` : name)
    }

    return {
      available: true,
      value: {
        criticalHabitatHit: true,
        criticalHabitatLayers: Array.from(layers).slice(0, 5),
        speciesCount: features.length,
      },
      provenance: SPECIES_PROVENANCE,
    }
  } catch (error) {
    return unavailable(SPECIES_PROVENANCE, error)
  }
}

// ─── 4. Utilities (EPA Public Water System Service Areas) ──────────────

export interface UtilityData {
  inWaterServiceArea: boolean
  pwsName: string
  pwsId: string
  hasSewer: boolean
}

export type UtilityObservation = OfficialObservation<UtilityData>

export async function fetchUtilityService(coordinates: Coordinates, signal?: AbortSignal): Promise<UtilityObservation> {
  try {
    // EPA SDWIS water service area ArcGIS REST service.
    const params = new URLSearchParams({
      f: 'json',
      geometry: `${coordinates.lng},${coordinates.lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'PWS_ID,PWS_NAME,SERVICE_AREA_TYPE',
      returnGeometry: 'false',
      resultRecordCount: '5',
    })
    const data = await getJson<ArcGISFeatureSet>(
      'https://geodata.epa.gov/arcgis/rest/services/Water/PWSA/MapServer/0/query?' + params,
      signal,
    )
    const features = data.features || []
    if (!features.length) {
      return {
        available: true,
        value: { inWaterServiceArea: false, pwsName: '', pwsId: '', hasSewer: false },
        provenance: UTILITY_PROVENANCE,
      }
    }
    const first = features[0].attributes
    return {
      available: true,
      value: {
        inWaterServiceArea: true,
        pwsName: String(first.PWS_NAME || ''),
        pwsId: String(first.PWS_ID || ''),
        hasSewer: /sewer/i.test(String(first.SERVICE_AREA_TYPE || '')),
      },
      provenance: UTILITY_PROVENANCE,
    }
  } catch (error) {
    return unavailable(UTILITY_PROVENANCE, error)
  }
}

// ─── 5. Market — Census Building Permits Survey (BPS) ──────────────────

export interface BpsData {
  permitsPerThousand2023: number
  permitsPerThousand2024: number
  permitTrend: number
  totalPermits2024: number
  countyName: string
}

export type BpsObservation = OfficialObservation<BpsData>

interface GeocoderResponse {
  result?: { geographies?: Record<string, Array<Record<string, string>>> }
}

export async function fetchBps(coordinates: Coordinates, signal?: AbortSignal): Promise<BpsObservation> {
  const apiKey = import.meta.env.VITE_CENSUS_API_KEY as string | undefined
  if (!apiKey) return unavailable(BPS_PROVENANCE, new Error('Add VITE_CENSUS_API_KEY to enable building permits trend'))
  try {
    // Geocode the point to a county.
    const geoParams = new URLSearchParams({
      x: String(coordinates.lng), y: String(coordinates.lat),
      benchmark: 'Public_AR_Current', vintage: 'Current_Current', format: 'json',
    })
    const geocoder = await getJson<GeocoderResponse>(
      `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?${geoParams}`,
      signal,
    )
    const county = geocoder.result?.geographies?.['Counties']?.[0]
    if (!county) throw new Error('No county found at this point')
    const state = county.STATE.padStart(2, '0')
    const countyCode = county.COUNTY.padStart(3, '0')

    // Query BPS annual totals for the county.
    // BPS API: https://api.census.gov/data/{year}/cb/bps
    const fetchYear = async (year: number) => {
      const params = new URLSearchParams({
        get: 'BPS_NAME,PERMITVAL,VAL0406,PERMITNBRS',
        for: `county:${countyCode}`,
        in: `state:${state}`,
        key: apiKey,
      })
      const rows = await getJson<string[][]>(
        `https://api.census.gov/data/${year}/cb/bps?${params}`,
        signal,
      )
      return rows
    }

    const [rows2023, rows2024] = await Promise.all([fetchYear(2023), fetchYear(2024)])
    const parsePermits = (rows: string[][]) => {
      if (!rows || rows.length < 2) return 0
      const header = rows[0]
      const data = rows[1]
      const permitIdx = header.indexOf('PERMITNBRS')
      if (permitIdx < 0) return 0
      return Number(data[permitIdx]) || 0
    }
    const permits2023 = parsePermits(rows2023)
    const permits2024 = parsePermits(rows2024)

    // Get population for per-thousand normalization.
    const popParams = new URLSearchParams({
      get: 'B01003_001E',
      for: `county:${countyCode}`,
      in: `state:${state}`,
      key: apiKey,
    })
    const popRows = await getJson<string[][]>(`https://api.census.gov/data/2024/acs/acs5?${popParams}`, signal)
    const population = Number(popRows[1]?.[0]) || 0
    if (population <= 0) throw new Error('No county population estimate')

    const p23 = (permits2023 / population) * 1000
    const p24 = (permits2024 / population) * 1000
    const trend = p23 > 0 ? ((p24 - p23) / p23) * 100 : 0

    return {
      available: true,
      value: {
        permitsPerThousand2023: Math.round(p23 * 10) / 10,
        permitsPerThousand2024: Math.round(p24 * 10) / 10,
        permitTrend: Math.round(trend * 10) / 10,
        totalPermits2024: permits2024,
        countyName: String(county.NAME || 'Unknown county'),
      },
      provenance: BPS_PROVENANCE,
    }
  } catch (error) {
    return unavailable(BPS_PROVENANCE, error)
  }
}
