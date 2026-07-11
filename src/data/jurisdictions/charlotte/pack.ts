import type { Coordinates, DataProvenance, IntendedUse, JurisdictionProfile, JurisdictionUseStatus, ProposedUseAssessment, ProposedUseDefinition } from '../../../types/site'
import { externalRequest } from '../../externalRequest'
import type { JurisdictionPack } from '../types'

export const CHARLOTTE_BOUNDS = { south: 35.00, west: -81.07, north: 35.52, east: -80.55 }
export const CHARLOTTE_ZONING_URL = 'https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer/0'
export const CHARLOTTE_UDO_URL = 'https://www.charlottenc.gov/Growth-and-Development/Planning-and-Development/Zoning/Zoning-Admin'
export const CHARLOTTE_POLICY_MAP_URL = 'https://www.charlottenc.gov/Growth-and-Development/Planning-and-Development/Planning/Community-Planning'

const CHARLOTTE_PROVENANCE: DataProvenance = {
  source: 'City of Charlotte zoning and UDO profile', sourceUrl: CHARLOTTE_ZONING_URL,
  vintage: 'Live City GIS; Unified Development Ordinance as currently amended',
  coverageNote: 'Official point lookup of mapped zoning classification, petition, and overlay attributes. Compatibility is a conservative district-family screen, not an exact UDO use-matrix determination. Conditional plans, prescribed conditions, frontages, policy-map guidance, and current UDO amendments can supersede the screen.',
}

export const CHARLOTTE_PROPOSED_USES: ProposedUseDefinition[] = [
  { key: 'charlotte-detached', label: 'Single-family detached dwelling', codeLabel: 'Dwelling — detached', group: 'Residential', intendedUse: 'residential' },
  { key: 'charlotte-duplex-triplex', label: 'Duplex or triplex', codeLabel: 'Duplex / triplex', group: 'Residential', intendedUse: 'residential' },
  { key: 'charlotte-townhome', label: 'Townhome development', codeLabel: 'Single-family attached', group: 'Residential', intendedUse: 'residential' },
  { key: 'charlotte-multifamily', label: 'Multifamily dwelling', codeLabel: 'Dwelling — multifamily', group: 'Residential', intendedUse: 'residential' },
  { key: 'charlotte-mixed-use', label: 'Mixed-use development', codeLabel: 'Mixed use', group: 'Mixed use', intendedUse: 'mixed-use' },
  { key: 'charlotte-retail', label: 'Retail goods establishment', codeLabel: 'Retail goods establishment', group: 'Commercial', intendedUse: 'commercial' },
  { key: 'charlotte-restaurant', label: 'Restaurant', codeLabel: 'Restaurant', group: 'Commercial', intendedUse: 'commercial' },
  { key: 'charlotte-office', label: 'Office or medical office', codeLabel: 'Office / medical office', group: 'Commercial', intendedUse: 'commercial' },
  { key: 'charlotte-hotel', label: 'Hotel or motel', codeLabel: 'Hotel / motel', group: 'Commercial', intendedUse: 'commercial' },
  { key: 'charlotte-warehouse', label: 'Warehouse or distribution', codeLabel: 'Warehouse / distribution', group: 'Industrial', intendedUse: 'industrial' },
  { key: 'charlotte-manufacturing', label: 'Manufacturing', codeLabel: 'Manufacturing', group: 'Industrial', intendedUse: 'industrial' },
]

