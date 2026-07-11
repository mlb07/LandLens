import { describe, expect, it } from 'vitest'
import { parseBatchCsv } from './batchScreening'

describe('parseBatchCsv', () => {
  it('parses quoted fields and optional screening inputs', () => {
    const rows = parseBatchCsv('name,latitude,longitude,intended_use,location,estimated_price,notes\n"North, Tract",30.2672,-97.7431,mixed-use,"Austin, TX",1250000,"Needs ""fast"" review"')
    expect(rows).toEqual([expect.objectContaining({
      rowNumber: 2,
      name: 'North, Tract',
      latitude: 30.2672,
      longitude: -97.7431,
      intendedUse: 'mixed-use',
      estimatedPrice: '1250000',
      notes: 'Needs "fast" review',
    })])
  })

  it('defaults intended use and rejects coordinates outside valid ranges', () => {
    expect(parseBatchCsv('name,latitude,longitude\nSite A,35,-80')[0].intendedUse).toBe('other')
    expect(() => parseBatchCsv('name,latitude,longitude\nSite A,95,-80')).toThrow('Row 2: latitude')
  })

  it('requires the canonical headers and enforces the batch limit', () => {
    expect(() => parseBatchCsv('name,lat,longitude\nSite A,35,-80')).toThrow('Missing required CSV header: latitude')
    const records = Array.from({ length: 3 }, (_, index) => `Site ${index},35,-80`).join('\n')
    expect(() => parseBatchCsv(`name,latitude,longitude\n${records}`, 2)).toThrow('limited to 2 sites')
  })
})

