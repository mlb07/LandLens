import { describe, it, expect } from 'vitest'
import { getLocalCoverageSummary, registerLocalAdapter, hasLocalCoverage, type LocalAdapter } from './localAdapters'

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
})
