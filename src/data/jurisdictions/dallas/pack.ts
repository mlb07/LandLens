import type { Coordinates, DataProvenance, IntendedUse, JurisdictionOverlay, JurisdictionProfile, JurisdictionUseStatus, ProposedUseAssessment, ProposedUseDefinition } from '../../../types/site'
import { externalRequest } from '../../externalRequest'
import type { JurisdictionPack } from '../types'

export const DALLAS_BOUNDS = { south: 32.61, west: -97.00, north: 33.02, east: -96.55 }
export const DALLAS_ZONING_URL = 'https://egis.dallascityhall.com/arcgis/rest/services/Sdc_public/Zoning/MapServer'
export const DALLAS_CODE_URL = 'https://dallascityhall.com/departments/pnv/Pages/Zoning-Resources.aspx'
export const DALLAS_FORWARD_URL = 'https://dallascityhall.com/departments/pnv/Forward-Dallas/Pages/default.aspx'

const DALLAS_PROVENANCE: DataProvenance = {
  source: 'City of Dallas base zoning and overlay profile', sourceUrl: DALLAS_ZONING_URL,
  vintage: 'Live City GIS; ForwardDallas 2.0 amended March 2026',
  coverageNote: 'Official point identify across base zoning and high-impact zoning overlays. District-family compatibility is conservative and does not replace Chapter 51A use regulations, an SUP/PD/CD ordinance, deed restrictions, overlay standards, or an official zoning verification letter. ForwardDallas is advisory and does not rezone property.',
}

const OVERLAY_LAYER_IDS = [0, 2, 4, 5, 7, 8, 9, 12, 14, 16, 17, 18, 19]

export const DALLAS_PROPOSED_USES: ProposedUseDefinition[] = [
  { key: 'dallas-detached', label: 'Single-family dwelling', codeLabel: 'Single-family use', group: 'Residential', intendedUse: 'residential' },
  { key: 'dallas-townhome', label: 'Townhouse development', codeLabel: 'Single-family / townhouse', group: 'Residential', intendedUse: 'residential' },
  { key: 'dallas-multifamily', label: 'Multifamily dwelling', codeLabel: 'Multifamily use', group: 'Residential', intendedUse: 'residential' },
  { key: 'dallas-mixed-use', label: 'Mixed-use development', codeLabel: 'Mixed use', group: 'Mixed use', intendedUse: 'mixed-use' },
  { key: 'dallas-retail', label: 'General merchandise or food store', codeLabel: 'Retail', group: 'Commercial', intendedUse: 'commercial' },
  { key: 'dallas-restaurant', label: 'Restaurant', codeLabel: 'Restaurant', group: 'Commercial', intendedUse: 'commercial' },
  { key: 'dallas-office', label: 'Office', codeLabel: 'Office', group: 'Commercial', intendedUse: 'commercial' },
  { key: 'dallas-hotel', label: 'Hotel or motel', codeLabel: 'Lodging', group: 'Commercial', intendedUse: 'commercial' },
  { key: 'dallas-warehouse', label: 'Warehouse or distribution', codeLabel: 'Industrial / warehouse', group: 'Industrial', intendedUse: 'industrial' },
  { key: 'dallas-manufacturing', label: 'Manufacturing', codeLabel: 'Industrial manufacturing', group: 'Industrial', intendedUse: 'industrial' },
  { key: 'dallas-alcohol', label: 'Alcoholic beverage establishment', codeLabel: 'Alcoholic beverage establishment', group: 'Special review', intendedUse: 'commercial' },
]

