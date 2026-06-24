import type { Coordinates, DataProvenance } from '../types/site'
import type { OfficialObservation } from './officialDataProvider'

// ─── Local jurisdiction adapter framework ───────────────────────────────
//
// Local GIS data for zoning, utility capacity, easements, and ROW is
// inherently fragmentary — each county/city publishes differently. This
// registry provides a pluggable pattern for wiring local adapters over time.
// An adapter declares the jurisdiction it covers and a query function.
// LandLens checks the registry for the point's jurisdiction and uses the
// adapter if one exists. When no adapter covers the point, the category
// remains unavailable with an honest explanation.

export type LocalCategory = 'easements' | 'zoningAtlas' | 'utilityCapacity'

export interface LocalAdapterResult {
  available: boolean
  value?: unknown
  provenance: DataProvenance
  error?: string
}

export interface LocalAdapter {
  id: string
  category: LocalCategory
  jurisdiction: string         // e.g. "Travis County, TX"
  stateCode: string
  bounds?: { south: number; west: number; north: number; east: number }
  query: (coordinates: Coordinates, signal?: AbortSignal) => Promise<LocalAdapterResult>
}

// ─── Easements observation type ─────────────────────────────────────────

export interface EasementData {
  hasRecordedEasements: boolean
  easementTypes: string[]
  sourceLayer: string
}

export type EasementsObservation = OfficialObservation<EasementData>

// ─── Registry ───────────────────────────────────────────────────────────

const registry: LocalAdapter[] = []

export function registerLocalAdapter(adapter: LocalAdapter): void {
  if (!registry.some((a) => a.id === adapter.id)) {
    registry.push(adapter)
  }
}

export function getLocalAdapters(category: LocalCategory, coordinates: Coordinates, stateCode: string): LocalAdapter[] {
  return registry.filter((a) =>
    a.category === category &&
    a.stateCode === stateCode &&
    (!a.bounds || (
      coordinates.lat >= a.bounds.south && coordinates.lat <= a.bounds.north &&
      coordinates.lng >= a.bounds.west && coordinates.lng <= a.bounds.east
    )),
  )
}

export function hasLocalCoverage(category: LocalCategory, stateCode: string): boolean {
  return registry.some((a) => a.category === category && a.stateCode === stateCode)
}

// ─── Easements fetch ────────────────────────────────────────────────────

const EASEMENTS_PROVENANCE: DataProvenance = {
  source: 'Local GIS easement/ROW overlay',
  sourceUrl: '',
  vintage: 'Local jurisdiction service',
  coverageNote: 'Easement and ROW overlays are local and fragmentary. No national easement dataset exists. A title commitment and ALTA survey remain the authoritative source. LandLens wires local GIS adapters where available.',
}

const EASEMENTS_FALLBACK_PROVENANCE: DataProvenance = {
  source: 'No local easement adapter',
  sourceUrl: 'https://www.alta.org/',
  vintage: 'N/A',
  coverageNote: 'No local GIS easement/ROW adapter is registered for this jurisdiction. Easements, encumbrances, covenants, and dedications can only be confirmed from title commitment and an ALTA/NSPS land title survey. This is the authoritative source and cannot be replaced by screening data.',
}

export async function fetchEasements(coordinates: Coordinates, stateCode: string, signal?: AbortSignal): Promise<EasementsObservation> {
  const adapters = getLocalAdapters('easements', coordinates, stateCode)
  if (!adapters.length) {
    return {
      available: false,
      provenance: EASEMENTS_FALLBACK_PROVENANCE,
      error: 'No local GIS easement adapter is registered for this jurisdiction. A title commitment and ALTA survey are required.',
    }
  }

  // Try each matching adapter until one returns data.
  for (const adapter of adapters) {
    try {
      const result = await adapter.query(coordinates, signal)
      if (result.available && result.value) {
        return {
          available: true,
          value: result.value as EasementData,
          provenance: { ...result.provenance, ...EASEMENTS_PROVENANCE },
        }
      }
    } catch {
      // Try the next adapter
    }
  }

  return {
    available: false,
    provenance: EASEMENTS_PROVENANCE,
    error: 'Local easement adapters were found but did not return usable data.',
  }
}

// ─── Coverage summary ───────────────────────────────────────────────────

export function getLocalCoverageSummary(): Record<LocalCategory, string[]> {
  const summary: Record<LocalCategory, string[]> = { easements: [], zoningAtlas: [], utilityCapacity: [] }
  for (const adapter of registry) {
    if (!summary[adapter.category].includes(adapter.jurisdiction)) {
      summary[adapter.category].push(adapter.jurisdiction)
    }
  }
  return summary
}