function compatibilityFor(classification: string, district: string): Record<IntendedUse, JurisdictionUseStatus> {
  const text = `${classification} ${district}`.toUpperCase()
  const result: Record<IntendedUse, JurisdictionUseStatus> = { residential: 'conditional-review', commercial: 'conditional-review', 'mixed-use': 'conditional-review', industrial: 'conditional-review', other: 'unresolved' }
  if (/SINGLE FAMILY|NEIGHBORHOOD 1|^N1-/.test(text)) return { ...result, residential: 'likely-compatible', commercial: 'likely-incompatible', 'mixed-use': 'likely-incompatible', industrial: 'likely-incompatible' }
  if (/MULTI-FAMILY|MIXED USE RESIDENTIAL|NEIGHBORHOOD 2|^N2-/.test(text)) return { ...result, residential: 'likely-compatible', 'mixed-use': 'conditional-review', industrial: 'likely-incompatible' }
  if (/UPTOWN|MIXED USE|TRANSIT|CENTER|COMMERCIAL|BUSINESS|\bUC\b|\bNC\b|\bCC\b|\bCR\b|\bCG\b|TOD/.test(text)) return { ...result, residential: 'conditional-review', commercial: 'likely-compatible', 'mixed-use': 'likely-compatible', industrial: 'likely-incompatible' }
  if (/INDUSTR|MANUFACTUR|LOGISTICS|\bML-/.test(text)) return { ...result, residential: 'likely-incompatible', commercial: 'conditional-review', 'mixed-use': 'likely-incompatible', industrial: 'likely-compatible' }
  if (/PARK|PRESERVE|OPEN SPACE/.test(text)) return { ...result, residential: 'likely-incompatible', commercial: 'likely-incompatible', 'mixed-use': 'likely-incompatible', industrial: 'likely-incompatible' }
  return result
}

export function buildCharlotteProfile(input: { district: string; classification?: string; overlay?: string; petition?: string; spa?: string; hyperlink?: string }): JurisdictionProfile {
  const district = input.district.trim().toUpperCase()
  const overlayNames = input.overlay && !/^none$/i.test(input.overlay) ? input.overlay.split(/[,;/]/).map((name, index) => ({ name: name.trim(), detail: input.petition || undefined, layerId: index })) : []
  const conditional = /\((CD|EX|O)\)/i.test(district) || Boolean(input.petition)
  return {
    profileId: 'charlotte-v1', packId: 'charlotte', profileLabel: 'Charlotte UDO zoning profile',
    profileDescription: 'Official City zoning district-family, mapped overlay, petition, and current UDO review context.',
    authorityName: 'City of Charlotte Planning, Design & Development', jurisdictionLabel: 'City of Charlotte zoning jurisdiction', jurisdictionType: 'city',
    zoningCode: district, baseDistrict: district.replace(/\((CD|EX|O)\).*$/i, ''), standardsApply: false, overlays: overlayNames,
    useCompatibility: compatibilityFor(input.classification || '', district),
    reviewFlags: [
      ...(conditional ? ['Conditional, exception, optional, or petition-specific zoning may be governed by an approved site plan and conditions.'] : []),
      ...(input.spa && !/^no$/i.test(input.spa) ? [`Special planning area indicator: ${input.spa}.`] : []),
      'Confirm the exact Article 15 use-matrix cell and prescribed conditions for the current UDO version.',
      'Confirm Charlotte Future 2040 Policy Map place type, required frontage, streetscape, parking tier, landscape yards, tree save, stormwater, and transportation review.',
    ],
    sources: [
      { id: 'zoning', label: 'Charlotte zoning GIS', url: CHARLOTTE_ZONING_URL, role: 'zoning' },
      { id: 'udo', label: 'Unified Development Ordinance administration', url: CHARLOTTE_UDO_URL, role: 'standards' },
      { id: 'policy-map', label: 'Charlotte Future 2040 Policy Map', url: CHARLOTTE_POLICY_MAP_URL, role: 'future-land-use' },
      ...(input.hyperlink ? [{ id: 'petition', label: 'Mapped rezoning petition', url: input.hyperlink, role: 'overlays' as const }] : []),
    ],
    verifiedAt: new Date().toISOString(),
  }
}

