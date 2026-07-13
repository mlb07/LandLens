import type { ParcelFacts } from '../types/site'

// Land economics derived from the user's asking price and the parcel's usable
// acreage. Kept separate from feasibility scoring: price is the buyer's
// variable, not a property of the land, so it never feeds the score — it sits
// beside it as the decision metric ("is this a good deal for what you can
// actually build on?").

export interface PriceEconomics {
  totalPrice: number
  /** Acres the per-acre figure is divided by. */
  acres: number
  /** Whether `acres` is verified net-developable acreage or a gross placeholder. */
  acreBasis: 'net' | 'gross'
  pricePerAcre: number
  /** Best available assessor *land* value (improvements excluded), if any. */
  assessedLandValue?: number
  assessedLandBasis?: 'market' | 'appraised' | 'assessed'
  /** Asking price ÷ assessed land value. >1 = above assessed, <1 = below. */
  priceToAssessedRatio?: number
}

/** Parse a currency-ish string or number to a finite number, else null. */
function toNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

// Raw-land screening compares against the *land* component of value, not total
// value (which folds in any improvements). Prefer market → appraised → assessed.
export function assessedLandValueOf(
  facts?: ParcelFacts,
): { value: number; basis: 'market' | 'appraised' | 'assessed' } | null {
  if (!facts) return null
  const market = toNumber(facts.marketLandValue)
  if (market && market > 0) return { value: market, basis: 'market' }
  const appraised = toNumber(facts.appraisedLandValue)
  if (appraised && appraised > 0) return { value: appraised, basis: 'appraised' }
  const assessed = toNumber(facts.assessedLandValue)
  if (assessed && assessed > 0) return { value: assessed, basis: 'assessed' }
  return null
}

export function computePriceEconomics(params: {
  estimatedPrice?: string | number
  /** Verified net-developable acreage, when parcel overlays have run. */
  netAcres?: number
  /** Gross acreage placeholder, used only when net is unavailable. */
  grossAcres?: string | number
  facts?: ParcelFacts
}): PriceEconomics | null {
  const totalPrice = toNumber(params.estimatedPrice)
  if (!totalPrice || totalPrice <= 0) return null

  const net = typeof params.netAcres === 'number' && params.netAcres > 0 ? params.netAcres : null
  const gross = toNumber(params.grossAcres)
  const acres = net ?? (gross && gross > 0 ? gross : null)
  if (!acres) return null

  const assessed = assessedLandValueOf(params.facts)
  return {
    totalPrice,
    acres,
    acreBasis: net ? 'net' : 'gross',
    pricePerAcre: totalPrice / acres,
    assessedLandValue: assessed?.value,
    assessedLandBasis: assessed?.basis,
    priceToAssessedRatio: assessed ? totalPrice / assessed.value : undefined,
  }
}

/** Compact USD for display: $840, $18,400, $1.2M, $12M. */
export function formatUsd(value: number): string {
  const rounded = Math.round(value)
  if (Math.abs(rounded) >= 1_000_000) {
    const millions = rounded / 1_000_000
    return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`
  }
  return `$${rounded.toLocaleString('en-US')}`
}

/** "2.1×" for small ratios, "24×" once large enough that a decimal is noise. */
export function formatRatio(ratio: number): string {
  return `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}×`
}
