import { describe, expect, it } from 'vitest'
import { getParcelProviderContracts } from './parcelProvider'
import { getParcelFactFieldNames, normalizeParcelFacts, type ParcelFactsFieldMap } from './parcelFacts'

describe('parcel fact normalization', () => {
  const map: ParcelFactsFieldMap = {
    situsAddress: { join: ['NUMBER', 'STREET', 'UNIT'] },
    propertyUseCode: ['USE_CODE'],
    legalDescription: { join: ['LEGAL_1', 'LEGAL_2'] },
    marketValue: ['MARKET'],
    marketLandValue: ['MARKET_LAND'],
    appraisedImprovementValue: ['APPRAISED_IMPROVEMENT'],
    assessedLandValue: { sum: ['LAND_A', 'LAND_B'] },
    taxAmount: ['TAX_AMOUNT'],
    lastSalePrice: ['SALE_PRICE'],
    lastSaleYear: ['SALE_YEAR'],
    lastSaleMonth: ['SALE_MONTH'],
    yearBuilt: ['YEAR_BUILT'],
    unitCount: ['UNITS'],
    irrigationDescription: ['IRRIGATION'],
    forestPercent: ['FOREST_PCT'],
    recordUrl: ['RECORD_URL'],
  }

  it('joins text, sums split values, parses currency, and normalizes sale dates', () => {
    const facts = normalizeParcelFacts({
      NUMBER: '101', STREET: 'Main St', UNIT: 'Suite 4', USE_CODE: 'C2', LEGAL_1: 'Lot 7', LEGAL_2: 'Block A',
      MARKET: '$1,250,000', MARKET_LAND: 400_000, APPRAISED_IMPROVEMENT: 700_000, LAND_A: 200_000, LAND_B: '50,000', TAX_AMOUNT: 12_500,
      SALE_PRICE: '900000', SALE_YEAR: 2023, SALE_MONTH: 8, YEAR_BUILT: 1998, UNITS: 6, IRRIGATION: 'District', FOREST_PCT: 35,
      RECORD_URL: 'https://assessor.example.gov/parcel/1', OWNER_NAME: 'Excluded Owner',
    }, map)
    expect(facts).toEqual({
      situsAddress: '101 Main St Suite 4', propertyUseCode: 'C2', legalDescription: 'Lot 7 Block A', marketValue: 1_250_000,
      marketLandValue: 400_000, appraisedImprovementValue: 700_000, assessedLandValue: 250_000, taxAmount: 12_500,
      lastSalePrice: 900_000, lastSaleDate: '2023-08', yearBuilt: 1998, unitCount: 6, irrigationDescription: 'District', forestPercent: 35,
      recordUrl: 'https://assessor.example.gov/parcel/1',
    })
    expect(facts).not.toHaveProperty('ownerName')
  })

  it('normalizes ArcGIS epoch dates and rejects unsafe record links', () => {
    expect(normalizeParcelFacts({ SALE_DATE: 1_704_067_200_000, URL: 'javascript:alert(1)' }, { lastSaleDate: ['SALE_DATE'], recordUrl: ['URL'] }))
      .toEqual({ lastSaleDate: '2024-01-01' })
  })

  it('omits zero, blank, null, and non-numeric values instead of inventing facts', () => {
    expect(normalizeParcelFacts({ VALUE: 0, USE: 'null', YEAR: 'unknown' }, { marketValue: ['VALUE'], propertyUseCode: ['USE'], yearBuilt: ['YEAR'] })).toBeUndefined()
  })

  it('collects every field required by text, sum, and split-date rules', () => {
    expect(getParcelFactFieldNames(map)).toEqual(expect.arrayContaining(['NUMBER', 'STREET', 'UNIT', 'LAND_A', 'LAND_B', 'SALE_YEAR', 'SALE_MONTH']))
  })
})

describe('parcel provider contracts', () => {
  const richAdapters = getParcelProviderContracts().filter((contract) => contract.factFields.length > 0)

  it('audits all 58 adapters and enriches every source that publishes usable development facts', () => {
    const contracts = getParcelProviderContracts()
    expect(contracts).toHaveLength(58)
    expect(contracts.every((adapter) => ['enriched', 'audited-no-public-facts'].includes(adapter.factStatus))).toBe(true)
    expect(richAdapters).toHaveLength(57)
    expect(contracts.filter((adapter) => adapter.factStatus === 'audited-no-public-facts').map((adapter) => adapter.id)).toEqual(['kentucky-jefferson-county-parcels'])
  })

  it('requests every normalized fact field from its ArcGIS provider', () => {
    for (const adapter of richAdapters) {
      expect(adapter.factFields.length, adapter.id).toBeGreaterThanOrEqual(1)
      expect(adapter.factFields.every((field) => adapter.outFields.includes(field)), adapter.id).toBe(true)
    }
  })

  it('does not request owner or mailing fields for parcel enrichment', () => {
    for (const adapter of getParcelProviderContracts()) {
      expect(adapter.outFields.filter((field) => /owner|mail_addr|mailing|^taxpa(?:name|add|city|zip|sta)/i.test(field)), adapter.id).toEqual([])
    }
  })
})
