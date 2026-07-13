import { AlertOctagon, AlertTriangle, CheckCircle2, CircleHelp, Database, ExternalLink, LoaderCircle, MapPinned, Sparkles, Slash, TrendingUp, Waves, Flame, Atom, Landmark } from 'lucide-react'
import type { RegionalHazardData } from '../data/regionalHazardProvider'
import type { DataStatus, SiteAnalysis } from '../types/site'
import { buildScoreImprovements } from '../lib/scoring'
import { formatRatio, formatUsd, type PriceEconomics } from '../lib/valuation'

function StatusBadge({ status }: { status: DataStatus }) {
  const label = status === 'official' ? 'Official source' : status === 'mock' ? 'Legacy mock' : status === 'user' ? 'User supplied' : 'Unavailable'
  return <span className={`status-badge ${status}`}>{label}</span>
}

const HAZARD_ICONS: Record<string, React.ReactNode> = {
  seaLevelRise: <Waves size={14} />,
  wildfire: <Flame size={14} />,
  radon: <Atom size={14} />,
}
const HAZARD_LABELS: Record<string, string> = {
  seaLevelRise: 'Sea-level rise (NOAA)',
  wildfire: 'Wildfire risk (USFS)',
  radon: 'Radon zone (EPA)',
}

export function ScorePanel({ analysis, dirty, loading, pendingSources = 0, fetchedAt, parcelOverlaysLoading, hazards, priceEconomics }: { analysis: SiteAnalysis; dirty: boolean; loading?: boolean; pendingSources?: number; fetchedAt?: string; parcelOverlaysLoading?: boolean; hazards?: RegionalHazardData | null; priceEconomics?: PriceEconomics | null }) {
  if (loading) {
    return <div className="analysis-pending" role="status"><LoaderCircle className="spin" size={25} /><span className="eyebrow">Live source check</span><h2>Checking this location</h2><p>LandLens is querying 14 national and local sources: flood, elevation, roads, population, wetlands, soils, contamination, species, utilities, permits, stormwater, easements, zoning, and local utility service. No score will appear until enough verified evidence returns.</p></div>
  }
  const hasScore = analysis.finalScore !== null
  const hasParcelOverlays = analysis.metrics.floodplain.detail.includes('grid points') || analysis.metrics.netDevelopable.status === 'official'
  const usesLocalSetbacks = analysis.metrics.netDevelopable.detail.includes('mapped jurisdiction base-district distances')
  const improvements = hasScore ? buildScoreImprovements(analysis, hasParcelOverlays) : []
  return (
    <div className="score-panel">
      {pendingSources > 0 && <div className="analysis-updating"><LoaderCircle className="spin" size={14} /> Score ready · {pendingSources} {pendingSources === 1 ? 'source is' : 'sources are'} still updating</div>}
      {parcelOverlaysLoading && <div className="analysis-updating parcel-overlay-loading"><LoaderCircle className="spin" size={14} /> Running parcel-wide flood, wetland, slope, soils, stormwater, easement, EPA contamination, USFWS habitat & setback overlays…</div>}
      {dirty && <div className="stale-score"><AlertTriangle size={15} /> Inputs changed. Update the score to include them.</div>}
      <section className={`score-hero ${analysis.verdictTone}`}>
        <div className={`score-ring ${hasScore ? '' : 'unscored'}`} style={{ '--score': analysis.finalScore ?? 0 } as React.CSSProperties}>
          <div><strong>{analysis.finalScore ?? '—'}</strong><span>{hasScore ? '/ 100' : 'unscored'}</span></div>
        </div>
        <div className="score-hero-copy">
          <span className="eyebrow">Development feasibility</span>
          <h2>{analysis.verdict}</h2>
          <p>A preliminary signal for deciding whether this site deserves deeper research. On this scale 50 is an average parcel — 75+ is exceptional, verified land.</p>
        </div>
      </section>

      {priceEconomics && (
        <section className="valuation-card">
          <div className="valuation-primary">
            <span className="eyebrow"><Landmark size={12} /> Cost of buildable land</span>
            <strong>{formatUsd(priceEconomics.pricePerAcre)}</strong>
            <em>per {priceEconomics.acreBasis === 'net' ? 'net-developable' : 'gross'} acre</em>
          </div>
          <div className="valuation-meta">
            <div><span>Asking price</span><strong>{formatUsd(priceEconomics.totalPrice)}</strong></div>
            <div><span>Basis</span><strong>{priceEconomics.acres.toLocaleString('en-US', { maximumFractionDigits: 2 })} {priceEconomics.acreBasis === 'net' ? 'net' : 'gross'} ac</strong></div>
            {priceEconomics.priceToAssessedRatio !== undefined && (
              <div><span>vs. assessed land</span><strong className={priceEconomics.priceToAssessedRatio > 1 ? 'over' : 'under'}>{formatRatio(priceEconomics.priceToAssessedRatio)}</strong></div>
            )}
          </div>
          <p>
            {priceEconomics.acreBasis === 'gross'
              ? 'Gross-acre basis — run parcel overlays to price against net-developable acreage.'
              : 'Priced against verified net-developable acreage.'}
            {priceEconomics.priceToAssessedRatio !== undefined && ` Asking is ${formatRatio(priceEconomics.priceToAssessedRatio)} the ${priceEconomics.assessedLandBasis} assessor land value (a rough, not market, benchmark).`}
          </p>
        </section>
      )}

      {analysis.gatedToManual && (
        <section className="gate-banner">
          <div className="gate-banner-head"><AlertOctagon size={18} /><strong>Hard gate triggered</strong></div>
          <p>One or more conditions make this site unsafe to rank automatically. LandLens will not present this as a viable candidate until the gate is cleared by manual diligence.</p>
          <ul>
            {analysis.hardGates.filter((gate) => gate.triggered).map((gate) => (
              <li key={gate.id}><span>{gate.label}</span><em>{gate.reason}</em></li>
            ))}
          </ul>
        </section>
      )}

      <section className="confidence-card">
        <div className="confidence-title"><Database size={17} /><strong>{analysis.confidenceLabel}</strong><span>{analysis.confidence}%</span></div>
        <div className="confidence-track"><span style={{ width: `${analysis.confidence}%` }} /></div>
        <p>Confidence reflects how much site information is known. It is separate from the feasibility score.</p>
        {fetchedAt && <small>Official sources checked {new Date(fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</small>}
      </section>

      {hasScore && (analysis.confidencePenalty !== 0 || hazards?.available) && (
        <section className="modifier-card">
          {hazards?.available && hazards.hazards.map((hazard) => (
            <div className="modifier-row" key={hazard.type}>
              {HAZARD_ICONS[hazard.type] || <Slash size={14} />}
              <span>{HAZARD_LABELS[hazard.type] || hazard.type}</span>
              <strong className={hazard.penalty < 0 ? 'penalty-active' : ''}>{hazard.available ? (hazard.penalty < 0 ? hazard.level : 'clear') : 'n/a'}</strong>
            </div>
          ))}
          {!hazards?.available && (
            <div className="modifier-row"><Slash size={14} /><span>Regional hazards (weighted category)</span><strong>Unavailable</strong></div>
          )}
          <div className="modifier-row"><Database size={14} /><span>Confidence penalty (missing official data)</span><strong>−{analysis.confidencePenalty}</strong></div>
          <p>Raw weighted score {analysis.rawScore ?? '—'} → adjusted {analysis.finalScore}. Regional hazards contribute through the weighted hazards category, not a separate modifier.</p>
        </section>
      )}

      <div className="point-screen-note"><MapPinned size={16} /><div><strong>{hasParcelOverlays ? 'Parcel-wide overlays active' : 'Point screening'}</strong><span>{hasParcelOverlays ? `FEMA, NWI, slope, NRCS soils, USGS-3DEP stormwater drainage, local easements (where registered), EPA FRS contamination, USFWS critical habitat, and perimeter setbacks are computed across the full parcel boundary. Net developable acreage subtracts floodway, wetlands, steep slope, hydric/severe soils, mapped easements, and setbacks; contamination and critical habitat are hard gates (not land-use takeouts). ${usesLocalSetbacks ? 'Setbacks use mapped jurisdiction base-district values; verify superseding local controls.' : 'Setback distances are conservative US defaults by intended use — verify with the local zoning ordinance.'}` : 'Results describe the selected point and nearby terrain — not the full parcel. Parcel-wide overlays are the next accuracy step.'}</span></div></div>

      <div className="section-heading">
        <div><span className="eyebrow">Transparent scoring</span><h3>{hasScore ? `Why this site scored ${analysis.finalScore}` : 'Not enough verified evidence to score'}</h3></div>
        <span className="weight-total">{analysis.scoredWeight ?? 100}% evidence coverage</span>
      </div>
      <div className="metric-list">
        {Object.values(analysis.metrics).map((metric) => (
          <article className="metric-card" key={metric.category}>
            <div className="metric-top">
              <div><span className="metric-label">{metric.label} · {metric.weight}%</span><strong>{metric.displayValue}</strong></div>
              <div className={`metric-score ${metric.score === null ? 'unscored' : ''}`}>{metric.score ?? '—'}</div>
            </div>
            <div className={`metric-track ${metric.score === null ? 'unscored' : ''}`}><span className={metric.score !== null && metric.score >= 70 ? 'good' : metric.score !== null && metric.score < 50 ? 'bad' : ''} style={{ width: `${metric.score ?? 0}%` }} /></div>
            <p>{metric.summary}</p>
            <details><summary>What this means</summary><p>{metric.detail}</p>{metric.provenance && <div className="metric-source"><a href={metric.provenance.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={11} />{metric.provenance.source}</a>{metric.provenance.vintage && <span>{metric.provenance.vintage}</span>}{metric.provenance.coverageNote && <p>{metric.provenance.coverageNote}</p>}</div>}</details>
            <StatusBadge status={metric.status} />
          </article>
        ))}
      </div>

      {improvements.length > 0 && (
        <section className="improvements-card">
          <div className="section-heading">
            <div><span className="eyebrow">Highest-leverage diligence</span><h3>What could raise this score</h3></div>
          </div>
          <ul className="improvements-list">
            {improvements.map((item) => (
              <li key={item.id}>
                <div className="improvement-gain"><TrendingUp size={14} /> up to +{item.potentialGain}</div>
                <div><strong>{item.action}</strong><p>{item.detail}</p></div>
              </li>
            ))}
          </ul>
          <p className="improvements-footnote">Gains assume the verified evidence comes back clean or strong. Adverse findings lower the score instead — knowing that before spending diligence money is the point.</p>
        </section>
      )}

      <div className="insight-grid">
        <InsightCard icon={<CheckCircle2 />} title="Strengths" tone="positive" items={analysis.strengths} />
        <InsightCard icon={<AlertTriangle />} title="Red flags" tone="negative" items={analysis.redFlags} />
        <InsightCard icon={<CircleHelp />} title="Unknowns" tone="unknown" items={analysis.unknowns} />
      </div>
      <div className="screening-note"><Sparkles size={17} /><div><strong>Screening, not a decision</strong><p>LandLens helps prioritize research. It does not replace surveys, engineering, title, environmental, zoning, utility, market, or financial due diligence.</p></div></div>
    </div>
  )
}

function InsightCard({ icon, title, tone, items }: { icon: React.ReactNode; title: string; tone: string; items: string[] }) {
  return (
    <section className={`insight-card ${tone}`}>
      <h3>{icon}{title}<span>{items.length}</span></h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  )
}
