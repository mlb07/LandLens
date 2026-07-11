import { describe, it, expect } from 'vitest'
import { getLocalCoverageSummary, registerLocalAdapter, hasLocalCoverage, registerDefaultLocalAdapters, type LocalAdapter } from './localAdapters'

describe('localAdapters registry', () => {
  it('starts empty', () => {
    const summary = getLocalCoverageSummary()
    expect(summary.easements).toHaveLength(0)
    expect(summary.zoningAtlas).toHaveLength(0)
    expect(summary.utilityCapacity).toHaveLength(0)
  })

  it('registers and queries an adapter', () => {
    const adapter: LocalAdapter = {
      id: 'test-easements-travis',
      category: 'easements',
      jurisdiction: 'Travis County, TX',
      stateCode: 'TX',
      bounds: { south: 30.0, west: -98.2, north: 30.7, east: -97.3 },
      query: async () => ({ available: true, value: { hasRecordedEasements: false, easementTypes: [], sourceLayer: 'test' }, provenance: { source: 'test', sourceUrl: 'test' } }),
    }
    registerLocalAdapter(adapter)
    expect(hasLocalCoverage('easements', 'TX')).toBe(true)
    expect(hasLocalCoverage('easements', 'CA')).toBe(false)
    const summary = getLocalCoverageSummary()
    expect(summary.easements).toContain('Travis County, TX')
  })

  it('registers the Travis County easement adapter via registerDefaultLocalAdapters and is idempotent', () => {
    registerDefaultLocalAdapters()
    registerDefaultLocalAdapters() // idempotent — should not duplicate
    expect(hasLocalCoverage('easements', 'TX')).toBe(true)
    expect(hasLocalCoverage('zoningAtlas', 'TX')).toBe(true)
    expect(hasLocalCoverage('utilityCapacity', 'TX')).toBe(true)
    const summary = getLocalCoverageSummary()
    const travis = summary.easements.filter((j) => j === 'Travis County, TX')
    expect(travis).toHaveLength(1)
    expect(summary.zoningAtlas).toContain('Austin/Travis jurisdiction pack')
    expect(summary.utilityCapacity).toContain('Austin/Travis jurisdiction pack')
  })
})
