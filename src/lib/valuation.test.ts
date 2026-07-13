import { describe, it, expect } from 'vitest'
import { assessedLandValueOf, computePriceEconomics, formatRatio, formatUsd } from './valuation'
import type { ParcelFacts } from '../types/site'

describe('computePriceEconomics', () => {
  it('uses net-developable acreage as the basis when available', () => {
    const result = computePriceEconomics({ estimatedPrice: '500000', netAcres: 9, grossAcres: '10' })
    expect(result).not.toBeNull()
    expect(result!.acreBasis).toBe('net')
    expect(result!.acres).toBe(9)
    expect(result!.pricePerAcre).toBeCloseTo(55_555.56, 1)
  })

  it('falls back to gross acreage when net is unavailable', () => {
    const result = computePriceEconomics({ estimatedPrice: '500000', grossAcres: '10' })
    expect(result!.acreBasis).toBe('gross')
    expect(result!.acres).toBe(10)
    expect(result!.pricePerAcre).toBe(50_000)
  })

  it('falls back to gross when net acreage is zero (fully constrained parcel)', () => {
    const result = computePriceEconomics({ estimatedPrice: '500000', netAcres: 0, grossAcres: '10' })
    expect(result!.acreBasis).toBe('gross')
    expect(result!.pricePerAcre).toBe(50_000)
  })

  it('parses currency-formatted price strings', () => {
    const result = computePriceEconomics({ estimatedPrice: '$1,200,000', grossAcres: '4' })
    expect(result!.totalPrice).toBe(1_200_000)
    expect(result!.pricePerAcre).toBe(300_000)
  })

  it('accepts numeric price and acreage', () => {
    const result = computePriceEconomics({ estimatedPrice: 250_000, netAcres: 5 })
    expect(result!.pricePerAcre).toBe(50_000)
  })

  it('returns null when no price is given', () => {
    expect(computePriceEconomics({ grossAcres: '10' })).toBeNull()
    expect(computePriceEconomics({ estimatedPrice: '', grossAcres: '10' })).toBeNull()
  })

  it('returns null for a non-positive price', () => {
    expect(computePriceEconomics({ estimatedPrice: '0', grossAcres: '10' })).toBeNull()
    expect(computePriceEconomics({ estimatedPrice: '-5000', grossAcres: '10' })).toBeNull()
  })

  it('returns null when no usable acreage is available', () => {
    expect(computePriceEconomics({ estimatedPrice: '500000' })).toBeNull()
    expect(computePriceEconomics({ estimatedPrice: '500000', grossAcres: '0' })).toBeNull()
    expect(computePriceEconomics({ estimatedPrice: '500000', grossAcres: 'abc' })).toBeNull()
  })

  it('computes the price-to-assessed-land ratio, preferring market land value', () => {
    const facts: ParcelFacts = { marketLandValue: 250_000, appraisedLandValue: 200_000, assessedLandValue: 100_000 }
    const result = computePriceEconomics({ estimatedPrice: '500000', grossAcres: '10', facts })
    expect(result!.assessedLandValue).toBe(250_000)
    expect(result!.assessedLandBasis).toBe('market')
    expect(result!.priceToAssessedRatio).toBe(2)
  })

  it('omits the assessed ratio when no land value is published', () => {
    const result = computePriceEconomics({ estimatedPrice: '500000', grossAcres: '10', facts: { situsAddress: '1 Main St' } })
    expect(result!.priceToAssessedRatio).toBeUndefined()
    expect(result!.assessedLandValue).toBeUndefined()
  })
})

describe('assessedLandValueOf', () => {
  it('prefers market, then appraised, then assessed land value', () => {
    expect(assessedLandValueOf({ appraisedLandValue: 200_000, assessedLandValue: 100_000 })?.basis).toBe('appraised')
    expect(assessedLandValueOf({ assessedLandValue: 100_000 })?.basis).toBe('assessed')
  })

  it('ignores zero and missing values', () => {
    expect(assessedLandValueOf({ marketLandValue: 0, assessedLandValue: 100_000 })?.basis).toBe('assessed')
    expect(assessedLandValueOf(undefined)).toBeNull()
    expect(assessedLandValueOf({})).toBeNull()
  })
})

describe('formatUsd', () => {
  it('formats thousands with separators and millions compactly', () => {
    expect(formatUsd(840)).toBe('$840')
    expect(formatUsd(18_400)).toBe('$18,400')
    expect(formatUsd(1_200_000)).toBe('$1.2M')
    expect(formatUsd(12_000_000)).toBe('$12M')
  })
})

describe('formatRatio', () => {
  it('keeps a decimal for small ratios and drops it once large', () => {
    expect(formatRatio(2.1)).toBe('2.1×')
    expect(formatRatio(0.8)).toBe('0.8×')
    expect(formatRatio(24.3)).toBe('24×')
  })
})
