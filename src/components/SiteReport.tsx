import { useEffect } from 'react'
import { ArrowLeft, CheckCircle2, CircleHelp, ClipboardCheck, FileDown, MapPin, OctagonAlert, Printer, TriangleAlert } from 'lucide-react'
import L from 'leaflet'
import { GeoJSON, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { getStateDefinition } from '../data/states'
import type { HardGate, SavedSite, ScreeningArea } from '../types/site'

const reportIcon = L.divIcon({ className: 'landlens-marker-wrap', html: '<div class="landlens-marker"><span></span></div>', iconSize: [38, 46], iconAnchor: [19, 43] })

const DILIGENCE_CHECKLIST: Array<{ title: string; detail: string }> = [
  { title: 'ALTA / boundary-topographic survey', detail: 'County parcel GIS is approximate and not survey-grade.' },
  { title: 'Title commitment & access easement review', detail: 'Parcel and road GIS do not prove deeded legal access or easement rights.' },
  { title: 'Zoning verification with local jurisdiction', detail: 'Confirm by-right use, setbacks, density, coverage, height, and overlays.' },
  { title: 'Wetland delineation (if NWI mapped or site is wet)', detail: 'NWI is not a regulatory or jurisdictional delineation.' },
  { title: 'Floodplain review & Elevation Certificate (if mapped)', detail: 'FEMA screening does not replace survey-grade topo or LOMA/LOMR review.' },
  { title: 'Utility will-serve / capacity letters', detail: 'EPA service-area boundaries may differ from actual service; served ≠ has capacity.' },
  { title: 'Geotechnical borings & perc testing', detail: 'NRCS soils are mapped interpretations, not borings or field perc tests.' },
  { title: 'Phase I ESA', detail: 'National EPA screens miss local/historic conditions; Phase I is the diligence standard.' },
  { title: 'Civil concept / stormwater outfall memo', detail: 'Slope alone does not prove drainage, outfall, or detention feasibility.' },
  { title: 'SHPO / historic / archaeology scoping (if indicated)', detail: 'National Register data are helpful; state and local inventories often matter more.' },
]

function ReportParcelViewport({ boundary }: { boundary?: ScreeningArea['boundary'] }) {
  const map = useMap()
  useEffect(() => {
    if (!boundary) return
    const bounds = L.geoJSON({ type: 'Feature', properties: {}, geometry: boundary } as GeoJSON.GeoJsonObject).getBounds()
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 17, animate: false })
  }, [boundary, map])
  return null
}

function GateRow({ gate }: { gate: HardGate }) {
  return <li><OctagonAlert size={14} /><div><strong>{gate.label}</strong><span>{gate.reason}</span></div></li>
}

