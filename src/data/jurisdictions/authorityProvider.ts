import type { Coordinates, DataProvenance, JurisdictionAuthority } from '../../types/site'
import type { OfficialObservation } from '../officialDataProvider'
import { externalRequest } from '../externalRequest'

export const CENSUS_AUTHORITY_PROVENANCE: DataProvenance = {
  source: 'U.S. Census Bureau TIGERweb / Geocoder',
  sourceUrl: 'https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_restmapservice.html',
  vintage: 'Current Census Boundary and Annexation Survey geography',
  coverageNote: 'Census incorporated-place, county-subdivision, and county geography is a national routing baseline. It does not establish zoning authority, extraterritorial jurisdiction, special districts, annexation status, or the agency that will approve a specific project.',
}

interface CensusGeography {
  NAME?: string
  BASENAME?: string
  GEOID?: string
  STATE?: string
  COUNTY?: string
  PLACE?: string
  COUSUB?: string
}

interface CensusGeocoderResponse {
  result?: { geographies?: Record<string, CensusGeography[]> }
  errors?: string[]
}

function first(geographies: Record<string, CensusGeography[]> | undefined, labels: string[]): CensusGeography | undefined {
  if (!geographies) return undefined
  for (const label of labels) {
    const exact = geographies[label]?.[0]
    if (exact) return exact
    const fuzzy = Object.entries(geographies).find(([key]) => key.toLowerCase().includes(label.toLowerCase()))?.[1]?.[0]
    if (fuzzy) return fuzzy
  }
  return undefined
}

export async function fetchJurisdictionAuthority(
  coordinates: Coordinates,
  stateCode: string,
  signal?: AbortSignal,
): Promise<OfficialObservation<JurisdictionAuthority>> {
  const params = new URLSearchParams({
    x: String(coordinates.lng),
    y: String(coordinates.lat),
    benchmark: 'Public_AR_Current',
    vintage: 'Current_Current',
    layers: 'all',
    format: 'json',
  })
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await externalRequest(`https://geocoding.geo.census.gov/geocoder/geographies/coordinates?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Census geography service returned ${response.status}`)
    const data = await response.json() as CensusGeocoderResponse
    if (data.errors?.length) throw new Error(data.errors.join('; '))
    const geographies = data.result?.geographies
    const place = first(geographies, ['Incorporated Places'])
    const subdivision = first(geographies, ['County Subdivisions'])
    const county = first(geographies, ['Counties'])
    const state = first(geographies, ['States'])
    if (!county && !place && !subdivision) throw new Error('No Census authority geography was returned at this point.')
    const placeName = place?.NAME || place?.BASENAME
    const subdivisionName = subdivision?.NAME || subdivision?.BASENAME
    const countyName = county?.NAME || county?.BASENAME
    const authorityType = placeName ? 'incorporated-place' : subdivisionName ? 'county-subdivision' : countyName ? 'county' : 'unresolved'
    const authorityName = placeName || subdivisionName || countyName || 'Authority unresolved'
    return {
      available: true,
      value: {
        authorityName,
        authorityType,
        incorporatedPlace: placeName,
        countySubdivision: subdivisionName,
        countyName,
        stateName: state?.NAME || state?.BASENAME,
        stateCode,
        geoid: place?.GEOID || subdivision?.GEOID || county?.GEOID,
        sourceVintage: CENSUS_AUTHORITY_PROVENANCE.vintage || 'Current Census geography',
        coverageNote: CENSUS_AUTHORITY_PROVENANCE.coverageNote || '',
        resolvedAt: new Date().toISOString(),
      },
      provenance: CENSUS_AUTHORITY_PROVENANCE,
    }
  } catch (error) {
    return {
      available: false,
      provenance: CENSUS_AUTHORITY_PROVENANCE,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
