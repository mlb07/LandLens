import { DatabaseZap, MapPinned, ShieldCheck } from 'lucide-react'
import type { CoverageTelemetry } from '../data/coverageProvider'

function parcelLabel(status: CoverageTelemetry['current']['parcelStatus']): string {
  if (status === 'verified-here') return 'Verified public parcel source covers this point'
  if (status === 'partial-state-gap') return 'This state has partial coverage, but no adapter covers this point'
  return 'No verified public parcel source covers this state'
}

export function CoveragePanel({ coverage }: { coverage: CoverageTelemetry }) {
  return (
    <section className="coverage-card" aria-label="LandLens data coverage">
      <div className="coverage-card-heading"><ShieldCheck size={15} /><strong>Coverage telemetry</strong><span>{coverage.national.stateCount}/50 states</span></div>
      <div className="coverage-grid">
        <div><MapPinned size={14} /><span>Selected point</span><strong>{parcelLabel(coverage.current.parcelStatus)}</strong></div>
        <div><DatabaseZap size={14} /><span>Parcel facts</span><strong>{coverage.current.richFacts ? 'Normalized public facts available' : 'Boundary-only or unavailable here'}</strong></div>
      </div>
      {coverage.current.parcelSources.length > 0 && <p>Parcel source: {coverage.current.parcelSources.join(' · ')}</p>}
      <p>{coverage.national.adapterCount} verified adapters · {coverage.national.enrichedAdapterCount} enriched · {coverage.national.auditedGeometryOnlyCount} audited geometry-only.</p>
      <p>{coverage.current.jurisdictionPacks.length > 0 ? `Local entitlement intelligence: ${coverage.current.jurisdictionPacks.join(' · ')}` : 'National screening is active; no local entitlement pack covers this point yet.'}</p>
    </section>
  )
}
