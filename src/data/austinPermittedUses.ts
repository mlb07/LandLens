import type { JurisdictionProfile, ProposedUseAssessment, ProposedUseDefinition, ProposedUseId, ProposedUseStatus } from '../types/site'
import { normalizeAustinBaseDistrict } from './austinJurisdiction'

export const AUSTIN_PERMITTED_USES_SOURCE_URL = 'https://library.municode.com/tx/austin/codes/code_of_ordinances?nodeId=TIT25LADE_CH25-2ZO_SUBCHAPTER_CUSDERE_ART2PRUSDERE_DIV1RETA_S25-2-491PECOPRUS'

export type AustinUseTableStatus = ProposedUseStatus
export type AustinUseGroup = 'Residential' | 'Commercial' | 'Industrial' | 'Agricultural & civic'

export interface AustinProposedUseDefinition extends ProposedUseDefinition {
  group: AustinUseGroup
}

export type AustinUseAssessment = ProposedUseAssessment

const DISTRICTS = ['LA', 'RR', 'SF-1', 'SF-2', 'SF-3', 'SF-4A', 'SF-4B', 'SF-5', 'SF-6', 'MF-1', 'MF-2', 'MF-3', 'MF-4', 'MF-5', 'MF-6', 'MH', 'NO', 'LO', 'GO', 'CR', 'LR', 'GR', 'L', 'CBD', 'DMU', 'W/LO', 'CS', 'CS-1', 'CH', 'IP', 'MI', 'LI', 'R&D', 'DR', 'AV', 'AG', 'PUD', 'P'] as const

interface MatrixDefinition extends AustinProposedUseDefinition {
  cells: string
}

