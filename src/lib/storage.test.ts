import { describe, it, expect, beforeEach } from 'vitest'
import { clearSavedSites, loadSites, saveSites } from './storage'
import type { SavedSite } from '../types/site'

const STORAGE_KEY_V2 = 'landlens.saved-sites.v2'
const STORAGE_KEY_V1 = 'landlens.saved-sites.v1'

function makeLegacySite(): SavedSite {
  return {
    id: 'legacy-1',
    stateCode: 'TX',
    coordinates: { lat: 30.27, lng: -97.74 },
    inputs: {
      name: 'Old Austin site',
      acres: '5',
      location: 'Austin',
      estimatedPrice: '',
      intendedUse: 'residential',
      roadFrontage: 'yes',
      utilitiesNearby: 'unknown',
      zoningNotes: '',
      notes: '',
    },
    // Legacy 6-category analysis shape
    analysis: {
      finalScore: 72, scoredWeight: 100, verdict: 'Interesting', verdictTone: 'interesting',
      confidence: 60, confidenceLabel: 'Moderate', confidencePenalty: 0,
      hardGates: [], gatedToManual: false,
      metrics: {
        flood: { category: 'flood', label: 'Flood', score: 80, weight: 20, summary: '', detail: '', displayValue: 'X', status: 'official' },
        slope: { category: 'slope', label: 'Slope', score: 75, weight: 15, summary: '', detail: '', displayValue: '5%', status: 'official' },
        road: { category: 'road', label: 'Road', score: 70, weight: 15, summary: '', detail: '', displayValue: '50m', status: 'official' },
        demographics: { category: 'demographics', label: 'Pop', score: 65, weight: 15, summary: '', detail: '', displayValue: '+3%', status: 'official' },
        environmental: { category: 'environmental', label: 'Wet', score: 88, weight: 20, summary: '', detail: '', displayValue: 'none', status: 'official' },
        manual: { category: 'manual', label: 'Manual', score: 55, weight: 15, summary: '', detail: '', displayValue: '', status: 'user' },
      },
      strengths: [], redFlags: [], unknowns: [], nextSteps: [],
    },
    screeningArea: { kind: 'point' },
    createdAt: '2026-06-20T00:00:00Z',
    updatedAt: '2026-06-20T00:00:00Z',
  } as unknown as SavedSite
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty array when no data is stored', () => {
    expect(loadSites()).toEqual([])
  })

  it('saves and loads sites with the v2 key', () => {
    const site: SavedSite = {
      id: 'test-1',
      stateCode: 'TX',
      coordinates: { lat: 30, lng: -97 },
      inputs: { name: 'Test', acres: '10', location: 'TX', estimatedPrice: '', intendedUse: 'residential', proposedUse: 'single_family', roadFrontage: 'yes', utilitiesNearby: 'yes', zoningNotes: 'by-right', notes: '' },
      analysis: {
        finalScore: 90, rawScore: 90, scoredWeight: 100, verdict: 'Strong', verdictTone: 'strong',
        confidence: 80, confidenceLabel: 'High', confidencePenalty: 0,
        hardGates: [], gatedToManual: false,
        metrics: {} as never,
        strengths: [], redFlags: [], unknowns: [], nextSteps: [],
      },
      screeningArea: { kind: 'point' },
      parcel: { id: 'P-100', acres: 10, acreageKind: 'assessor', facts: { marketValue: 500_000, zoning: 'C2', yearBuilt: 2001 }, provenance: { source: 'County assessor', sourceUrl: 'https://example.gov' } },
      authority: { authorityName: 'Austin city', authorityType: 'incorporated-place', incorporatedPlace: 'Austin city', countyName: 'Travis County', stateCode: 'TX', sourceVintage: 'Current Census geography', coverageNote: 'Routing baseline only', resolvedAt: '2026-07-10T00:00:00Z' },
      jurisdiction: {
        profileId: 'austin-travis-v1', authorityName: 'City of Austin', jurisdictionLabel: 'FULL PURPOSE', jurisdictionType: 'Austin full-purpose jurisdiction', jurisdictionCode: 'FULL',
        zoningCode: 'SF-3-NP', baseDistrict: 'SF-3', standardsApply: true, overlays: [], futureLandUse: 'Single Family',
        useCompatibility: { residential: 'likely-compatible', commercial: 'conditional-review', 'mixed-use': 'conditional-review', industrial: 'likely-incompatible', other: 'unresolved' },
        reviewFlags: [], verifiedAt: '2026-07-10T00:00:00Z',
      },
      createdAt: '2026-06-24T00:00:00Z',
      updatedAt: '2026-06-24T00:00:00Z',
    }
    saveSites([site])
    const loaded = loadSites()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('test-1')
    expect(loaded[0].parcel?.facts).toEqual({ marketValue: 500_000, zoning: 'C2', yearBuilt: 2001 })
    expect(loaded[0].jurisdiction?.futureLandUse).toBe('Single Family')
    expect(loaded[0].authority?.countyName).toBe('Travis County')
    expect(loaded[0].inputs.proposedUse).toBe('single_family')
  })

  it('migrates legacy v1 sites to the new 14-category shape', () => {
    const legacy = makeLegacySite()
    localStorage.setItem(STORAGE_KEY_V1, JSON.stringify([legacy]))

    const loaded = loadSites()
    expect(loaded).toHaveLength(1)
    const site = loaded[0]

    // Should have the new 14 categories, not the old 6
    const metricKeys = Object.keys(site.analysis.metrics)
    expect(metricKeys).toHaveLength(14)
    expect(metricKeys).toContain('floodplain')
    expect(metricKeys).toContain('wetlands')
    expect(metricKeys).toContain('zoning')
    expect(metricKeys).not.toContain('flood')
    expect(metricKeys).not.toContain('manual')

    // v2 key should be written
    expect(localStorage.getItem(STORAGE_KEY_V2)).not.toBeNull()
    // v1 key should be cleared
    expect(localStorage.getItem(STORAGE_KEY_V1)).toBeNull()
  })

  it('preserves user inputs during migration', () => {
    const legacy = makeLegacySite()
    localStorage.setItem(STORAGE_KEY_V1, JSON.stringify([legacy]))

    const loaded = loadSites()
    expect(loaded[0].inputs.name).toBe('Old Austin site')
    expect(loaded[0].inputs.acres).toBe('5')
    expect(loaded[0].inputs.roadFrontage).toBe('yes')
    expect(loaded[0].stateCode).toBe('TX')
  })

  it('is idempotent — loading twice does not re-migrate', () => {
    const legacy = makeLegacySite()
    localStorage.setItem(STORAGE_KEY_V1, JSON.stringify([legacy]))

    const first = loadSites()
    const second = loadSites()
    expect(second).toHaveLength(first.length)
    expect(second[0].id).toBe(first[0].id)
  })

  it('skips a single corrupt record instead of dropping the whole portfolio', () => {
    // A legacy-shaped record whose migration recompute will throw (null inputs).
    const corrupt = { id: 'bad', stateCode: 'TX', coordinates: { lat: 1, lng: 1 }, inputs: null, analysis: { metrics: { flood: {} } } }
    // A current v2 record (has a floodplain metric) that loads untouched.
    const healthy = { id: 'good', stateCode: 'TX', coordinates: { lat: 30, lng: -97 }, inputs: { name: 'Fine' }, analysis: { metrics: { floodplain: { score: 90 } } }, screeningArea: { kind: 'point' }, createdAt: '', updatedAt: '' }
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify([corrupt, healthy]))

    const loaded = loadSites()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('good')
  })

  it('returns an empty portfolio for malformed (non-array) stored data', () => {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify({ not: 'an array' }))
    expect(loadSites()).toEqual([])
  })

  it('clearSavedSites removes both storage keys', () => {
    localStorage.setItem(STORAGE_KEY_V2, '[]')
    localStorage.setItem(STORAGE_KEY_V1, '[]')
    clearSavedSites()
    expect(localStorage.getItem(STORAGE_KEY_V2)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY_V1)).toBeNull()
  })
})