export function SiteReport({ site, onBack }: { site: SavedSite; onBack: () => void }) {
  const { analysis, coordinates, inputs } = site
  const state = getStateDefinition(site.stateCode)
  const parcelBoundary = site.screeningArea?.kind === 'parcel' ? site.screeningArea.boundary : undefined
  const parcelFeature = parcelBoundary ? { type: 'Feature' as const, properties: {}, geometry: parcelBoundary } : undefined
  const triggeredGates = analysis.hardGates.filter((gate) => gate.triggered)
  return (
    <main className="report-page">
      <div className="report-toolbar no-print">
        <button className="text-button" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <div><span>Browser report</span><button className="secondary-button" onClick={() => window.print()}><Printer size={17} /> Print / save PDF</button></div>
      </div>
      <article className="report-sheet">
        <header className="report-header">
          <div className="brand-mark"><MapPin size={20} /><span>Land<strong>Lens</strong></span></div>
          <div><span>PRELIMINARY SITE SCREEN</span><p>Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
        </header>
        <section className="report-title">
          <div><span className="eyebrow">{state.name} site report</span><h1>{inputs.name || `Untitled ${state.name} site`}</h1><p>{inputs.location || 'Location description not entered'}</p><div className="coordinate-line"><MapPin size={15} /> {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}</div></div>
          <div className={`report-score ${analysis.verdictTone}`}><strong>{analysis.finalScore ?? '—'}</strong><span>{analysis.finalScore === null ? 'unscored' : '/ 100'}</span><em>{analysis.verdict}</em></div>
        </section>
        {analysis.gatedToManual && (
          <section className="report-gates">
            <div className="report-section-title"><span>!</span><div><h2>Hard gates — manual diligence required</h2><p>LandLens will not rank this site as a viable candidate until the gates below are cleared.</p></div></div>
            <ul className="gate-list">{triggeredGates.map((gate) => <GateRow key={gate.id} gate={gate} />)}</ul>
          </section>
        )}
        <section className="report-map">
          <MapContainer center={[coordinates.lat, coordinates.lng]} zoom={13} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} attributionControl>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {parcelFeature && <GeoJSON data={parcelFeature} style={{ color: '#d86b16', weight: 4, opacity: 1, fillColor: '#f59f45', fillOpacity: 0.22 }} interactive={false} />}
            <Marker position={[coordinates.lat, coordinates.lng]} icon={reportIcon} />
            <ReportParcelViewport boundary={parcelBoundary} />
          </MapContainer>
          <div className="report-map-label"><strong>{parcelBoundary ? 'Selected parcel' : 'Selected location'}</strong><span>{parcelBoundary ? `${inputs.acres || 'Unknown'} acres supplied by the parcel record; approximate boundary, not a survey.` : 'Map preview for orientation only. Parcel boundaries are not available.'}</span></div>
        </section>
        <section className="report-section">
          <div className="report-section-title"><span>01</span><div><h2>Score breakdown</h2><p>Each category contributes its listed weight to the final score. Unscored categories had no verified source.</p></div></div>
          <div className="report-metrics">
            {Object.values(analysis.metrics).map((metric) => <div key={metric.category}><div><span>{metric.label}</span><em>{metric.weight}% weight</em></div><strong>{metric.score ?? '—'}</strong><div className="metric-track"><i style={{ width: `${metric.score ?? 0}%` }} /></div><p>{metric.summary}</p></div>)}
          </div>
          {(analysis.regionalHazardModifier !== 0 || analysis.confidencePenalty !== 0) && (
            <p className="report-modifier-line">Raw weighted score {analysis.rawScore ?? '—'} · regional hazard {analysis.regionalHazardModifier === 0 ? 'n/a' : analysis.regionalHazardModifier} · confidence penalty −{analysis.confidencePenalty} · adjusted {analysis.finalScore}.</p>
          )}
        </section>
        <section className="report-section">
          <div className="report-section-title"><span>02</span><div><h2>Screening findings</h2><p>What looks promising, what needs attention, and what remains unknown.</p></div></div>
          <div className="report-findings">
            <Finding title="Strengths" icon={<CheckCircle2 />} items={analysis.strengths} tone="positive" />
            <Finding title="Red flags" icon={<TriangleAlert />} items={analysis.redFlags} tone="negative" />
            <Finding title="Unknowns" icon={<CircleHelp />} items={analysis.unknowns} tone="unknown" />
          </div>
        </section>
        <section className="report-section report-site-facts">
          <div className="report-section-title"><span>03</span><div><h2>Site facts supplied</h2><p>These entries have not been independently verified.</p></div></div>
          <dl>
            <div><dt>Acres</dt><dd>{inputs.acres || 'Unknown'}</dd></div><div><dt>Estimated price</dt><dd>{inputs.estimatedPrice ? `$${Number(inputs.estimatedPrice).toLocaleString()}` : 'Unknown'}</dd></div><div><dt>Intended use</dt><dd>{inputs.intendedUse.replace('-', ' ')}</dd></div><div><dt>Road frontage</dt><dd>{inputs.roadFrontage}</dd></div><div><dt>Utilities nearby</dt><dd>{inputs.utilitiesNearby}</dd></div><div><dt>Data confidence</dt><dd>{analysis.confidence}%</dd></div>
          </dl>
          <div className="report-notes"><div><strong>Zoning notes</strong><p>{inputs.zoningNotes || 'Zoning not verified.'}</p></div><div><strong>Personal notes</strong><p>{inputs.notes || 'No personal notes entered.'}</p></div></div>
        </section>
        <section className="report-section">
          <div className="report-section-title"><span>04</span><div><h2>Recommended manual diligence checklist</h2><p>The lowest-regret diligence package for any shortlisted parcel.</p></div></div>
          <ul className="diligence-checklist">
            {DILIGENCE_CHECKLIST.map((item) => <li key={item.title}><ClipboardCheck size={14} /><div><strong>{item.title}</strong><span>{item.detail}</span></div></li>)}
          </ul>
        </section>
        <section className="report-section">
          <div className="report-section-title"><span>05</span><div><h2>Recommended next research</h2><p>Resolve the highest-impact unknowns before making a land decision.</p></div></div>
          <ol className="next-steps">{analysis.nextSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>
        <footer className="report-footer"><FileDown size={18} /><p><strong>Important:</strong> This is a preliminary point-screening report based on public-source and user-supplied information. It is not a parcel-wide development, investment, engineering, environmental, legal, or zoning decision.</p></footer>
      </article>
    </main>
  )
}

function Finding({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: string[]; tone: string }) {
  return <div className={tone}><h3>{icon}{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>
}