// Current §25-2-491 cells in the district order above. "-" is not permitted;
// P/C are direct table statuses. Footnotes and PC/CP variants intentionally
// become special-review because another code section controls the outcome.
const MATRIX_DEFINITIONS: MatrixDefinition[] = [
  { key: 'single_family', label: 'Single-family home', codeLabel: 'Single-Family Residential', group: 'Residential', intendedUse: 'residential', cells: 'P P P P P - - P P P P P P P P - - - - - - - - P P - - - - - - - 1 P - C 3 4' },
  { key: 'duplex', label: 'Duplex', codeLabel: 'Duplex Residential', group: 'Residential', intendedUse: 'residential', cells: '- - - - P - - P P P P P P P P - - - - - - - - P P - - - - - - - - - - - - -' },
  { key: 'two_family', label: 'Two-family residential', codeLabel: 'Two-Family Residential', group: 'Residential', intendedUse: 'residential', cells: '- - - - P - - P P P P P P P P - - - - - - - - P P - - - - - - - - - - - - -' },
  { key: 'multifamily', label: 'Multifamily residential', codeLabel: 'Multifamily Residential', group: 'Residential', intendedUse: 'residential', cells: '- - - - - - - - - P P P P P P - - - - - - - C P P - - - P - - - - - - - - -' },
  { key: 'townhouse', label: 'Townhouse residential', codeLabel: 'Townhouse Residential', group: 'Residential', intendedUse: 'residential', cells: '- - - - - - - P P P P P P P P - - - - - - - C P P - - - P - - - - - - - - -' },
  { key: 'condominium', label: 'Condominium residential', codeLabel: 'Condominium Residential', group: 'Residential', intendedUse: 'residential', cells: '- - - - - - - P P P P P P P P - - - - - - - C P P - - - P - - - - - - - - -' },
  { key: 'mobile_home', label: 'Mobile home residential', codeLabel: 'Mobile Home Residential', group: 'Residential', intendedUse: 'residential', cells: '- - - - - - - - - - - - - - - P - - - - - - - - - - - - - - - - - - - - - -' },
  { key: 'bed_breakfast_group1', label: 'Bed & breakfast — Group 1', codeLabel: 'Bed & Breakfast (Group 1)', group: 'Residential', intendedUse: 'commercial', cells: '- - P P P - - P P P P P P P P - P P P P P P P P P P P P P - - - - - - - - -' },
  { key: 'professional_office', label: 'Professional office', codeLabel: 'Professional Office', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - P P P - P P C P P - P P P P P P 1 - 2 - 3 4' },
  { key: 'medical_office_small', label: 'Medical office — 5,000 sq ft or less', codeLabel: 'Medical Offices—not exceeding 5,000 sq. ft. gross floor area', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - - P P - P P C P P - P P P P P P 1 - 2 - 3 4' },
  { key: 'general_retail_convenience', label: 'Convenience retail', codeLabel: 'General Retail Sales (Convenience)', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - - - - - P P C P P - P P P - P P 1 - 2 - 3 4' },
  { key: 'general_retail_general', label: 'General retail', codeLabel: 'General Retail Sales (General)', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - - - - - 11 P C P P - P P P - P P 1 - 2 - 3 4' },
  { key: 'restaurant_limited', label: 'Limited restaurant', codeLabel: 'Restaurant (Limited)', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - - - C - P P C P P - P P P P P P 1 - 2 - 3 4' },
  { key: 'restaurant_general', label: 'General restaurant', codeLabel: 'Restaurant (General)', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - - - - C 11 P C P P - P P P P P P 1 - 2 - 3 4' },
  { key: 'food_sales', label: 'Food sales / grocery', codeLabel: 'Food Sales', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - - - - - P P C P P - P P P - P P 1 - 2 - 3 4' },
  { key: 'personal_services', label: 'Personal services', codeLabel: 'Personal Services', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - - C P - P P C P P - P P P P P P 1 - 2 - 3 4' },
  { key: 'hotel_motel', label: 'Hotel or motel', codeLabel: 'Hotel-Motel', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - - - - C - P C P P - P P P - P P 1 - 2 - 3 4' },
  { key: 'indoor_entertainment', label: 'Indoor entertainment', codeLabel: 'Indoor Entertainment', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - - - - C - P C P P - P P P P P P 1 - 2 - 3 4' },
  { key: 'automotive_repair', label: 'Automotive repair services', codeLabel: 'Automotive Repair Services', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - - - - - - P C C C - P P P P P P 1 - 2 - 3 4' },
  { key: 'convenience_storage', label: 'Convenience storage', codeLabel: 'Convenience Storage', group: 'Commercial', intendedUse: 'commercial', cells: '- - - - - - - - - - - - - - - - - - - - - - - - - C P P P P P P 1 - - - 3 4' },
  { key: 'custom_manufacturing', label: 'Custom manufacturing', codeLabel: 'Custom Manufacturing', group: 'Industrial', intendedUse: 'industrial', cells: '- - - - - - - - - - - - - - - - - - - - C C - P P P P P P P P P 1 - 2 - 3 4' },
  { key: 'light_manufacturing', label: 'Light manufacturing', codeLabel: 'Light Manufacturing', group: 'Industrial', intendedUse: 'industrial', cells: '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - P P P 1 - 2 - 3 4' },
  { key: 'limited_warehousing', label: 'Limited warehousing & distribution', codeLabel: 'Limited Warehousing and Distribution', group: 'Industrial', intendedUse: 'industrial', cells: '- - - - - - - - - - - - - - - - - - - - - - - P P P P P P P P P 1 - 2 - 3 4' },
  { key: 'general_warehousing', label: 'General warehousing & distribution', codeLabel: 'General Warehousing and Distribution', group: 'Industrial', intendedUse: 'industrial', cells: '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - P P P 1 - 2 - 3 4' },
  { key: 'community_garden', label: 'Community garden', codeLabel: 'Community Garden', group: 'Agricultural & civic', intendedUse: 'other', cells: 'P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P' },
  { key: 'urban_farm', label: 'Urban farm', codeLabel: 'Urban Farm', group: 'Agricultural & civic', intendedUse: 'other', cells: 'P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P P' },
  { key: 'daycare_limited', label: 'Limited day care', codeLabel: 'Day Care Services (Limited)', group: 'Agricultural & civic', intendedUse: 'other', cells: 'C P P P P P P P P P P P P P P P P P P - P P C P P P P P P P P P 1 - 2 - 3 4' },
  { key: 'daycare_general', label: 'General day care', codeLabel: 'Day Care Services (General)', group: 'Agricultural & civic', intendedUse: 'other', cells: 'C C C C C C C C C P P P P P P P P P P - P P C P P P P P P P P P 1 - 2 - 3 4' },
  { key: 'daycare_commercial', label: 'Commercial day care', codeLabel: 'Day Care Services (Commercial)', group: 'Agricultural & civic', intendedUse: 'commercial', cells: 'C C C C C C C C C C C C C C C C P P P C P P C P P P P P P P P P P - 2 - 3 4' },
  { key: 'religious_assembly', label: 'Religious assembly', codeLabel: 'Religious Assembly', group: 'Agricultural & civic', intendedUse: 'other', cells: 'P P P P P P P P P P P P P P P P P P P C P P C P P P P P P P P P 1 P 2 - 3 4' },
]

export const AUSTIN_PROPOSED_USES: AustinProposedUseDefinition[] = MATRIX_DEFINITIONS.map((definition) => ({
  key: definition.key,
  label: definition.label,
  codeLabel: definition.codeLabel,
  group: definition.group,
  intendedUse: definition.intendedUse,
}))

function parseMatrix(): Map<ProposedUseId, Map<string, string>> {
  const matrix = new Map<ProposedUseId, Map<string, string>>()
  for (const definition of MATRIX_DEFINITIONS) {
    const cells = definition.cells.split(/\s+/)
    if (cells.length !== DISTRICTS.length) throw new Error(`Austin use matrix row ${definition.key} has ${cells.length} cells; expected ${DISTRICTS.length}.`)
    matrix.set(definition.key, new Map(DISTRICTS.map((district, index) => [district, cells[index]])))
  }
  return matrix
}

const USE_MATRIX = parseMatrix()

function cellStatus(cell?: string): AustinUseTableStatus {
  if (!cell) return 'unresolved'
  if (cell === 'P') return 'permitted'
  if (cell === 'C') return 'conditional'
  if (cell === '-') return 'prohibited'
  return 'special-review'
}

export function getAustinProposedUseDefinition(key?: ProposedUseId): AustinProposedUseDefinition | undefined {
  return AUSTIN_PROPOSED_USES.find((definition) => definition.key === key)
}

export function assessAustinProposedUse(profile: JurisdictionProfile, proposedUse?: ProposedUseId): AustinUseAssessment | undefined {
  if (!proposedUse) return undefined
  const definition = getAustinProposedUseDefinition(proposedUse)
  if (!definition) return undefined
  const district = normalizeAustinBaseDistrict(profile.baseDistrict)
  const rawCell = USE_MATRIX.get(proposedUse)?.get(district)
  const outsideRegulatoryJurisdiction = !profile.standardsApply
  const specialDistrict = /^(PUD|TOD|NBG|ERC|TND)$/.test(district)
  const combiningDistrictMayModify = /(^|-)(MU|V|CO|DBETOD|ETOD|NCCD|PDA|CURE|NP)(-|$)/.test(profile.zoningCode.toUpperCase())
  let status = outsideRegulatoryJurisdiction ? 'unresolved' : specialDistrict ? 'special-review' : cellStatus(rawCell)
  if (status === 'prohibited' && /(^|-)(MU|V)(-|$)/.test(profile.zoningCode.toUpperCase())) status = 'special-review'
  const requiresOverlayReview = profile.overlays.length > 0
  const statusText = status === 'permitted' ? 'listed as permitted in the base district'
    : status === 'conditional' ? 'listed as conditional in the base district'
      : status === 'prohibited' ? 'not listed as permitted in the base district'
        : status === 'special-review' ? 'controlled by a footnote, combining district, or special-district rule'
          : 'unresolved for the mapped jurisdiction'
  return {
    proposedUse,
    useLabel: definition.codeLabel,
    district,
    status,
    statusLabel: austinUseStatusLabel(status),
    rawCell,
    sourceSection: 'Austin LDC §25-2-491',
    requiresCombiningDistrictReview: combiningDistrictMayModify,
    requiresOverlayReview,
    explanation: `${definition.codeLabel} is ${statusText}. Other Title 25 provisions, zoning combining districts, conditional overlays, and site-specific approvals can modify this base-table result.`,
  }
}

export function austinUseStatusLabel(status: AustinUseTableStatus): string {
  if (status === 'permitted') return 'Permitted in base table'
  if (status === 'conditional') return 'Conditional use permit'
  if (status === 'prohibited') return 'Not permitted in base table'
  if (status === 'special-review') return 'Special / combining-district review'
  return 'Unresolved'
}
