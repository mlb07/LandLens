import type {
  Coordinates,
  JurisdictionProfile,
  JurisdictionUseStatus,
  JurisdictionSource,
  ProposedUseAssessment,
  ProposedUseDefinition,
  ProposedUseId,
} from '../../types/site'
import type { JurisdictionCoverageEntry, JurisdictionPack, JurisdictionPackResult, JurisdictionUtilityResult } from './types'

const packs: JurisdictionPack[] = []

function includesPoint(pack: JurisdictionPack, coordinates: Coordinates): boolean {
  return coordinates.lat >= pack.bounds.south && coordinates.lat <= pack.bounds.north
    && coordinates.lng >= pack.bounds.west && coordinates.lng <= pack.bounds.east
}

export function registerJurisdictionPack(pack: JurisdictionPack): void {
  const duplicateProfile = packs.find((candidate) => candidate.profileId === pack.profileId && candidate.id !== pack.id)
  if (duplicateProfile) throw new Error(`Jurisdiction profile id ${pack.profileId} is already owned by ${duplicateProfile.id}.`)
  if (!packs.some((candidate) => candidate.id === pack.id)) packs.push(pack)
}

export function getJurisdictionPack(profile?: JurisdictionProfile): JurisdictionPack | undefined {
  if (!profile) return undefined
  return packs.find((pack) => pack.id === profile.packId || pack.profileId === profile.profileId)
}

export function getApplicableJurisdictionPacks(coordinates: Coordinates, stateCode: string): JurisdictionPack[] {
  return packs.filter((pack) => pack.stateCode === stateCode && includesPoint(pack, coordinates))
}

export async function fetchJurisdictionPackProfile(
  coordinates: Coordinates,
  stateCode: string,
  signal?: AbortSignal,
): Promise<JurisdictionPackResult | undefined> {
  const candidates = getApplicableJurisdictionPacks(coordinates, stateCode)
  let lastUnavailable: JurisdictionPackResult | undefined
  for (const pack of candidates) {
    try {
      const result = await pack.query(coordinates, signal)
      if (result.available && result.value) return result
      lastUnavailable = result
    } catch (error) {
      lastUnavailable = {
        available: false,
        provenance: { source: pack.label, sourceUrl: '', coverageNote: pack.description },
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  return lastUnavailable
}

export async function fetchJurisdictionPackUtility(
  coordinates: Coordinates,
  stateCode: string,
  signal?: AbortSignal,
): Promise<JurisdictionUtilityResult | undefined> {
  const candidates = getApplicableJurisdictionPacks(coordinates, stateCode).filter((pack) => pack.queryUtility)
  let lastUnavailable: JurisdictionUtilityResult | undefined
  for (const pack of candidates) {
    try {
      const result = await pack.queryUtility?.(coordinates, signal)
      if (result?.available && result.value) return result
      if (result) lastUnavailable = result
    } catch (error) {
      lastUnavailable = {
        available: false,
        provenance: { source: pack.label, sourceUrl: '', coverageNote: pack.description },
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  return lastUnavailable
}

export function getJurisdictionProposedUses(profile?: JurisdictionProfile): ProposedUseDefinition[] {
  return getJurisdictionPack(profile)?.proposedUses ?? []
}

export function getJurisdictionSources(profile?: JurisdictionProfile): JurisdictionSource[] {
  const combined = [...(profile?.sources ?? []), ...(getJurisdictionPack(profile)?.sources ?? [])]
  return combined.filter((source, index) => combined.findIndex((candidate) => candidate.id === source.id) === index)
}

export function getJurisdictionProposedUseDefinition(
  profile: JurisdictionProfile | undefined,
  proposedUse?: ProposedUseId,
): ProposedUseDefinition | undefined {
  if (!proposedUse) return undefined
  return getJurisdictionProposedUses(profile).find((definition) => definition.key === proposedUse)
}

export function assessJurisdictionProposedUse(
  profile: JurisdictionProfile | undefined,
  proposedUse?: ProposedUseId,
): ProposedUseAssessment | undefined {
  return profile ? getJurisdictionPack(profile)?.assessUse(profile, proposedUse) : undefined
}

export function jurisdictionStatusLabel(status: JurisdictionUseStatus): string {
  if (status === 'likely-compatible') return 'Likely district-family match'
  if (status === 'conditional-review') return 'Use-specific code review'
  if (status === 'likely-incompatible') return 'Likely district-family conflict'
  return 'Unresolved'
}

export function getJurisdictionCoverage(): JurisdictionCoverageEntry[] {
  return packs.map((pack) => ({
    packId: pack.id,
    profileId: pack.profileId,
    label: pack.label,
    stateCode: pack.stateCode,
    bounds: { ...pack.bounds },
    proposedUseCount: pack.proposedUses.length,
    hasUtility: Boolean(pack.queryUtility),
  }))
}

export function clearJurisdictionPacksForTests(): void {
  packs.splice(0, packs.length)
}
