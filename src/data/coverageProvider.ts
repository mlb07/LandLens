import type { Coordinates } from '../types/site'
import { getApplicableJurisdictionPacks } from './jurisdictions/registry'
import { getParcelCoverage, getParcelProviderContracts } from './parcelProvider'

export interface CoverageTelemetry {
  national: {
    stateCount: number
    adapterCount: number
    enrichedAdapterCount: number
    auditedGeometryOnlyCount: number
  }
  current: {
    stateCode: string
    parcelStatus: 'verified-here' | 'partial-state-gap' | 'unsupported'
    parcelSources: string[]
    richFacts: boolean
    jurisdictionPacks: string[]
  }
}

function includesPoint(bounds: NonNullable<ReturnType<typeof getParcelProviderContracts>[number]['bounds']>, coordinates: Coordinates): boolean {
  return coordinates.lat >= bounds.south && coordinates.lat <= bounds.north
    && coordinates.lng >= bounds.west && coordinates.lng <= bounds.east
}

export function getCoverageTelemetry(coordinates: Coordinates, stateCode: string): CoverageTelemetry {
  const nationalCoverage = getParcelCoverage()
  const contracts = getParcelProviderContracts()
  const stateAdapters = contracts.filter((adapter) => adapter.stateCode === stateCode)
  const matching = stateAdapters.filter((adapter) => !adapter.bounds || includesPoint(adapter.bounds, coordinates))
  const parcelStatus = matching.length > 0 ? 'verified-here' : stateAdapters.length > 0 ? 'partial-state-gap' : 'unsupported'
  return {
    national: {
      stateCount: nationalCoverage.states.length,
      adapterCount: nationalCoverage.adapterCount,
      enrichedAdapterCount: contracts.filter((adapter) => adapter.factStatus === 'enriched').length,
      auditedGeometryOnlyCount: contracts.filter((adapter) => adapter.factStatus === 'audited-no-public-facts').length,
    },
    current: {
      stateCode,
      parcelStatus,
      parcelSources: matching.map((adapter) => adapter.source),
      richFacts: matching.some((adapter) => adapter.factStatus === 'enriched'),
      jurisdictionPacks: getApplicableJurisdictionPacks(coordinates, stateCode).map((pack) => pack.label),
    },
  }
}