export function assessCharlotteProposedUse(profile: JurisdictionProfile, proposedUse?: string): ProposedUseAssessment | undefined {
  if (!proposedUse) return undefined
  const definition = CHARLOTTE_PROPOSED_USES.find((use) => use.key === proposedUse)
  if (!definition) return { proposedUse, useLabel: proposedUse, district: profile.baseDistrict, status: 'unresolved', statusLabel: 'Use not registered', sourceSection: 'Charlotte UDO Article 15', requiresCombiningDistrictReview: false, requiresOverlayReview: true, explanation: 'The selected use is not in this pack’s screening catalog; obtain an official zoning use determination.' }
  const family = profile.useCompatibility[definition.intendedUse]
  return {
    proposedUse, useLabel: definition.label, district: profile.baseDistrict, status: 'special-review',
    statusLabel: family === 'likely-compatible' ? 'Likely district-family match — verify use matrix' : family === 'likely-incompatible' ? 'Likely district-family conflict — verify/rezoning review' : 'UDO use-matrix review required',
    sourceSection: 'Charlotte UDO Article 15 use matrix', requiresCombiningDistrictReview: /\((CD|EX|O)\)/i.test(profile.zoningCode), requiresOverlayReview: profile.overlays.length > 0,
    explanation: `${definition.label} is ${family.replaceAll('-', ' ')} at the broad ${profile.baseDistrict} district-family level. LandLens does not convert that family signal into a by-right conclusion; verify the current Article 15 cell, prescribed conditions, conditional plan, overlays, and frontage/site standards.`,
  }
}

async function queryZoning(coordinates: Coordinates, signal?: AbortSignal) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const params = new URLSearchParams({ f: 'json', geometry: `${coordinates.lng},${coordinates.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'ZoneDes,ZoneClass,Overlay,ZonePetition,SPA,Hyperlink', returnGeometry: 'false', returnDomainNames: 'true', resultRecordCount: '5' })
    const response = await externalRequest(`${CHARLOTTE_ZONING_URL}/query?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Charlotte GIS service returned ${response.status}`)
    const data = await response.json() as { features?: Array<{ attributes?: Record<string, string | number | null> }>; error?: { message?: string } }
    if (data.error) throw new Error(data.error.message || 'Charlotte GIS query failed')
    return data.features?.[0]?.attributes
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

export const charlotteJurisdictionPack: JurisdictionPack = {
  id: 'charlotte', profileId: 'charlotte-v1', label: 'Charlotte jurisdiction pack', stateCode: 'NC', bounds: CHARLOTTE_BOUNDS,
  description: 'Verified Charlotte zoning district-family, conditional petition and overlay attributes, UDO review logic, and 2040 Policy Map source routing.',
  proposedUseLabel: 'Charlotte proposed-use detail', proposedUseHelpText: 'Screens the proposed use against the mapped UDO district family, then requires verification of the current Article 15 matrix and prescribed conditions.',
  proposedUses: CHARLOTTE_PROPOSED_USES,
  sources: [
    { id: 'zoning', label: 'Charlotte zoning GIS', url: CHARLOTTE_ZONING_URL, role: 'zoning' },
    { id: 'udo', label: 'Unified Development Ordinance', url: CHARLOTTE_UDO_URL, role: 'standards' },
    { id: 'policy-map', label: 'Charlotte Future 2040 Policy Map', url: CHARLOTTE_POLICY_MAP_URL, role: 'future-land-use' },
    { id: 'use-matrix', label: 'UDO Article 15 use-matrix verification', url: CHARLOTTE_UDO_URL, role: 'permitted-uses' },
  ],
  assessUse: assessCharlotteProposedUse,
  async query(coordinates, signal) {
    try {
      const attributes = await queryZoning(coordinates, signal)
      const district = String(attributes?.ZoneDes || '')
      if (!district) return { available: false, provenance: CHARLOTTE_PROVENANCE, error: 'No Charlotte zoning district was returned at this point.' }
      const profile = buildCharlotteProfile({ district, classification: String(attributes?.ZoneClass || ''), overlay: String(attributes?.Overlay || ''), petition: String(attributes?.ZonePetition || ''), spa: String(attributes?.SPA || ''), hyperlink: String(attributes?.Hyperlink || '') })
      return { available: true, value: { zoningCode: profile.zoningCode, baseDistrict: profile.baseDistrict, jurisdiction: profile.jurisdictionLabel, profile }, provenance: CHARLOTTE_PROVENANCE }
    } catch (error) {
      return { available: false, provenance: CHARLOTTE_PROVENANCE, error: error instanceof Error ? error.message : String(error) }
    }
  },
}
