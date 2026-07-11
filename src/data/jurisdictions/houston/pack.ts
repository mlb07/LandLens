import type { Coordinates, DataProvenance, IntendedUse, JurisdictionOverlay, JurisdictionProfile, ProposedUseAssessment, ProposedUseDefinition } from '../../../types/site'
import { externalRequest } from '../../externalRequest'
import type { JurisdictionPack } from '../types'

export const HOUSTON_BOUNDS = { south: 29.45, west: -95.95, north: 30.18, east: -94.85 }
export const HOUSTON_BOUNDARY_URL = 'https://mycity2.houstontx.gov/pubgis02/rest/services/HoustonMap/Administrative_Boundary/MapServer'
export const HOUSTON_REGULATORY_LAYER_URL = 'https://geogimstest.houstontx.gov/arcgis/rest/services/DIR/ReferenceAndBoundaries_gx/MapServer'
export const HOUSTON_DEVELOPMENT_REGULATIONS_URL = 'https://www.houstontx.gov/planning/DevelopRegs/'
export const HOUSTON_CHAPTER_42_URL = 'https://library.municode.com/tx/houston/codes/code_of_ordinances?nodeId=COOR_CH42SUDEPL'

const HOUSTON_PROVENANCE: DataProvenance = {
  source: 'City of Houston development-regulation and jurisdiction profile',
  sourceUrl: HOUSTON_DEVELOPMENT_REGULATIONS_URL,
  vintage: 'Live City GIS; 2026 no-zoning statement',
  coverageNote: 'Houston has no citywide comprehensive zoning ordinance and Chapter 42 does not regulate land use. This pack resolves city/ETJ status and selected mapped development controls; deed restrictions, special districts, airport/height controls, building lines, platting, parking, trees, access, utilities, and other codes still require site-specific review.',
}

export const HOUSTON_PROPOSED_USES: ProposedUseDefinition[] = [
  { key: 'houston-single-family', label: 'Single-family subdivision', codeLabel: 'Single-family residential', group: 'Residential', intendedUse: 'residential' },
  { key: 'houston-multifamily', label: 'Multifamily housing', codeLabel: 'Multifamily residential', group: 'Residential', intendedUse: 'residential' },
  { key: 'houston-mixed-use', label: 'Mixed-use development', codeLabel: 'Mixed-use', group: 'Mixed use', intendedUse: 'mixed-use' },
  { key: 'houston-retail', label: 'Retail or restaurant', codeLabel: 'Retail / restaurant', group: 'Commercial', intendedUse: 'commercial' },
  { key: 'houston-office', label: 'Office or medical office', codeLabel: 'Office', group: 'Commercial', intendedUse: 'commercial' },
  { key: 'houston-hotel', label: 'Hotel', codeLabel: 'Hotel', group: 'Commercial', intendedUse: 'commercial' },
  { key: 'houston-warehouse', label: 'Warehouse or distribution', codeLabel: 'Warehouse / distribution', group: 'Industrial', intendedUse: 'industrial' },
  { key: 'houston-industrial', label: 'Manufacturing or industrial', codeLabel: 'Industrial', group: 'Industrial', intendedUse: 'industrial' },
]

function jurisdictionCompatibility(): Record<IntendedUse, 'conditional-review'> {
  return { residential: 'conditional-review', commercial: 'conditional-review', 'mixed-use': 'conditional-review', industrial: 'conditional-review', other: 'conditional-review' }
}

export function assessHoustonProposedUse(profile: JurisdictionProfile, proposedUse?: string): ProposedUseAssessment | undefined {
  if (!proposedUse) return undefined
  const definition = HOUSTON_PROPOSED_USES.find((use) => use.key === proposedUse)
  if (!definition) return {
    proposedUse, useLabel: proposedUse, district: profile.baseDistrict, status: 'unresolved', statusLabel: 'Use not registered',
    sourceSection: 'Houston development regulations', requiresCombiningDistrictReview: false, requiresOverlayReview: true,
    explanation: 'This use is not in the Houston screening catalog. Confirm all applicable development and operating regulations with the City and other authorities.',
  }
  return {
    proposedUse, useLabel: definition.label, district: profile.baseDistrict, status: 'special-review', statusLabel: 'No zoning use table — site controls review',
    sourceSection: 'Houston Code Chapter 42 and applicable development/operating codes', requiresCombiningDistrictReview: false, requiresOverlayReview: true,
    explanation: `Houston does not use a citywide zoning use table, so ${definition.label.toLowerCase()} is not classified as by-right or prohibited by a base zoning district. Confirm platting, building lines, parking, access, deed restrictions, special districts, utilities, environmental controls, and use-specific permits.`,
  }
}