function compatibilityFor(district: string, longName: string): Record<IntendedUse, JurisdictionUseStatus> {
  const text = `${district} ${longName}`.toUpperCase()
  const result: Record<IntendedUse, JurisdictionUseStatus> = { residential: 'conditional-review', commercial: 'conditional-review', 'mixed-use': 'conditional-review', industrial: 'conditional-review', other: 'unresolved' }
  if (/^(R-|D\(|TH-|CH|MF-)|RESIDENTIAL|MULTIFAMILY|DUPLEX|TOWNHOUSE/.test(text)) return { ...result, residential: 'likely-compatible', commercial: 'likely-incompatible', 'mixed-use': 'likely-incompatible', industrial: 'likely-incompatible' }
  if (/^(NO|LO|MO|GO)|OFFICE/.test(text)) return { ...result, residential: 'conditional-review', commercial: 'likely-compatible', 'mixed-use': 'conditional-review', industrial: 'likely-incompatible' }
  if (/^(NS|CR|RR|CS)|RETAIL|COMMERCIAL SERVICE/.test(text)) return { ...result, residential: 'likely-incompatible', commercial: 'likely-compatible', 'mixed-use': 'conditional-review', industrial: 'conditional-review' }
  if (/^(MU|WMU|WR|UC|CA|MC)|MIXED USE|CENTRAL AREA|URBAN CORRIDOR/.test(text)) return { ...result, residential: 'conditional-review', commercial: 'likely-compatible', 'mixed-use': 'likely-compatible', industrial: 'conditional-review' }
  if (/^(IR|IM|LI)|INDUSTRIAL/.test(text)) return { ...result, residential: 'likely-incompatible', commercial: 'conditional-review', 'mixed-use': 'likely-incompatible', industrial: 'likely-compatible' }
  if (/^(?:A\(|AGRICULT)/.test(text)) return { ...result, residential: 'conditional-review', commercial: 'likely-incompatible', 'mixed-use': 'likely-incompatible', industrial: 'likely-incompatible' }
  return result
}

function firstValue(attributes: Record<string, string | number | null>, keys: string[]) {
  for (const key of keys) {
    const value = attributes[key]
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim()
  }
  return undefined
}

export function buildDallasProfile(input: { district: string; longName?: string; commonName?: string; pdNumber?: string; cdNumber?: string; ordinance?: string; overlays?: JurisdictionOverlay[] }): JurisdictionProfile {
  const district = input.district.trim().toUpperCase()
  const planned = /^P?D\b|^CD\b/i.test(district) || Boolean(input.pdNumber || input.cdNumber)
  return {
    profileId: 'dallas-v1', packId: 'dallas', profileLabel: 'Dallas zoning and overlay profile',
    profileDescription: 'Official base zoning plus deed restriction, historic, SUP, neighborhood, development, height, parking, pedestrian, setback, and demolition-delay overlays.',
    authorityName: 'City of Dallas Planning & Development', jurisdictionLabel: 'City of Dallas zoning jurisdiction', jurisdictionType: 'city',
    zoningCode: district, baseDistrict: district, standardsApply: false, overlays: input.overlays ?? [],
    useCompatibility: planned ? { residential: 'conditional-review', commercial: 'conditional-review', 'mixed-use': 'conditional-review', industrial: 'conditional-review', other: 'unresolved' } : compatibilityFor(district, input.longName || ''),
    reviewFlags: [
      ...(planned ? [`Planned or conservation district controls${input.pdNumber ? ` (PD ${input.pdNumber})` : ''}${input.cdNumber ? ` (CD ${input.cdNumber})` : ''} require the district ordinance and approved plans.`] : []),
      ...(input.commonName ? [`Mapped district name: ${input.commonName}.`] : []),
      ...(input.ordinance ? [`Mapped ordinance: ${input.ordinance}.`] : []),
      ...((input.overlays?.length ?? 0) ? [`${input.overlays?.length} mapped zoning overlay${input.overlays?.length === 1 ? '' : 's'} may supersede base-district standards.`] : []),
      'Confirm Chapter 51A use regulations, required SUP/DIR/RAR review, yards, height, density, coverage, FAR, parking, landscape, and residential proximity slope.',
      'ForwardDallas 2.0 is future-land-use guidance and does not itself change zoning.',
    ],
    sources: [
      { id: 'zoning', label: 'Dallas zoning GIS', url: DALLAS_ZONING_URL, role: 'zoning' },
      { id: 'overlays', label: 'Dallas zoning overlay stack', url: DALLAS_ZONING_URL, role: 'overlays' },
      { id: 'code', label: 'Dallas Development Code / Chapter 51A', url: DALLAS_CODE_URL, role: 'standards' },
      { id: 'forward-dallas', label: 'ForwardDallas 2.0', url: DALLAS_FORWARD_URL, role: 'future-land-use' },
    ],
    verifiedAt: new Date().toISOString(),
  }
}

export function assessDallasProposedUse(profile: JurisdictionProfile, proposedUse?: string): ProposedUseAssessment | undefined {
  if (!proposedUse) return undefined
  const definition = DALLAS_PROPOSED_USES.find((use) => use.key === proposedUse)
  if (!definition) return { proposedUse, useLabel: proposedUse, district: profile.baseDistrict, status: 'unresolved', statusLabel: 'Use not registered', sourceSection: 'Dallas Development Code Division 51A-4.200', requiresCombiningDistrictReview: true, requiresOverlayReview: true, explanation: 'Obtain an official Dallas zoning use determination for this use.' }
  const family = profile.useCompatibility[definition.intendedUse]
  return {
    proposedUse, useLabel: definition.label, district: profile.baseDistrict, status: 'special-review',
    statusLabel: family === 'likely-compatible' ? 'Likely district-family match — verify Chapter 51A' : family === 'likely-incompatible' ? 'Likely district-family conflict — verify/rezoning review' : 'Chapter 51A use review required',
    sourceSection: 'Dallas Development Code Division 51A-4.200', requiresCombiningDistrictReview: /^P?D\b|^CD\b/i.test(profile.baseDistrict), requiresOverlayReview: profile.overlays.length > 0,
    explanation: `${definition.label} is ${family.replaceAll('-', ' ')} at the broad ${profile.baseDistrict} district-family level. Verify the exact Chapter 51A use regulation, SUP/DIR/RAR requirements, planned-district ordinance, deed restrictions, and overlays before treating the use as allowed.`,
  }
}

async function identifyZoning(coordinates: Coordinates, signal?: AbortSignal) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const delta = 0.002
    const params = new URLSearchParams({ f: 'json', geometry: `${coordinates.lng},${coordinates.lat}`, geometryType: 'esriGeometryPoint', sr: '4326', tolerance: '1', mapExtent: `${coordinates.lng - delta},${coordinates.lat - delta},${coordinates.lng + delta},${coordinates.lat + delta}`, imageDisplay: '800,600,96', returnGeometry: 'false', returnFieldName: 'true', layers: `all:${[15, ...OVERLAY_LAYER_IDS].join(',')}` })
    const response = await externalRequest(`${DALLAS_ZONING_URL}/identify?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Dallas GIS service returned ${response.status}`)
    const data = await response.json() as { results?: Array<{ layerId: number; layerName: string; attributes?: Record<string, string | number | null> }>; error?: { message?: string } }
    if (data.error) throw new Error(data.error.message || 'Dallas GIS identify failed')
    return data.results ?? []
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

export const dallasJurisdictionPack: JurisdictionPack = {
  id: 'dallas', profileId: 'dallas-v1', label: 'Dallas jurisdiction pack', stateCode: 'TX', bounds: DALLAS_BOUNDS,
  description: 'Verified Dallas base zoning and 13 high-impact overlay layers, Chapter 51A district-family review, and ForwardDallas 2.0 source routing.',
  proposedUseLabel: 'Dallas proposed-use detail', proposedUseHelpText: 'Screens against the mapped district family and routes the current Chapter 51A, SUP/PD/CD, deed-restriction, and overlay review.',
  proposedUses: DALLAS_PROPOSED_USES,
  sources: [
    { id: 'zoning', label: 'Dallas zoning GIS', url: DALLAS_ZONING_URL, role: 'zoning' },
    { id: 'overlays', label: 'Dallas overlay stack', url: DALLAS_ZONING_URL, role: 'overlays' },
    { id: 'code', label: 'Dallas Development Code', url: DALLAS_CODE_URL, role: 'standards' },
    { id: 'forward-dallas', label: 'ForwardDallas 2.0', url: DALLAS_FORWARD_URL, role: 'future-land-use' },
    { id: 'use-review', label: 'Chapter 51A use regulations', url: DALLAS_CODE_URL, role: 'permitted-uses' },
  ],
  assessUse: assessDallasProposedUse,
  async query(coordinates, signal) {
    try {
      const results = await identifyZoning(coordinates, signal)
      const base = results.find((result) => result.layerId === 15)?.attributes
      const district = firstValue(base ?? {}, ['ZONE_DIST', 'LONG_ZONE_DIST']) || ''
      if (!district) return { available: false, provenance: DALLAS_PROVENANCE, error: 'No Dallas base zoning district was returned at this point.' }
      const overlays = results.filter((result) => result.layerId !== 15).map((result) => ({ name: result.layerName, layerId: result.layerId, detail: firstValue(result.attributes ?? {}, ['SPECIFICUSE', 'COMMON_NAME', 'NAME', 'DISTRICT_NAME', 'SUP_NUM', 'DEED_RES', 'HM_OVERLAY', 'PM_OVERLAY', 'SPSD_NAME', 'P_OVERLAY', 'CORRIDOR_NAME', 'DDO_NUM', 'ORD_NUM']) }))
      const profile = buildDallasProfile({ district, longName: firstValue(base ?? {}, ['LONG_ZONE_DIST']), commonName: firstValue(base ?? {}, ['COMMON_NAME']), pdNumber: firstValue(base ?? {}, ['PD_NUM']), cdNumber: firstValue(base ?? {}, ['CD_NUM']), ordinance: firstValue(base ?? {}, ['ORD_NUM']), overlays })
      return { available: true, value: { zoningCode: profile.zoningCode, baseDistrict: profile.baseDistrict, jurisdiction: profile.jurisdictionLabel, profile }, provenance: DALLAS_PROVENANCE }
    } catch (error) {
      return { available: false, provenance: DALLAS_PROVENANCE, error: error instanceof Error ? error.message : String(error) }
    }
  },
}
