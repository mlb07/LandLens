import type {
  Coordinates,
  DataProvenance,
  JurisdictionProfile,
  ProposedUseAssessment,
  ProposedUseDefinition,
  ProposedUseId,
  JurisdictionSource,
} from '../../types/site'

export interface JurisdictionZoningData {
  zoningCode: string
  baseDistrict: string
  jurisdiction: string
  profile: JurisdictionProfile
}

export interface JurisdictionPackResult {
  available: boolean
  value?: JurisdictionZoningData
  provenance: DataProvenance
  error?: string
}

export interface JurisdictionUtilityData {
  utilityName: string
  utilityType: 'electric' | 'water' | 'sewer' | 'multiple'
  inServiceArea: boolean
  jurisdiction: string
}

export interface JurisdictionUtilityResult {
  available: boolean
  value?: JurisdictionUtilityData
  provenance: DataProvenance
  error?: string
}

export interface JurisdictionPack {
  id: string
  profileId: string
  label: string
  stateCode: string
  bounds: { south: number; west: number; north: number; east: number }
  description: string
  proposedUseLabel: string
  proposedUseHelpText: string
  proposedUses: ProposedUseDefinition[]
  sources: JurisdictionSource[]
  query: (coordinates: Coordinates, signal?: AbortSignal) => Promise<JurisdictionPackResult>
  queryUtility?: (coordinates: Coordinates, signal?: AbortSignal) => Promise<JurisdictionUtilityResult>
  assessUse: (profile: JurisdictionProfile, proposedUse?: ProposedUseId) => ProposedUseAssessment | undefined
}

export interface JurisdictionCoverageEntry {
  packId: string
  profileId: string
  label: string
  stateCode: string
  bounds: JurisdictionPack['bounds']
  proposedUseCount: number
  hasUtility: boolean
}
