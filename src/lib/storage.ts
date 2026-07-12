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
    if (stored) {
      const parsed = JSON.parse(stored) as Array<SavedSite & { isSample?: boolean }>
      const migrated = parsed
        .filter((site) => !site.isSample)
        .map((site) => {
          const cleanSite = { ...site }
          delete cleanSite.isSample
          return migrateSite(cleanSite)
        })
      // Persist to the v2 key and clear the legacy key so we do not re-migrate.
      saveSites(migrated)
      try { localStorage.removeItem(LEGACY_KEY) } catch { /* ignore */ }
      return migrated
    }
  } catch {
    // Fall through to a clean portfolio when stored data is malformed or unavailable.
  }
  return []
}

export function saveSites(sites: SavedSite[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sites))
}
