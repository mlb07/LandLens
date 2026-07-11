import { useRef, useState } from 'react'
import { ArrowLeft, BarChart3, Download, FileJson, FileText, FolderOpen, MapPin, Plus, Trash2, Upload } from 'lucide-react'
import type { MetricResult, SavedSite, ScoreCategory } from '../types/site'
import { parseBatchCsv, type BatchScreeningResult, type BatchScreeningRow } from '../data/batchScreening'
import { sitesToCsv, sitesToGeoJson } from '../data/siteExports'

const COMPARISON_COLUMNS: Array<{ category: ScoreCategory; short: string }> = [
  { category: 'zoning', short: 'Zoning' },
  { category: 'netDevelopable', short: 'Net ac' },
  { category: 'floodplain', short: 'Flood' },
  { category: 'wetlands', short: 'Wetland' },
  { category: 'slope', short: 'Slope' },
  { category: 'utilities', short: 'Utility' },
  { category: 'access', short: 'Access' },
  { category: 'market', short: 'Market' },
]

function metricOf(site: SavedSite, category: ScoreCategory): MetricResult | undefined {
  return site.analysis?.metrics?.[category]
}

function parcelValue(site: SavedSite): string {
  const facts = site.parcel?.facts
  const value = facts?.marketValue ?? facts?.appraisedValue ?? facts?.assessedTotalValue
  return value ? `$${Math.round(value).toLocaleString()}` : '—'
}

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function SavedSites({ sites, onOpen, onReport, onDelete, onExplore, onImportBatch }: {
  sites: SavedSite[]
  onOpen: (site: SavedSite) => void
  onReport: (site: SavedSite) => void
  onDelete: (id: string) => void
  onExplore: () => void
  onImportBatch: (rows: BatchScreeningRow[], onProgress: (completed: number, total: number) => void) => Promise<BatchScreeningResult[]>
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [batchStatus, setBatchStatus] = useState('')
  const [batchRunning, setBatchRunning] = useState(false)

  async function importCsv(file?: File) {
    if (!file) return
    setBatchRunning(true)
    setBatchStatus('Validating CSV…')
    try {
      const rows = parseBatchCsv(await file.text())
      setBatchStatus(`Screening 0 of ${rows.length} sites…`)
      const results = await onImportBatch(rows, (completed, total) => setBatchStatus(`Screening ${completed} of ${total} sites…`))
      const failures = results.filter((result) => result.error)
      setBatchStatus(failures.length
        ? `${results.length - failures.length} sites saved; ${failures.length} failed: ${failures.map((result) => `row ${result.row.rowNumber} (${result.error})`).join('; ')}`
        : `${results.length} sites screened and saved.`)
    } catch (error) {
      setBatchStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBatchRunning(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <main className="page-shell saved-page">
      <button className="text-button back-button" onClick={onExplore}><ArrowLeft size={16} /> Back to map</button>
      <div className="page-title-row">
        <div><div className="eyebrow"><BarChart3 size={14} /> Portfolio view</div><h1>Compare saved sites</h1><p>Use the same early-screening criteria to decide which sites deserve the next round of research.</p></div>
        <div className="saved-page-actions">
          <input ref={fileInput} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void importCsv(event.target.files?.[0])} />
          <button className="secondary-button" disabled={batchRunning} onClick={() => fileInput.current?.click()}><Upload size={17} /> {batchRunning ? 'Screening…' : 'Import batch CSV'}</button>
          <button className="primary-button" onClick={onExplore}><Plus size={18} /> Evaluate another site</button>
        </div>
      </div>

      <div className="batch-toolbar">
        <p><strong>Batch schema:</strong> name, latitude, longitude; optional intended_use, location, acres, estimated_price, notes. Up to 100 U.S. sites per run.</p>
        {batchStatus && <span role="status">{batchStatus}</span>}
      </div>

      {sites.length === 0 ? (
        <div className="empty-state"><FolderOpen size={32} /><h2>No saved sites yet</h2><p>Select a location in any state, enter what you know, and save the analysis to compare it here.</p><button className="primary-button" onClick={onExplore}>Open map explorer</button></div>
      ) : (
        <>
          <div className="table-caption"><strong>{sites.length} {sites.length === 1 ? 'site' : 'sites'}</strong><span>Your saved analyses appear here. Unscored categories show an em dash.</span></div>
          <div className="portfolio-export-actions">
            <button className="secondary-button" onClick={() => downloadText('landlens-sites.csv', sitesToCsv(sites), 'text/csv;charset=utf-8')}><Download size={16} /> Export CSV</button>
            <button className="secondary-button" onClick={() => downloadText('landlens-sites.geojson', JSON.stringify(sitesToGeoJson(sites), null, 2), 'application/geo+json')}><FileJson size={16} /> Export GeoJSON</button>
          </div>
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead><tr><th>Site</th>{COMPARISON_COLUMNS.map((col) => <th key={col.category}>{col.short}</th>)}<th>Score</th><th>Verdict</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.id}>
                    <td><button className="site-name-cell" onClick={() => onOpen(site)}><strong>{site.inputs.name || 'Untitled site'}</strong><span><MapPin size={12} />{site.inputs.location || `${site.coordinates.lat.toFixed(3)}, ${site.coordinates.lng.toFixed(3)}`}</span>{site.parcel?.facts && <em>{Object.keys(site.parcel.facts).filter((key) => key !== 'recordUrl').length} parcel facts</em>}</button></td>
                    {COMPARISON_COLUMNS.map((col) => {
                      const metric = metricOf(site, col.category)
                      return <td key={col.category}><MetricCell score={metric?.score ?? null} label={metric?.displayValue} /></td>
                    })}
                    <td><span className={`table-score ${site.analysis.verdictTone}`}>{site.analysis.finalScore ?? '—'}</span></td>
                    <td><span className={`verdict-pill ${site.analysis.verdictTone}`}>{site.analysis.verdict}</span></td>
                    <td><div className="table-actions"><button title="Open site" onClick={() => onOpen(site)}><FolderOpen size={16} /></button><button title="View report" onClick={() => onReport(site)}><FileText size={16} /></button><button title="Delete site" onClick={() => onDelete(site.id)}><Trash2 size={16} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="saved-card-list">
            {sites.map((site) => (
              <article className="saved-site-card" key={site.id}>
                <div><span className={`table-score ${site.analysis.verdictTone}`}>{site.analysis.finalScore ?? '—'}</span><div><h3>{site.inputs.name || 'Untitled site'}</h3><p>{site.inputs.location || `${site.coordinates.lat.toFixed(3)}, ${site.coordinates.lng.toFixed(3)}`}</p></div></div>
                <dl><div><dt>Acres</dt><dd>{site.inputs.acres || '—'}</dd></div><div><dt>Parcel value</dt><dd>{parcelValue(site)}</dd></div><div><dt>Verdict</dt><dd>{site.analysis.verdict}</dd></div></dl>
                <div className="card-actions"><button onClick={() => onOpen(site)}>Open</button><button onClick={() => onReport(site)}>Report</button><button className="danger" onClick={() => onDelete(site.id)}>Delete</button></div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  )
}

function scoreLabel(score: number | null) {
  return score === null ? 'Unavailable' : `${score}/100`
}

function MetricCell({ score, label }: { score: number | null; label?: string }) {
  const display = score === null ? '—' : (label && label.length <= 22 ? label : scoreLabel(score))
  return <span className={`metric-cell ${score !== null && score >= 70 ? 'good' : score !== null && score < 50 ? 'bad' : score === null ? 'unknown' : ''}`}><i />{display}</span>
}
