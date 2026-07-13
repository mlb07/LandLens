import { analyzeSite } from '../lib/scoring'
import type { SavedSite } from '../types/site'

const STORAGE_KEY = 'landlens.saved-sites.v2'
const LEGACY_KEY = 'landlens.saved-sites.v1'

// Detect the old 6-category analysis shape so legacy saved sites can be
// migrated to the new 14-category shape without losing user-entered inputs.
function isLegacyAnalysis(analysis: SavedSite['analysis']): boolean {
  if (!analysis || typeof analysis !== 'object') return true
  const metrics = analysis.metrics as Record<string, unknown> | undefined
  if (!metrics) return true
  // New schema keys categories by 'zoning', 'floodplain', 'wetlands', etc.
  // Old schema used 'flood', 'road', 'demographics', 'environmental', 'manual'.
  return 'flood' in metrics || 'manual' in metrics || !('floodplain' in metrics)
}

function migrateSite(site: SavedSite): SavedSite {
  if (!isLegacyAnalysis(site.analysis)) return site
  // We do not retain old official observations on saved sites, so the
  // migrated analysis is recomputed from inputs alone. Opening the site
  // triggers a fresh official-source fetch that repopulates the analysis.
  return {
    ...site,
    stateCode: site.stateCode || 'TX',
    analysis: analyzeSite(site.coordinates, site.inputs, undefined, false, null, null),
  }
}

export function loadSites(): SavedSite[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as Array<SavedSite & { isSample?: boolean }>
    if (!Array.isArray(parsed)) return []
    const migrated: SavedSite[] = []
    for (const raw of parsed) {
      if (raw?.isSample) continue
      try {
        const cleanSite = { ...raw }
        delete cleanSite.isSample
        migrated.push(migrateSite(cleanSite))
      } catch {
        // Skip a single corrupt record rather than discarding the whole portfolio.
      }
    }
    // Persist to the v2 key and clear the legacy key so we do not re-migrate.
    // A persistence failure here must not lose the in-memory migrated list.
    try {
      saveSites(migrated)
      localStorage.removeItem(LEGACY_KEY)
    } catch { /* ignore — return what we migrated */ }
    return migrated
  } catch {
    // Fall through to a clean portfolio when stored data is malformed or unavailable.
    return []
  }
}

export function saveSites(sites: SavedSite[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sites))
}

// Escape hatch for the top-level error fallback: when a corrupt saved record
// keeps crashing the app, the user can clear persisted sites and reload.
export function clearSavedSites() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(LEGACY_KEY)
}
