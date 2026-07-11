import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Bookmark, ChevronRight, FileText, Map, MapPin, Menu, Save, Scale, X } from 'lucide-react'
import { MapExplorer } from './components/MapExplorer'
const SavedSites = lazy(() => import('./components/SavedSites').then(m => ({ default: m.SavedSites })))
import { ScorePanel } from './components/ScorePanel'
import { SiteForm } from './components/SiteForm'
const SiteReport = lazy(() => import('./components/SiteReport').then(m => ({ default: m.SiteReport })))
import { fetchOfficialSiteData, OFFICIAL_SOURCE_COUNT, type OfficialSiteData } from './data/officialDataProvider'
import { fetchParcelAt, formatParcelAcres } from './data/parcelProvider'
import { fetchParcelOverlays, recomputeSetbackAndNetDevelopable, type ParcelOverlayData } from './data/parcelOverlayProvider'
import { jurisdictionSetbackStandards } from './data/jurisdictions/setbackStandards'
import { fetchRegionalHazards, type RegionalHazardData } from './data/regionalHazardProvider'
import { registerDefaultLocalAdapters } from './data/localAdapters'
import { getStateDefinition, stateDefinitions } from './data/states'
import { getCoverageTelemetry } from './data/coverageProvider'
import { screenBatch, type BatchScreeningResult, type BatchScreeningRow } from './data/batchScreening'
import { analyzeSite } from './lib/scoring'
import { loadSites, saveSites } from './lib/storage'
import { EMPTY_SITE_INPUTS, type BuildableEnvelopeSnapshot, type Coordinates, type ParcelSelection, type ParcelSnapshot, type SavedSite, type SiteAnalysis, type SiteInputs } from './types/site'
import './App.css'

type View = 'explorer' | 'saved' | 'report'
type PanelTab = 'details' | 'analysis'

const INITIAL_STATE_CODE = 'TX'
const INITIAL_STATE = getStateDefinition(INITIAL_STATE_CODE)
const INITIAL_COORDINATES: Coordinates = INITIAL_STATE.center

// Register verified local jurisdiction adapters (Travis County easements,
// etc.). Idempotent — safe to call once at module load.
registerDefaultLocalAdapters()

function snapshotParcel(parcel?: ParcelSelection): ParcelSnapshot | undefined {
  if (parcel?.status !== 'found' || !parcel.id) return undefined
  return { id: parcel.id, acres: parcel.acres, acreageKind: parcel.acreageKind, facts: parcel.facts, provenance: parcel.provenance }
}

function snapshotBuildableEnvelope(overlays?: ParcelOverlayData | null): BuildableEnvelopeSnapshot | undefined {
  const envelope = overlays?.buildableEnvelope.value
  if (!overlays?.buildableEnvelope.available || !envelope) return undefined
  return { ...envelope, provenance: overlays.buildableEnvelope.provenance }
}

function restoreParcel(site: SavedSite): ParcelSelection | undefined {
  if (!site.parcel) return undefined
  return {
    status: 'found', message: 'Saved official parcel snapshot; refreshing live source.',
    id: site.parcel.id, acres: site.parcel.acres, acreageKind: site.parcel.acreageKind,
    facts: site.parcel.facts, provenance: site.parcel.provenance,
    boundary: site.screeningArea?.kind === 'parcel' ? site.screeningArea.boundary : undefined,
  }
}