async function queryLayer(layer: number, outFields: string, coordinates: Coordinates, signal?: AbortSignal, baseUrl = HOUSTON_REGULATORY_LAYER_URL) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const params = new URLSearchParams({
      f: 'json', geometry: `${coordinates.lng},${coordinates.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', outFields, returnGeometry: 'false', returnDomainNames: 'true', resultRecordCount: '10',
    })
    const response = await externalRequest(`${baseUrl}/${layer}/query?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Houston GIS service returned ${response.status}`)
    const data = await response.json() as { features?: Array<{ attributes?: Record<string, string | number | null> }>; error?: { message?: string } }
    if (data.error) throw new Error(data.error.message || 'Houston GIS query failed')
    return data.features?.flatMap((feature) => feature.attributes ? [feature.attributes] : []) ?? []
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

function overlay(name: string, layerId: number, attributes?: Record<string, string | number | null>, detailKeys: string[] = []): JurisdictionOverlay[] {
  if (!attributes) return []
  const detail = detailKeys.map((key) => attributes[key]).find((value) => value !== null && value !== undefined && String(value).trim())
  return [{ name, layerId, detail: detail === undefined ? undefined : String(detail) }]
}

export function buildHoustonProfile(input: {
  serviceType?: string
  inEtj: boolean
  minimumLot?: Record<string, string | number | null>
  buildingLine?: Record<string, string | number | null>
  historicDistrict?: Record<string, string | number | null>
}): JurisdictionProfile {
  const inCity = Boolean(input.serviceType)
  const jurisdictionLabel = inCity ? `City of Houston — ${input.serviceType === 'FULL' ? 'full-service' : 'limited-service'} area` : 'City of Houston extraterritorial jurisdiction'
  const overlays = [
    ...overlay('Minimum lot size area', 16, input.minimumLot, ['LOTSIZE', 'ORDINANCE']),
    ...overlay('Special building line', 17, input.buildingLine, ['BLD__LINE', 'ORDINANCE_']),
    ...overlay('Historic district', 18, input.historicDistrict, ['NAME', 'HISTORIC']),
  ]
  return {
    profileId: 'houston-v1', packId: 'houston', profileLabel: 'Houston no-zoning development profile',
    profileDescription: 'Official Houston city/ETJ and selected Chapter 42/site-control context. Houston does not have a citywide zoning use table.',
    authorityName: 'City of Houston Planning & Development Department', jurisdictionLabel,
    jurisdictionType: inCity ? 'city' : input.inEtj ? 'extraterritorial jurisdiction' : 'unresolved',
    jurisdictionCode: inCity ? input.serviceType : 'ETJ', zoningCode: 'NO CITYWIDE ZONING', baseDistrict: 'NO-ZONING',
    standardsApply: false, overlays, useCompatibility: jurisdictionCompatibility(), futureLandUse: undefined,
    reviewFlags: [
      'Houston has no citywide comprehensive zoning ordinance; do not interpret this result as unrestricted development.',
      'Chapter 42 regulates subdivision and development form but does not establish a base-district permitted-use table.',
      'Confirm deed restrictions, special districts, building lines, platting, parking, trees, access, airport/height controls, utilities, and use-specific permits.',
      ...(overlays.length ? [`${overlays.length} mapped development-control overlay${overlays.length === 1 ? '' : 's'} intersect the point.`] : []),
    ],
    sources: houstonJurisdictionPack.sources, verifiedAt: new Date().toISOString(),
  }
}

export const houstonJurisdictionPack: JurisdictionPack = {
  id: 'houston', profileId: 'houston-v1', label: 'Houston jurisdiction pack', stateCode: 'TX', bounds: HOUSTON_BOUNDS,
  description: 'Verified Houston full/limited-service and ETJ status, no-citywide-zoning framework, and mapped minimum-lot-size, building-line, and historic-district controls.',
  proposedUseLabel: 'Houston proposed development',
  proposedUseHelpText: 'Houston has no base zoning use table. The selection produces a site-controls and use-specific permitting checklist, not a by-right use conclusion.',
  proposedUses: HOUSTON_PROPOSED_USES,
  sources: [
    { id: 'authority', label: 'City limits and ETJ', url: HOUSTON_BOUNDARY_URL, role: 'authority' },
    { id: 'development-regulations', label: 'Development regulations / no-zoning statement', url: HOUSTON_DEVELOPMENT_REGULATIONS_URL, role: 'zoning' },
    { id: 'chapter-42', label: 'Chapter 42 subdivision and development', url: HOUSTON_CHAPTER_42_URL, role: 'standards' },
    { id: 'mapped-controls', label: 'Minimum lot, building line, and historic overlays', url: HOUSTON_REGULATORY_LAYER_URL, role: 'overlays' },
    { id: 'use-review', label: 'No-zoning use review framework', url: HOUSTON_DEVELOPMENT_REGULATIONS_URL, role: 'permitted-uses' },
  ],
  assessUse: assessHoustonProposedUse,
  async query(coordinates, signal) {
    try {
      const [city, etj, minimumLot, buildingLine, historic] = await Promise.all([
        queryLayer(0, 'SERVICE_TY,COMMENTS,ANNEXATION', coordinates, signal, HOUSTON_BOUNDARY_URL),
        queryLayer(1, 'Class', coordinates, signal, HOUSTON_BOUNDARY_URL),
        queryLayer(16, 'APP_NO_,ORDINANCE,LOTSIZE,STARTDATE', coordinates, signal),
        queryLayer(17, 'APPLICATIO,BLD__LINE,ORDINANCE_,START_DATE', coordinates, signal),
        queryLayer(18, 'NAME,HISTORIC,DATE_EST', coordinates, signal),
      ])
      if (!city[0] && !etj[0]) return { available: false, provenance: HOUSTON_PROVENANCE, error: 'The point is outside the mapped City of Houston and Houston ETJ boundaries.' }
      const profile = buildHoustonProfile({ serviceType: city[0]?.SERVICE_TY ? String(city[0].SERVICE_TY) : undefined, inEtj: Boolean(etj[0]), minimumLot: minimumLot[0], buildingLine: buildingLine[0], historicDistrict: historic[0] })
      return { available: true, value: { zoningCode: profile.zoningCode, baseDistrict: profile.baseDistrict, jurisdiction: profile.jurisdictionLabel, profile }, provenance: HOUSTON_PROVENANCE }
    } catch (error) {
      return { available: false, provenance: HOUSTON_PROVENANCE, error: error instanceof Error ? error.message : String(error) }
    }
  },
}
