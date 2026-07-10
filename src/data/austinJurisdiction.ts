import type {
  DimensionalStandards,
  IntendedUse,
  JurisdictionOverlay,
  JurisdictionProfile,
  JurisdictionUseStatus,
} from '../types/site'

export const AUSTIN_STANDARDS_SOURCE_URL = 'https://library.municode.com/tx/austin/codes/land_development_code?nodeId=TIT25LADE_CH25-2ZO_SUBCHAPTER_CUSDERE_ART2PRUSDERE_DIV1RETA_S25-2-492SIDERE'
export const AUSTIN_JURISDICTION_SOURCE_URL = 'https://maps.austintexas.gov/arcgis/rest/services/Shared/JurisdictionsFill/MapServer/0'
export const AUSTIN_OVERLAY_SOURCE_URL = 'https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer'
export const AUSTIN_FLUM_SOURCE_URL = 'https://maps.austintexas.gov/arcgis/rest/services/PropertyProfile/LongRangePlanning/MapServer/4'

// Principal base-district values from Austin LDC §25-2-492. This registry is
// deliberately narrower than the district list: districts with use-specific,
// overlay-specific, or cross-referenced standards stay unresolved instead of
// being represented by a deceptively precise number.
const AUSTIN_BASE_STANDARDS: Record<string, DimensionalStandards> = {
  RR: {
    district: 'RR', minimumLotSquareFeet: 43_560, minimumLotWidthFeet: 100,
    maximumHeightFeet: 35, frontSetbackFeet: 40, streetSideSetbackFeet: 25,
    interiorSideSetbackFeet: 10, rearSetbackFeet: 20,
    maximumBuildingCoveragePercent: 20, maximumImperviousCoverPercent: 25,
    sourceSection: 'Austin LDC §25-2-492',
    notes: ['Principal base-district standard; additional watershed, subdivision, use, and compatibility rules may be more restrictive.'],
  },
  'SF-1': {
    district: 'SF-1', minimumLotSquareFeet: 10_000, minimumLotWidthFeet: 60,
    maximumHeightFeet: 35, frontSetbackFeet: 25, streetSideSetbackFeet: 15,
    interiorSideSetbackFeet: 5, rearSetbackFeet: 10,
    maximumBuildingCoveragePercent: 35, maximumImperviousCoverPercent: 40,
    sourceSection: 'Austin LDC §25-2-492',
    notes: ['HOME and small-lot provisions may establish different use-specific standards; Subchapter F can also control residential design.'],
  },
  'SF-2': {
    district: 'SF-2', minimumLotSquareFeet: 5_750, minimumLotWidthFeet: 50,
    maximumHeightFeet: 35, frontSetbackFeet: 25, streetSideSetbackFeet: 15,
    interiorSideSetbackFeet: 5, rearSetbackFeet: 10,
    maximumBuildingCoveragePercent: 40, maximumImperviousCoverPercent: 45,
    sourceSection: 'Austin LDC §25-2-492',
    notes: ['HOME and small-lot provisions may establish different use-specific standards; Subchapter F can also control residential design.'],
  },
  'SF-3': {
    district: 'SF-3', minimumLotSquareFeet: 5_750, minimumLotWidthFeet: 50,
    maximumHeightFeet: 35, frontSetbackFeet: 25, streetSideSetbackFeet: 15,
    interiorSideSetbackFeet: 5, rearSetbackFeet: 10,
    maximumBuildingCoveragePercent: 40,
    sourceSection: 'Austin LDC §25-2-492',
    notes: ['Maximum impervious cover is use-specific under §25-2-556/HOME and is intentionally not inferred here.', 'Subchapter F and other residential-use rules may be more restrictive.'],
  },
}

const JURISDICTION_LABELS: Record<string, string> = {
  FULL: 'Austin full-purpose jurisdiction',
  LTD: 'Austin limited-purpose jurisdiction',
  '2MILE': 'Austin 2-mile ETJ',
  '5MIL': 'Austin 5-mile ETJ',
  '5MILE': 'Austin 5-mile ETJ',
  ETJ: 'Extraterritorial jurisdiction',
  ADA: 'Agricultural development agreement',
  '2MILE_AG': '2-mile ETJ agricultural agreement',
  WQPZ: 'Water quality protection zone',
  OCLL: 'Other city limits',
  OETJ: 'Other city ETJ',
  OADA: 'Other city agricultural development agreement',
  OUT: 'Outside municipal jurisdiction',
}

const AUSTIN_FUTURE_LAND_USE_LABELS: Record<string, string> = {
  '10': 'Agriculture', '50': 'Rural Residential', '100': 'Single Family', '111': 'Higher-Density Single Family',
  '113': 'Mobile Homes', '130': 'Mixed Residential', '170': 'Residential Core', '200': 'Multi-family',
  '270': 'Neighborhood Transition', '300': 'Commercial', '305': 'Commerce', '315': 'Neighborhood Commercial',
  '325': 'Neighborhood Mixed Use', '330': 'Mixed Use', '335': 'High Density Mixed Use', '340': 'Specific Regulating District',
  '350': 'Warehouse/Limited Office', '370': 'Neighborhood Node', '380': 'Mixed-use Activity Hub/Corridor',
  '390': 'Activity Center', '400': 'Office', '430': 'Mixed Use/Office', '490': 'Major Planned Development',
  '500': 'Industry', '560': 'Major Impact Facilities', '600': 'Civic', '680': 'Special District',
  '700': 'Recreation & Open Space', '750': 'Environmental Conservation', '800': 'Transportation',
  '870': 'Utilities', '900': 'Undeveloped', '940': 'Water', '999': 'Excluded from FLUM',
}

