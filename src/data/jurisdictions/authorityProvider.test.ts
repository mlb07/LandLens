import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchJurisdictionAuthority } from './authorityProvider'

describe('Census national authority resolver', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('prefers incorporated place while retaining county context', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      result: {
        geographies: {
          'Incorporated Places': [{ NAME: 'Austin city', GEOID: '4805000' }],
          'County Subdivisions': [{ NAME: 'Austin CCD' }],
          Counties: [{ NAME: 'Travis County', GEOID: '48453' }],
          States: [{ NAME: 'Texas' }],
        },
      },
    }), { status: 200 })))
    const result = await fetchJurisdictionAuthority({ lat: 30.2672, lng: -97.7431 }, 'TX')
    expect(result.available).toBe(true)
    expect(result.value).toEqual(expect.objectContaining({
      authorityName: 'Austin city', authorityType: 'incorporated-place', countyName: 'Travis County', stateName: 'Texas', geoid: '4805000',
    }))
    expect(result.value?.coverageNote).toContain('does not establish zoning authority')
  })

  it('falls back to county geography without inventing a municipality', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      result: { geographies: { Counties: [{ NAME: 'Example County', GEOID: '99001' }] } },
    }), { status: 200 })))
    const result = await fetchJurisdictionAuthority({ lat: 40, lng: -100 }, 'NE')
    expect(result.value).toEqual(expect.objectContaining({ authorityName: 'Example County', authorityType: 'county' }))
    expect(result.value?.incorporatedPlace).toBeUndefined()
  })

  it('degrades honestly when Census returns no geography', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { geographies: {} } }), { status: 200 })))
    const result = await fetchJurisdictionAuthority({ lat: 0, lng: 0 }, 'XX')
    expect(result.available).toBe(false)
    expect(result.error).toContain('No Census authority geography')
  })
})