function App() {
  const [view, setView] = useState<View>('explorer')
  const [panelTab, setPanelTab] = useState<PanelTab>('analysis')
  const [activeStateCode, setActiveStateCode] = useState(INITIAL_STATE_CODE)
  const [coordinates, setCoordinates] = useState<Coordinates>(INITIAL_COORDINATES)
  const [inputs, setInputs] = useState<SiteInputs>({ ...EMPTY_SITE_INPUTS, location: INITIAL_STATE.name })
  const [analysis, setAnalysis] = useState<SiteAnalysis>(() => analyzeSite(INITIAL_COORDINATES, { ...EMPTY_SITE_INPUTS, location: INITIAL_STATE.name }))
  const [officialData, setOfficialData] = useState<OfficialSiteData>()
  const [overlays, setOverlays] = useState<ParcelOverlayData | null>(null)
  const [overlaysLoading, setOverlaysLoading] = useState(false)
  const [hazards, setHazards] = useState<RegionalHazardData | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(true)
  const [sourcesPending, setSourcesPending] = useState(OFFICIAL_SOURCE_COUNT)
  const [parcel, setParcel] = useState<ParcelSelection>()
  const [parcelLoading, setParcelLoading] = useState(true)
  const [sites, setSites] = useState<SavedSite[]>(loadSites)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [reportSite, setReportSite] = useState<SavedSite | null>(null)
  const [reportReturnView, setReportReturnView] = useState<'explorer' | 'saved'>('saved')
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const panelScrollRef = useRef<HTMLDivElement>(null)
  const inputsRef = useRef(inputs)
  const officialDataRef = useRef<OfficialSiteData | undefined>(undefined)
  const parcelRef = useRef<ParcelSelection | undefined>(undefined)
  const overlaysRef = useRef<ParcelOverlayData | null>(null)
  const hazardsRef = useRef<RegionalHazardData | null>(null)

  useEffect(() => {
    inputsRef.current = inputs
  }, [inputs])

  useEffect(() => {
    const controller = new AbortController()
    let current = true
    void fetchOfficialSiteData(coordinates, controller.signal, ({ data, pending }) => {
      if (!current) return
      officialDataRef.current = data
      setOfficialData(data)
      const nextAnalysis = analyzeSite(coordinates, inputsRef.current, data, parcelRef.current?.status === 'found', overlaysRef.current, hazardsRef.current, parcelRef.current)
      setAnalysis(nextAnalysis)
      setSourcesPending(pending.length)
      if (nextAnalysis.scoredWeight >= 50 || pending.length === 0) setAnalysisLoading(false)
    }, activeStateCode).then((data) => {
      if (!current) return
      officialDataRef.current = data
      setOfficialData(data)
      setAnalysis(analyzeSite(coordinates, inputsRef.current, data, parcelRef.current?.status === 'found', overlaysRef.current, hazardsRef.current, parcelRef.current))
      setSourcesPending(0)
      setAnalysisLoading(false)
    }).catch(() => {
      if (!current) return
      setAnalysis(analyzeSite(coordinates, inputsRef.current))
      setSourcesPending(0)
      setAnalysisLoading(false)
    })
    return () => {
      current = false
      controller.abort()
    }
  }, [coordinates, activeStateCode])

  useEffect(() => {
    const controller = new AbortController()
    let current = true
    void fetchParcelAt(coordinates, activeStateCode, controller.signal).then((result) => {
      if (!current) return
      parcelRef.current = result
      setParcel(result)
      setParcelLoading(false)

      // Reset overlays when the parcel is not found so stale overlay data
      // doesn't persist across coordinate changes.
      if (result.status !== 'found') {
        overlaysRef.current = null
    hazardsRef.current = null
        setOverlays(null)
    setHazards(null)
        setOverlaysLoading(false)
      } else {
        setOverlaysLoading(true)
      }

      const currentInputs = inputsRef.current
      const nextInputs = { ...currentInputs }
      let changed = false
      if (result.status === 'found' && result.name && !currentInputs.name.trim()) {
        nextInputs.name = result.name
        changed = true
      }
      if (result.status === 'found' && result.acres && !currentInputs.acres) {
        nextInputs.acres = formatParcelAcres(result.acres)
        changed = true
      }
      if (changed) {
        inputsRef.current = nextInputs
        setInputs(nextInputs)
      }
      setAnalysis(analyzeSite(coordinates, changed ? nextInputs : currentInputs, officialDataRef.current, result.status === 'found', overlaysRef.current, hazardsRef.current, result))
    }).catch(() => {
      if (!current) return
      const result: ParcelSelection = { status: 'error', message: 'Parcel lookup was interrupted or unavailable.' }
      parcelRef.current = result
      setParcel(result)
      setParcelLoading(false)
    })
    return () => {
      current = false
      controller.abort()
    }
  }, [activeStateCode, coordinates])

  // Fetch parcel-wide overlays when a parcel boundary is available.
  const parcelBoundary = parcel?.status === 'found' ? parcel.boundary : undefined
  useEffect(() => {
    if (!parcelBoundary) return
    const controller = new AbortController()
    let current = true
    void fetchParcelOverlays(parcelBoundary, controller.signal, ({ data }) => {
      if (!current) return
      overlaysRef.current = data
      setOverlays(data)
      setAnalysis(analyzeSite(coordinates, inputsRef.current, officialDataRef.current, true, data, hazardsRef.current, parcelRef.current))
    }, activeStateCode, coordinates).then((data) => {
      if (!current) return
      overlaysRef.current = data
      setOverlays(data)
      setOverlaysLoading(false)
      setAnalysis(analyzeSite(coordinates, inputsRef.current, officialDataRef.current, true, data, hazardsRef.current, parcelRef.current))
    }).catch(() => {
      if (!current) return
      setOverlaysLoading(false)
    })
    return () => {
      current = false
      controller.abort()
    }
  }, [coordinates, parcelBoundary, activeStateCode])

  const jurisdictionProfile = officialData?.zoning?.value?.profile

  // Recompute setbacks and net developable acreage when the intended use or
  // local zoning profile changes. Registered jurisdiction standards replace
  // generic defaults only when the local pack marks them as applicable.
  useEffect(() => {
    if (!parcelBoundary || !overlaysRef.current) return
    const updated = recomputeSetbackAndNetDevelopable(
      overlaysRef.current,
      parcelBoundary,
      inputs.intendedUse,
      coordinates,
      jurisdictionSetbackStandards(jurisdictionProfile),
    )
    overlaysRef.current = updated
    setOverlays(updated)
    setAnalysis(analyzeSite(coordinates, inputsRef.current, officialDataRef.current, true, updated, hazardsRef.current, parcelRef.current))
  }, [inputs.intendedUse, parcelBoundary, coordinates, jurisdictionProfile])

  // Fetch regional hazards (sea-level rise, wildfire, radon) alongside official data.
  useEffect(() => {
    const controller = new AbortController()
    let current = true
    void fetchRegionalHazards(coordinates, controller.signal).then((data) => {
      if (!current) return
      hazardsRef.current = data
      setHazards(data)
      setAnalysis(analyzeSite(coordinates, inputsRef.current, officialDataRef.current, parcelRef.current?.status === 'found', overlaysRef.current, data, parcelRef.current))
    }).catch(() => {
      if (!current) return
    })
    return () => {
      current = false
      controller.abort()
    }
  }, [coordinates])

  useEffect(() => {
    // Each tab is its own document. Never strand a newly opened tab at the
    // scroll position of the previous one.
    if (panelScrollRef.current) panelScrollRef.current.scrollTop = 0
  }, [panelTab])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  function selectCoordinates(next: Coordinates, nextStateCode = activeStateCode) {
    const state = getStateDefinition(nextStateCode)
    const nextInputs = { ...EMPTY_SITE_INPUTS, location: state.name }
    setActiveStateCode(state.code)
    setCoordinates(next)
    setInputs(nextInputs)
    inputsRef.current = nextInputs
    officialDataRef.current = undefined
    parcelRef.current = undefined
    overlaysRef.current = null
    hazardsRef.current = null
    setOfficialData(undefined)
    setParcel(undefined)
    setOverlays(null)
    setHazards(null)
    setOverlaysLoading(false)
    setParcelLoading(true)
    setAnalysisLoading(true)
    setSourcesPending(OFFICIAL_SOURCE_COUNT)
    setAnalysis(analyzeSite(next, nextInputs))
    setCurrentId(null)
    setDirty(false)
    setPanelTab('analysis')
  }

  function setLocationLabel(label: string) {
    setInputs((current) => {
      const next = { ...current, location: label }
      inputsRef.current = next
      return next
    })
  }

  function updateInputs(next: SiteInputs) {
    setInputs(next)
    inputsRef.current = next
    setDirty(true)
  }

  function runAnalysis() {
    setAnalysis(analyzeSite(coordinates, inputs, officialData, parcel?.status === 'found', overlays, hazards, parcel))
    setDirty(false)
    setPanelTab('analysis')
  }

  function changeState(code: string) {
    const state = getStateDefinition(code)
    const nextInputs = { ...EMPTY_SITE_INPUTS, location: state.name }
    setActiveStateCode(state.code)
    setCoordinates(state.center)
    setInputs(nextInputs)
    inputsRef.current = nextInputs
    officialDataRef.current = undefined
    parcelRef.current = undefined
    overlaysRef.current = null
    hazardsRef.current = null
    setOfficialData(undefined)
    setParcel(undefined)
    setOverlays(null)
    setHazards(null)
    setOverlaysLoading(false)
    setParcelLoading(true)
    setAnalysisLoading(true)
    setSourcesPending(OFFICIAL_SOURCE_COUNT)
    setAnalysis(analyzeSite(state.center, nextInputs))
    setCurrentId(null)
    setDirty(false)
    setPanelTab('analysis')
    setView('explorer')
    setMobileMenu(false)
  }

  function persistSites(next: SavedSite[]) {
    setSites(next)
    saveSites(next)
  }

  function saveCurrentSite() {
    const state = getStateDefinition(activeStateCode)
    const existingSite = sites.find((site) => site.id === currentId)
    const finalInputs = { ...inputs, name: inputs.name.trim() || `${state.name} site ${coordinates.lat.toFixed(3)}, ${coordinates.lng.toFixed(3)}` }
    const finalAnalysis = analyzeSite(coordinates, finalInputs, officialData, parcel?.status === 'found', overlays, hazards, parcel)
    const screeningArea = parcel?.status === 'found' && parcel.boundary
      ? { kind: 'parcel' as const, provider: parcel.provenance?.source, boundary: parcel.boundary }
      : existingSite?.screeningArea ?? { kind: 'point' as const }
    const now = new Date().toISOString()
    const parcelSnapshot = snapshotParcel(parcel) ?? existingSite?.parcel
    const jurisdiction = jurisdictionProfile ?? existingSite?.jurisdiction
    const authority = officialData?.authority.available ? officialData.authority.value : existingSite?.authority
    const buildableEnvelope = snapshotBuildableEnvelope(overlays) ?? existingSite?.buildableEnvelope
    if (currentId) {
      const next = sites.map((site) => site.id === currentId ? { ...site, stateCode: activeStateCode, inputs: finalInputs, coordinates, analysis: finalAnalysis, screeningArea, parcel: parcelSnapshot, authority, jurisdiction, buildableEnvelope, updatedAt: now } : site)
      persistSites(next)
    } else {
      const saved: SavedSite = { id: crypto.randomUUID(), stateCode: activeStateCode, inputs: finalInputs, coordinates, analysis: finalAnalysis, screeningArea, parcel: parcelSnapshot, authority, jurisdiction, buildableEnvelope, createdAt: now, updatedAt: now }
      persistSites([saved, ...sites])
      setCurrentId(saved.id)
    }
    setInputs(finalInputs)
    inputsRef.current = finalInputs
    setAnalysis(finalAnalysis)
    setDirty(false)
    notify('Site saved to this browser')
  }

  function openSite(site: SavedSite) {
    const restoredParcel = restoreParcel(site)
    setActiveStateCode(site.stateCode)
    setCoordinates(site.coordinates)
    setInputs(site.inputs)
    inputsRef.current = site.inputs
    officialDataRef.current = undefined
    parcelRef.current = restoredParcel
    overlaysRef.current = null
    hazardsRef.current = null
    setOfficialData(undefined)
    setParcel(restoredParcel)
    setOverlays(null)
    setHazards(null)
    setOverlaysLoading(false)
    setParcelLoading(true)
    setAnalysisLoading(true)
    setSourcesPending(OFFICIAL_SOURCE_COUNT)
    setAnalysis(site.analysis)
    setCurrentId(site.id)
    setDirty(false)
    setPanelTab('analysis')
    setView('explorer')
    setMobileMenu(false)
  }

  function showReport(site: SavedSite, returnView: 'explorer' | 'saved' = 'saved') {
    setReportSite(site)
    setReportReturnView(returnView)
    setView('report')
  }

  function reportCurrent() {
    const existingSite = sites.find((site) => site.id === currentId)
    const parcelSnapshot = snapshotParcel(parcel) ?? existingSite?.parcel
    const site: SavedSite = {
      id: currentId ?? 'preview', stateCode: activeStateCode, coordinates, inputs,
      analysis: dirty ? analyzeSite(coordinates, inputs, officialData, parcel?.status === 'found', overlays, hazards, parcel) : analysis,
      screeningArea: parcel?.status === 'found' && parcel.boundary
        ? { kind: 'parcel', provider: parcel.provenance?.source, boundary: parcel.boundary }
        : existingSite?.screeningArea ?? { kind: 'point' },
      parcel: parcelSnapshot,
      authority: officialData?.authority.available ? officialData.authority.value : existingSite?.authority,
      jurisdiction: jurisdictionProfile ?? existingSite?.jurisdiction,
      buildableEnvelope: snapshotBuildableEnvelope(overlays) ?? existingSite?.buildableEnvelope,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    showReport(site, 'explorer')
  }

  function deleteSite(id: string) {
    const site = sites.find((item) => item.id === id)
    if (!site || !window.confirm(`Delete “${site.inputs.name || 'Untitled site'}” from this browser?`)) return
    persistSites(sites.filter((item) => item.id !== id))
    if (currentId === id) setCurrentId(null)
    notify('Site deleted')
  }

  async function importBatch(rows: BatchScreeningRow[], onProgress: (completed: number, total: number) => void): Promise<BatchScreeningResult[]> {
    const results = await screenBatch(rows, (completed, total) => onProgress(completed, total))
    const imported = results.flatMap((result) => result.site ? [result.site] : [])
    if (imported.length) persistSites([...imported, ...sites])
    notify(`${imported.length} batch site${imported.length === 1 ? '' : 's'} saved${results.length > imported.length ? ` · ${results.length - imported.length} failed` : ''}`)
    return results
  }

  function navigate(next: View) {
    setView(next)
    setMobileMenu(false)
  }

  if (view === 'saved') return <AppFrame stateCode={activeStateCode} sitesCount={sites.length} active={view} mobileMenu={mobileMenu} setMobileMenu={setMobileMenu} onNavigate={navigate} onStateChange={changeState}><Suspense fallback={<div className="lazy-loading">Loading…</div>}><SavedSites sites={sites} onOpen={openSite} onReport={showReport} onDelete={deleteSite} onExplore={() => navigate('explorer')} onImportBatch={importBatch} /></Suspense>{toast && <Toast message={toast} />}</AppFrame>
  if (view === 'report' && reportSite) return <AppFrame stateCode={activeStateCode} sitesCount={sites.length} active={view} mobileMenu={mobileMenu} setMobileMenu={setMobileMenu} onNavigate={navigate} onStateChange={changeState}><Suspense fallback={<div className="lazy-loading">Loading…</div>}><SiteReport site={reportSite} onBack={() => navigate(reportReturnView)} /></Suspense></AppFrame>

  return (
    <AppFrame stateCode={activeStateCode} sitesCount={sites.length} active={view} mobileMenu={mobileMenu} setMobileMenu={setMobileMenu} onNavigate={navigate} onStateChange={changeState}>
      <main className="explorer-layout">
        <div className="map-column">
          <MapExplorer key={activeStateCode} stateCode={activeStateCode} coordinates={coordinates} parcel={parcel} parcelLoading={parcelLoading} overlays={overlays} onSelect={selectCoordinates} onLocationLabel={setLocationLabel} />
          <div className="map-site-strip">
            <div className="selected-coordinate-icon"><MapPin size={18} /></div>
            <div><span>Selected site</span><strong>{inputs.name || `Unnamed ${getStateDefinition(activeStateCode).name} location`}</strong><small className={`parcel-summary ${parcel?.status || 'loading'}`}>{parcelLoading ? 'Finding parcel boundary…' : parcel?.status === 'found' ? `${parcel.acres ? `${formatParcelAcres(parcel.acres)} acres · ` : ''}official parcel matched` : parcel?.message || 'Parcel boundary unavailable'}</small></div>
            <div className="coordinates"><span>LAT</span>{coordinates.lat.toFixed(6)}</div>
            <div className="coordinates"><span>LNG</span>{coordinates.lng.toFixed(6)}</div>
            <button onClick={() => setPanelTab('details')}>Edit details <ChevronRight size={15} /></button>
          </div>
        </div>

        <aside className="site-panel">
          <div className="panel-tabs" role="tablist">
            <button className={panelTab === 'analysis' ? 'active' : ''} onClick={() => setPanelTab('analysis')}><span>1</span> Analysis <em>{analysisLoading ? '…' : (analysis.finalScore ?? '—')}</em></button>
            <button className={panelTab === 'details' ? 'active' : ''} onClick={() => setPanelTab('details')}><span>2</span> Site inputs</button>
          </div>
          <div className="panel-scroll" ref={panelScrollRef} tabIndex={0} aria-label={panelTab === 'details' ? 'Site inputs' : 'Site analysis'}>
            {panelTab === 'details' ? <SiteForm inputs={inputs} parcel={parcel} jurisdiction={jurisdictionProfile} authority={officialData?.authority.value} coverage={getCoverageTelemetry(coordinates, activeStateCode)} nationalContext={analysis.nationalContext} onChange={updateInputs} onAnalyze={runAnalysis} dirty={dirty} /> : <ScorePanel analysis={analysis} dirty={dirty} loading={analysisLoading} pendingSources={sourcesPending} fetchedAt={officialData?.fetchedAt} parcelOverlaysLoading={overlaysLoading} hazards={hazards} />}
          </div>
          <div className="panel-actions">
            <button className="secondary-button" onClick={reportCurrent}><FileText size={17} /> Report</button>
            <button className="primary-button" onClick={saveCurrentSite}><Save size={17} /> {currentId ? 'Update saved site' : 'Save site'}</button>
          </div>
        </aside>
      </main>
      {toast && <Toast message={toast} />}
    </AppFrame>
  )
}

function AppFrame({ children, stateCode, sitesCount, active, onNavigate, onStateChange, mobileMenu, setMobileMenu }: {
  children: React.ReactNode
  stateCode: string
  sitesCount: number
  active: View
  onNavigate: (view: View) => void
  onStateChange: (stateCode: string) => void
  mobileMenu: boolean
  setMobileMenu: (open: boolean) => void
}) {
  return (
    <div className="app-frame">
      <header className="app-header no-print">
        <button className="brand" onClick={() => onNavigate('explorer')}><span className="brand-icon"><MapPin size={20} /></span><span>Land<strong>Lens</strong></span></button>
        <label className="state-picker"><span>State</span><select aria-label="Active state" value={stateCode} onChange={(event) => onStateChange(event.target.value)}>{stateDefinitions.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}</select></label>
        <nav className={mobileMenu ? 'open' : ''}>
          <button className={active === 'explorer' ? 'active' : ''} onClick={() => onNavigate('explorer')}><Map size={17} /> Map explorer</button>
          <button className={active === 'saved' ? 'active' : ''} onClick={() => onNavigate('saved')}><Scale size={17} /> Compare sites <span>{sitesCount}</span></button>
          <button className={active === 'report' ? 'active' : ''} onClick={() => onNavigate('saved')}><FileText size={17} /> Reports</button>
        </nav>
        <div className="header-disclaimer"><Bookmark size={15} /> Preliminary screening only</div>
        <button className="mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu ? <X /> : <Menu />}</button>
      </header>
      {children}
    </div>
  )
}

function Toast({ message }: { message: string }) {
  return <div className="toast" role="status"><span>✓</span>{message}</div>
}

export default App
