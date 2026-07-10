import { Database, ExternalLink } from 'lucide-react'
import type { DataProvenance, ParcelFacts } from '../types/site'

interface ParcelFactRow {
  key: keyof ParcelFacts | 'propertyUse' | 'lastSale'
  label: string
  value: string
  group: 'Record' | 'Valuation' | 'Improvements' | 'Services' | 'Land profile'
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const numeric = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function amount(value?: number): string | undefined {
  return value === undefined ? undefined : money.format(value)
}

function number(value?: number, suffix = ''): string | undefined {
  return value === undefined ? undefined : `${numeric.format(value)}${suffix}`
}

function sale(facts: ParcelFacts): string | undefined {
  if (!facts.lastSalePrice && !facts.lastSaleDate) return undefined
  return [amount(facts.lastSalePrice), facts.lastSaleDate].filter(Boolean).join(' · ')
}

function propertyUse(facts: ParcelFacts): string | undefined {
  const values = [facts.propertyUseDescription, facts.propertyUseCode].filter(Boolean)
  return values.length ? Array.from(new Set(values)).join(' · ') : undefined
}

function getParcelFactRows(facts?: ParcelFacts): ParcelFactRow[] {
  if (!facts) return []
  const candidates: Array<ParcelFactRow | undefined> = [
    facts.situsAddress ? { key: 'situsAddress', label: 'Situs address', value: facts.situsAddress, group: 'Record' } : undefined,
    facts.county ? { key: 'county', label: 'County', value: facts.county, group: 'Record' } : undefined,
    facts.municipality ? { key: 'municipality', label: 'Municipality', value: facts.municipality, group: 'Record' } : undefined,
    propertyUse(facts) ? { key: 'propertyUse', label: 'Property use', value: propertyUse(facts)!, group: 'Record' } : undefined,
    facts.propertyClass ? { key: 'propertyClass', label: 'Property class', value: facts.propertyClass, group: 'Record' } : undefined,
    facts.zoning ? { key: 'zoning', label: 'Zoning', value: facts.zoning, group: 'Record' } : undefined,
    facts.subdivision ? { key: 'subdivision', label: 'Subdivision', value: facts.subdivision, group: 'Record' } : undefined,
    facts.legalDescription ? { key: 'legalDescription', label: 'Legal description', value: facts.legalDescription, group: 'Record' } : undefined,
    facts.taxYear ? { key: 'taxYear', label: 'Tax / valuation year', value: facts.taxYear, group: 'Record' } : undefined,
    amount(facts.marketValue) ? { key: 'marketValue', label: 'Reported market value', value: amount(facts.marketValue)!, group: 'Valuation' } : undefined,
    amount(facts.appraisedValue) ? { key: 'appraisedValue', label: 'Appraised value', value: amount(facts.appraisedValue)!, group: 'Valuation' } : undefined,
    amount(facts.assessedTotalValue) ? { key: 'assessedTotalValue', label: 'Assessed value', value: amount(facts.assessedTotalValue)!, group: 'Valuation' } : undefined,
    amount(facts.assessedLandValue) ? { key: 'assessedLandValue', label: 'Land value', value: amount(facts.assessedLandValue)!, group: 'Valuation' } : undefined,
    amount(facts.assessedImprovementValue) ? { key: 'assessedImprovementValue', label: 'Improvement value', value: amount(facts.assessedImprovementValue)!, group: 'Valuation' } : undefined,
    amount(facts.taxableValue) ? { key: 'taxableValue', label: 'Taxable value', value: amount(facts.taxableValue)!, group: 'Valuation' } : undefined,
    sale(facts) ? { key: 'lastSale', label: 'Last recorded sale', value: sale(facts)!, group: 'Valuation' } : undefined,
    number(facts.yearBuilt) ? { key: 'yearBuilt', label: 'Year built', value: number(facts.yearBuilt)!, group: 'Improvements' } : undefined,
    facts.buildingDescription ? { key: 'buildingDescription', label: 'Building description', value: facts.buildingDescription, group: 'Improvements' } : undefined,
    number(facts.buildingCount) ? { key: 'buildingCount', label: 'Building count', value: number(facts.buildingCount)!, group: 'Improvements' } : undefined,
    number(facts.buildingAreaSqFt, ' sq ft') ? { key: 'buildingAreaSqFt', label: 'Building area', value: number(facts.buildingAreaSqFt, ' sq ft')!, group: 'Improvements' } : undefined,
    number(facts.livingAreaSqFt, ' sq ft') ? { key: 'livingAreaSqFt', label: 'Living area', value: number(facts.livingAreaSqFt, ' sq ft')!, group: 'Improvements' } : undefined,
    number(facts.frontageFeet, ' ft') ? { key: 'frontageFeet', label: 'Reported frontage', value: number(facts.frontageFeet, ' ft')!, group: 'Land profile' } : undefined,
    number(facts.depthFeet, ' ft') ? { key: 'depthFeet', label: 'Reported depth', value: number(facts.depthFeet, ' ft')!, group: 'Land profile' } : undefined,
    facts.waterService ? { key: 'waterService', label: 'Water service', value: facts.waterService, group: 'Services' } : undefined,
    facts.sewerService ? { key: 'sewerService', label: 'Sewer service', value: facts.sewerService, group: 'Services' } : undefined,
    facts.utilities ? { key: 'utilities', label: 'Utilities / access', value: facts.utilities, group: 'Services' } : undefined,
    facts.accessDescription ? { key: 'accessDescription', label: 'Recorded access', value: facts.accessDescription, group: 'Land profile' } : undefined,
    number(facts.agriculturalAcres, ' ac') ? { key: 'agriculturalAcres', label: 'Agricultural acres', value: number(facts.agriculturalAcres, ' ac')!, group: 'Land profile' } : undefined,
    number(facts.croplandAcres, ' ac') ? { key: 'croplandAcres', label: 'Cropland acres', value: number(facts.croplandAcres, ' ac')!, group: 'Land profile' } : undefined,
    number(facts.forestAcres, ' ac') ? { key: 'forestAcres', label: 'Forest acres', value: number(facts.forestAcres, ' ac')!, group: 'Land profile' } : undefined,
    number(facts.grazingAcres, ' ac') ? { key: 'grazingAcres', label: 'Grazing acres', value: number(facts.grazingAcres, ' ac')!, group: 'Land profile' } : undefined,
    number(facts.irrigatedAcres, ' ac') ? { key: 'irrigatedAcres', label: 'Irrigated acres', value: number(facts.irrigatedAcres, ' ac')!, group: 'Land profile' } : undefined,
  ]
  return candidates.filter((row): row is ParcelFactRow => row !== undefined)
}

export function ParcelFactsPanel({ facts, provenance, compact = false, showHeading = true }: { facts?: ParcelFacts; provenance?: DataProvenance; compact?: boolean; showHeading?: boolean }) {
  const allRows = getParcelFactRows(facts)
  if (!allRows.length) return null
  const rows = compact ? allRows.slice(0, 6) : allRows
  const groups = Array.from(new Set(rows.map((row) => row.group)))
  return (
    <section className={`parcel-facts-card ${compact ? 'compact' : ''}`}>
      {showHeading && <div className="parcel-facts-heading"><div><Database size={15} /><span>Official parcel facts</span><em>{allRows.length} fields</em></div><p>Public assessor/GIS attributes. Values can lag the current market and are not appraisals, title evidence, surveys, or utility commitments.</p></div>}
      {groups.map((group) => (
        <div className="parcel-facts-group" key={group}><h3>{group}</h3><dl>{rows.filter((row) => row.group === group).map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div>
      ))}
      <div className="parcel-facts-source">
        {facts?.recordUrl && <a href={facts.recordUrl} target="_blank" rel="noreferrer"><ExternalLink size={11} /> Open assessor record</a>}
        {provenance && <span>Source: {provenance.source}{provenance.vintage ? ` · ${provenance.vintage}` : ''}</span>}
      </div>
    </section>
  )
}
