import type { JurisdictionProfile } from '../../types/site'
import type { SetbackStandardsInput } from '../parcelOverlayProvider'

export function jurisdictionSetbackStandards(profile?: JurisdictionProfile): SetbackStandardsInput | undefined {
  const standards = profile?.standards
  if (!profile?.standardsApply || !standards?.frontSetbackFeet || !standards.interiorSideSetbackFeet || !standards.rearSetbackFeet) return undefined
  return {
    frontFeet: standards.frontSetbackFeet,
    sideFeet: standards.interiorSideSetbackFeet,
    rearFeet: standards.rearSetbackFeet,
    district: standards.district,
    authority: profile.authorityName,
    sourceUrl: standards.sourceUrl ?? profile.sources?.find((source) => source.role === 'standards')?.url ?? '',
    sourceSection: standards.sourceSection,
    notes: standards.notes,
  }
}
