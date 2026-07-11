import type { ParcelFacts } from '../types/site'

export type ParcelTextRule = string[] | { join: string[] }
export type ParcelNumberRule = string[] | { sum: string[] }

export interface ParcelFactsFieldMap {
  situsAddress?: ParcelTextRule
  county?: ParcelTextRule
  municipality?: ParcelTextRule
  propertyUseCode?: ParcelTextRule
  propertyUseDescription?: ParcelTextRule
  propertyClass?: ParcelTextRule
  landStatus?: ParcelTextRule
  planningAreaDescription?: ParcelTextRule
  zoning?: ParcelTextRule
  zoningConditions?: ParcelTextRule
  legalDescription?: ParcelTextRule
  subdivision?: ParcelTextRule
  deedReference?: ParcelTextRule
  platReference?: ParcelTextRule
  recordedDate?: ParcelTextRule
  marketValue?: ParcelNumberRule
  marketLandValue?: ParcelNumberRule
  marketImprovementValue?: ParcelNumberRule
  appraisedValue?: ParcelNumberRule
  appraisedLandValue?: ParcelNumberRule
  appraisedImprovementValue?: ParcelNumberRule
  assessedTotalValue?: ParcelNumberRule
  assessedLandValue?: ParcelNumberRule
  assessedImprovementValue?: ParcelNumberRule
  assessedOtherValue?: ParcelNumberRule
  taxableValue?: ParcelNumberRule
  taxAmount?: ParcelNumberRule
  lastSalePrice?: ParcelNumberRule
  lastSaleDate?: ParcelTextRule
  saleQualification?: ParcelTextRule
  lastSaleYear?: string[]
  lastSaleMonth?: string[]
  taxYear?: ParcelTextRule
  yearBuilt?: ParcelNumberRule
  effectiveYearBuilt?: ParcelNumberRule
  buildingDescription?: ParcelTextRule
  buildingQuality?: ParcelTextRule
  buildingCount?: ParcelNumberRule
  buildingAreaSqFt?: ParcelNumberRule
  livingAreaSqFt?: ParcelNumberRule
  lotAreaSqFt?: ParcelNumberRule
  garageAreaSqFt?: ParcelNumberRule
  carportAreaSqFt?: ParcelNumberRule
  stories?: ParcelNumberRule
  unitCount?: ParcelNumberRule
  roomCount?: ParcelNumberRule
  bedroomCount?: ParcelNumberRule
  bathroomCount?: ParcelNumberRule
  halfBathroomCount?: ParcelNumberRule
  fireplaceCount?: ParcelNumberRule
  poolDescription?: ParcelTextRule
  frontageFeet?: ParcelNumberRule
  depthFeet?: ParcelNumberRule
  waterService?: ParcelTextRule
  sewerService?: ParcelTextRule
  utilities?: ParcelTextRule
  accessDescription?: ParcelTextRule
  irrigationDescription?: ParcelTextRule
  waterfrontDescription?: ParcelTextRule
  permitDescription?: ParcelTextRule
  criticalAreaDescription?: ParcelTextRule
  percTestArea?: ParcelNumberRule
  agriculturalAcres?: ParcelNumberRule
  agriculturalPreservationAcres?: ParcelNumberRule
  croplandAcres?: ParcelNumberRule
  forestAcres?: ParcelNumberRule
  grazingAcres?: ParcelNumberRule
  irrigatedAcres?: ParcelNumberRule
  forestPercent?: ParcelNumberRule
  recordUrl?: ParcelTextRule
}

type Properties = Record<string, string | number | null>

function cleanText(value: string | number | null | undefined): string {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim()
  return clean && clean !== '0' && clean.toLowerCase() !== 'null' ? clean : ''
}

function textFromRule(properties: Properties, rule?: ParcelTextRule): string | undefined {
  if (!rule) return undefined
  if (!Array.isArray(rule)) {
    const parts = rule.join.map((field) => cleanText(properties[field])).filter(Boolean)
    return parts.length ? Array.from(new Set(parts)).join(' ') : undefined
  }
  for (const field of rule) {
    const value = cleanText(properties[field])
    if (value) return value
  }
  return undefined
}

function positiveNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[$,]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function numberFromRule(properties: Properties, rule?: ParcelNumberRule): number | undefined {
  if (!rule) return undefined
  if (!Array.isArray(rule)) {
    const values = rule.sum.map((field) => positiveNumber(properties[field])).filter((value): value is number => value !== undefined)
    return values.length ? values.reduce((total, value) => total + value, 0) : undefined
  }
  for (const field of rule) {
    const value = positiveNumber(properties[field])
    if (value !== undefined) return value
  }
  return undefined
}

function normalizeDate(value?: string): string | undefined {
  if (!value) return undefined
  const numeric = Number(value)
  const date = Number.isFinite(numeric) && numeric > 10_000_000_000 ? new Date(numeric) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
}

function saleDate(properties: Properties, map: ParcelFactsFieldMap): string | undefined {
  const direct = normalizeDate(textFromRule(properties, map.lastSaleDate))
  if (direct) return direct
  const year = map.lastSaleYear?.map((field) => positiveNumber(properties[field])).find((value) => value !== undefined)
  if (!year) return undefined
  const month = map.lastSaleMonth?.map((field) => positiveNumber(properties[field])).find((value) => value !== undefined)
  return `${Math.round(year)}-${String(Math.min(12, Math.max(1, Math.round(month || 1)))).padStart(2, '0')}`
}

function safeUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function getParcelFactFieldNames(map?: ParcelFactsFieldMap): string[] {
  if (!map) return []
  const fields = new Set<string>()
  for (const [key, rule] of Object.entries(map)) {
    if (!rule) continue
    if (key === 'lastSaleYear' || key === 'lastSaleMonth') {
      for (const field of rule as string[]) fields.add(field)
    } else if (Array.isArray(rule)) {
      for (const field of rule) fields.add(field)
    } else {
      for (const field of ('join' in rule ? rule.join : rule.sum)) fields.add(field)
    }
  }
  return [...fields]
}

export function normalizeParcelFacts(properties: Properties, map?: ParcelFactsFieldMap): ParcelFacts | undefined {
  if (!map) return undefined
  const facts: ParcelFacts = {
    situsAddress: textFromRule(properties, map.situsAddress),
    county: textFromRule(properties, map.county),
    municipality: textFromRule(properties, map.municipality),
    propertyUseCode: textFromRule(properties, map.propertyUseCode),
    propertyUseDescription: textFromRule(properties, map.propertyUseDescription),
    propertyClass: textFromRule(properties, map.propertyClass),
    landStatus: textFromRule(properties, map.landStatus),
    planningAreaDescription: textFromRule(properties, map.planningAreaDescription),
    zoning: textFromRule(properties, map.zoning),
    zoningConditions: textFromRule(properties, map.zoningConditions),
    legalDescription: textFromRule(properties, map.legalDescription),
    subdivision: textFromRule(properties, map.subdivision),
    deedReference: textFromRule(properties, map.deedReference),
    platReference: textFromRule(properties, map.platReference),
    recordedDate: normalizeDate(textFromRule(properties, map.recordedDate)),
    marketValue: numberFromRule(properties, map.marketValue),
    marketLandValue: numberFromRule(properties, map.marketLandValue),
    marketImprovementValue: numberFromRule(properties, map.marketImprovementValue),
    appraisedValue: numberFromRule(properties, map.appraisedValue),
    appraisedLandValue: numberFromRule(properties, map.appraisedLandValue),
    appraisedImprovementValue: numberFromRule(properties, map.appraisedImprovementValue),
    assessedTotalValue: numberFromRule(properties, map.assessedTotalValue),
    assessedLandValue: numberFromRule(properties, map.assessedLandValue),
    assessedImprovementValue: numberFromRule(properties, map.assessedImprovementValue),
    assessedOtherValue: numberFromRule(properties, map.assessedOtherValue),
    taxableValue: numberFromRule(properties, map.taxableValue),
    taxAmount: numberFromRule(properties, map.taxAmount),
    lastSalePrice: numberFromRule(properties, map.lastSalePrice),
    lastSaleDate: saleDate(properties, map),
    saleQualification: textFromRule(properties, map.saleQualification),
    taxYear: textFromRule(properties, map.taxYear),
    yearBuilt: numberFromRule(properties, map.yearBuilt),
    effectiveYearBuilt: numberFromRule(properties, map.effectiveYearBuilt),
    buildingDescription: textFromRule(properties, map.buildingDescription),
    buildingQuality: textFromRule(properties, map.buildingQuality),
    buildingCount: numberFromRule(properties, map.buildingCount),
    buildingAreaSqFt: numberFromRule(properties, map.buildingAreaSqFt),
    livingAreaSqFt: numberFromRule(properties, map.livingAreaSqFt),
    lotAreaSqFt: numberFromRule(properties, map.lotAreaSqFt),
    garageAreaSqFt: numberFromRule(properties, map.garageAreaSqFt),
    carportAreaSqFt: numberFromRule(properties, map.carportAreaSqFt),
    stories: numberFromRule(properties, map.stories),
    unitCount: numberFromRule(properties, map.unitCount),
    roomCount: numberFromRule(properties, map.roomCount),
    bedroomCount: numberFromRule(properties, map.bedroomCount),
    bathroomCount: numberFromRule(properties, map.bathroomCount),
    halfBathroomCount: numberFromRule(properties, map.halfBathroomCount),
    fireplaceCount: numberFromRule(properties, map.fireplaceCount),
    poolDescription: textFromRule(properties, map.poolDescription),
    frontageFeet: numberFromRule(properties, map.frontageFeet),
    depthFeet: numberFromRule(properties, map.depthFeet),
    waterService: textFromRule(properties, map.waterService),
    sewerService: textFromRule(properties, map.sewerService),
    utilities: textFromRule(properties, map.utilities),
    accessDescription: textFromRule(properties, map.accessDescription),
    irrigationDescription: textFromRule(properties, map.irrigationDescription),
    waterfrontDescription: textFromRule(properties, map.waterfrontDescription),
    permitDescription: textFromRule(properties, map.permitDescription),
    criticalAreaDescription: textFromRule(properties, map.criticalAreaDescription),
    percTestArea: numberFromRule(properties, map.percTestArea),
    agriculturalAcres: numberFromRule(properties, map.agriculturalAcres),
    agriculturalPreservationAcres: numberFromRule(properties, map.agriculturalPreservationAcres),
    croplandAcres: numberFromRule(properties, map.croplandAcres),
    forestAcres: numberFromRule(properties, map.forestAcres),
    grazingAcres: numberFromRule(properties, map.grazingAcres),
    irrigatedAcres: numberFromRule(properties, map.irrigatedAcres),
    forestPercent: numberFromRule(properties, map.forestPercent),
    recordUrl: safeUrl(textFromRule(properties, map.recordUrl)),
  }
  const compact = Object.fromEntries(Object.entries(facts).filter(([, value]) => value !== undefined && value !== '')) as ParcelFacts
  return Object.keys(compact).length ? compact : undefined
}