export function formatAustinFutureLandUse(value?: string): string | undefined {
  if (!value) return undefined
  return AUSTIN_FUTURE_LAND_USE_LABELS[value.trim()] || value.trim()
}

const USES: IntendedUse[] = ['residential', 'commercial', 'mixed-use', 'industrial', 'other']

export function normalizeAustinBaseDistrict(raw: string): string {
  const value = raw.trim().toUpperCase()
  const direct = value.match(/^(LA|RR|SF-[1-6]|MF-[1-6]|MH|NO|LO|GO|CR|LR|GR|LI|L|CBD|DMU|W\/LO|CS-1|CS|CH|IP|MI|R&D|DR|AV|AG|PUD|TOD|NBG|ERC|TND|P)/)
  return direct?.[1] ?? value.split('-')[0]
}

export function getAustinBaseStandards(baseDistrict: string): DimensionalStandards | undefined {
  const standard = AUSTIN_BASE_STANDARDS[normalizeAustinBaseDistrict(baseDistrict)]
  return standard ? { ...standard, notes: [...standard.notes] } : undefined
}

export function evaluateAustinUseCompatibility(baseDistrict: string, zoningCode: string, standardsApply: boolean): Record<IntendedUse, JurisdictionUseStatus> {
  const result = Object.fromEntries(USES.map((use) => [use, 'unresolved'])) as Record<IntendedUse, JurisdictionUseStatus>
  if (!standardsApply) return result
  const base = normalizeAustinBaseDistrict(baseDistrict)
  const code = zoningCode.toUpperCase()
  const residential = /^(LA|RR|SF-|MF-|MH)/.test(base)
  const officeRetail = /^(NO|LO|GO|CR|LR|GR|CBD|DMU|W\/LO|CS|CH)/.test(base)
  const industrial = /^(IP|MI|LI|R&D)/.test(base)
  const mixed = base === 'CBD' || base === 'DMU' || /(^|-)MU($|-)/.test(code)
  const special = /^(PUD|TOD|NBG|ERC|TND|P|AG|DR|AV)$/.test(base)
  if (special) return result

  result.residential = residential || mixed ? 'likely-compatible' : industrial ? 'likely-incompatible' : 'conditional-review'
  result.commercial = officeRetail ? 'likely-compatible' : industrial || residential ? 'conditional-review' : 'unresolved'
  result['mixed-use'] = mixed ? 'likely-compatible' : officeRetail || residential ? 'conditional-review' : industrial ? 'likely-incompatible' : 'unresolved'
  result.industrial = industrial ? 'likely-compatible' : base === 'CS' || base === 'CH' ? 'conditional-review' : residential || officeRetail ? 'likely-incompatible' : 'unresolved'
  return result
}

export interface AustinProfileInput {
  zoningCode: string
  baseDistrict: string
  jurisdictionCode?: string
  jurisdictionLabel?: string
  cityName?: string
  overlays?: JurisdictionOverlay[]
  futureLandUse?: string
  verifiedAt?: string
}

export function buildAustinJurisdictionProfile(input: AustinProfileInput): JurisdictionProfile {
  const jurisdictionCode = input.jurisdictionCode?.toUpperCase()
  const standardsApply = jurisdictionCode === 'FULL' || jurisdictionCode === 'LTD'
  const mappedBase = normalizeAustinBaseDistrict(input.baseDistrict)
  const zoningBase = normalizeAustinBaseDistrict(input.zoningCode)
  // Austin's live ZONING_BASE attribute commonly returns only a broad family
  // such as "SF". The full ZONING_ZTYPE value (for example SF-3-NP) carries
  // the actual base district needed for code lookup.
  const baseDistrict = /^(SF|MF)$/.test(mappedBase) ? zoningBase : mappedBase || zoningBase
  const standards = standardsApply ? getAustinBaseStandards(baseDistrict) : undefined
  const overlays = input.overlays ?? []
  const reviewFlags: string[] = []
  if (!standardsApply) reviewFlags.push('Austin base zoning standards are not applied outside full- or limited-purpose jurisdiction.')
  if (standardsApply && !standards) reviewFlags.push(`The ${baseDistrict || 'mapped'} district requires manual code review; no numeric base-standard override is registered.`)
  if (overlays.length) reviewFlags.push(`${overlays.length} mapped overlay${overlays.length === 1 ? '' : 's'} may supersede the base district.`)
  if (input.futureLandUse) reviewFlags.push('Future land use is policy guidance, not a by-right zoning entitlement.')
  reviewFlags.push('Permitted-use status depends on the exact proposed use in §25-2-491 and is not a legal zoning verification.')

  return {
    profileId: 'austin-travis-v1',
    authorityName: input.cityName || 'City of Austin',
    jurisdictionLabel: input.jurisdictionLabel || JURISDICTION_LABELS[jurisdictionCode || ''] || 'Austin planning area — jurisdiction not returned',
    jurisdictionType: JURISDICTION_LABELS[jurisdictionCode || ''] || input.jurisdictionLabel || 'Unknown',
    jurisdictionCode,
    zoningCode: input.zoningCode,
    baseDistrict,
    standardsApply,
    standards,
    overlays,
    futureLandUse: formatAustinFutureLandUse(input.futureLandUse),
    useCompatibility: evaluateAustinUseCompatibility(baseDistrict, input.zoningCode, standardsApply),
    reviewFlags,
    verifiedAt: input.verifiedAt ?? new Date().toISOString(),
  }
}

export function jurisdictionStatusLabel(status: JurisdictionUseStatus): string {
  if (status === 'likely-compatible') return 'Likely district-family match'
  if (status === 'conditional-review') return 'Use-specific code review'
  if (status === 'likely-incompatible') return 'Likely district-family conflict'
  return 'Unresolved'
}
