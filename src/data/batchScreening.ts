import { analyzeSite } from '../lib/scoring'
import { EMPTY_SITE_INPUTS, type IntendedUse, type SavedSite, type SiteInputs } from '../types/site'
import { jurisdictionSetbackStandards } from './jurisdictions/setbackStandards'
import { fetchOfficialSiteData } from './officialDataProvider'
import { fetchParcelOverlays, recomputeSetbackAndNetDevelopable } from './parcelOverlayProvider'
import { fetchParcelAt, formatParcelAcres } from './parcelProvider'
import { fetchRegionalHazards } from './regionalHazardProvider'
import { findStateForPoint } from './states'

export interface BatchScreeningRow {
  rowNumber: number
  name: string
  latitude: number
  longitude: number
  intendedUse: IntendedUse
  location?: string
  acres?: string
  estimatedPrice?: string
  notes?: string
}

export interface BatchScreeningResult {
  row: BatchScreeningRow
  site?: SavedSite
  error?: string
}

const REQUIRED_HEADERS = ['name', 'latitude', 'longitude'] as const
const ALLOWED_USES = new Set<IntendedUse>(['residential', 'commercial', 'mixed-use', 'industrial', 'other'])

function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  row.push(field)
  if (row.some((value) => value.length > 0)) rows.push(row)
  if (quoted) throw new Error('CSV contains an unterminated quoted field.')
  return rows
}

export function parseBatchCsv(text: string, maxRows = 100): BatchScreeningRow[] {
  const records = parseCsvRecords(text.replace(/^\uFEFF/, '')).filter((row) => row.some((value) => value.trim()))
  if (records.length < 2) throw new Error('CSV must include a header and at least one site row.')
  const headers = records[0].map((value) => value.trim().toLowerCase().replace(/[ -]+/g, '_'))
  for (const required of REQUIRED_HEADERS) if (!headers.includes(required)) throw new Error(`Missing required CSV header: ${required}.`)
  if (records.length - 1 > maxRows) throw new Error(`Batch files are limited to ${maxRows} sites per run.`)
  const value = (record: string[], key: string) => record[headers.indexOf(key)]?.trim() ?? ''

  return records.slice(1).map((record, index) => {
    const rowNumber = index + 2
    const latitude = Number(value(record, 'latitude'))
    const longitude = Number(value(record, 'longitude'))
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error(`Row ${rowNumber}: latitude must be between -90 and 90.`)
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error(`Row ${rowNumber}: longitude must be between -180 and 180.`)
    const intendedUseRaw = value(record, 'intended_use').toLowerCase() || 'other'
    if (!ALLOWED_USES.has(intendedUseRaw as IntendedUse)) throw new Error(`Row ${rowNumber}: intended_use must be residential, commercial, mixed-use, industrial, or other.`)
    const name = value(record, 'name')
    if (!name) throw new Error(`Row ${rowNumber}: name is required.`)
    return {
      rowNumber, name, latitude, longitude, intendedUse: intendedUseRaw as IntendedUse,
      location: value(record, 'location') || undefined,
      acres: value(record, 'acres') || undefined,
      estimatedPrice: value(record, 'estimated_price') || undefined,
      notes: value(record, 'notes') || undefined,
    }
  })
}

async function screenOne(row: BatchScreeningRow, signal?: AbortSignal): Promise<BatchScreeningResult> {
  try {
    if (signal?.aborted) throw new DOMException('Batch screening was cancelled.', 'AbortError')
    const coordinates = { lat: row.latitude, lng: row.longitude }
    const state = findStateForPoint(coordinates)
    if (!state) throw new Error('Coordinates are outside the supported U.S. state boundaries.')
    const [parcel, official, hazards] = await Promise.all([
      fetchParcelAt(coordinates, state.code, signal),
      fetchOfficialSiteData(coordinates, signal, undefined, state.code),
      fetchRegionalHazards(coordinates, signal),
    ])

    const inputs: SiteInputs = {
      ...EMPTY_SITE_INPUTS,
      name: row.name,
      location: row.location ?? `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`,
      acres: parcel.status === 'found' && parcel.acres ? formatParcelAcres(parcel.acres) : row.acres ?? '',
      estimatedPrice: row.estimatedPrice ?? '',
      intendedUse: row.intendedUse,
      notes: row.notes ?? '',
    }
    let overlays = parcel.status === 'found' && parcel.boundary
      ? await fetchParcelOverlays(parcel.boundary, signal, undefined, state.code, coordinates)
      : null
    const jurisdiction = official.zoning?.available ? official.zoning.value?.profile : undefined
    if (overlays && parcel.status === 'found' && parcel.boundary) {
      overlays = recomputeSetbackAndNetDevelopable(overlays, parcel.boundary, row.intendedUse, coordinates, jurisdictionSetbackStandards(jurisdiction))
    }
    const analysis = analyzeSite(coordinates, inputs, official, parcel.status === 'found', overlays, hazards, parcel)
    const now = new Date().toISOString()
    const site: SavedSite = {
      id: crypto.randomUUID(), stateCode: state.code, coordinates, inputs, analysis,
      screeningArea: parcel.status === 'found' && parcel.boundary
        ? { kind: 'parcel', provider: parcel.provenance?.source, boundary: parcel.boundary }
        : { kind: 'point' },
      parcel: parcel.status === 'found' && parcel.id
        ? { id: parcel.id, acres: parcel.acres, acreageKind: parcel.acreageKind, facts: parcel.facts, provenance: parcel.provenance }
        : undefined,
      authority: official.authority.available ? official.authority.value : undefined,
      jurisdiction,
      buildableEnvelope: overlays?.buildableEnvelope.available && overlays.buildableEnvelope.value
        ? { ...overlays.buildableEnvelope.value, provenance: overlays.buildableEnvelope.provenance }
        : undefined,
      createdAt: now, updatedAt: now,
    }
    return { row, site }
  } catch (error) {
    if (signal?.aborted) throw error
    return { row, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function screenBatch(
  rows: BatchScreeningRow[],
  onProgress?: (completed: number, total: number, result: BatchScreeningResult) => void,
  signal?: AbortSignal,
  concurrency = 2,
): Promise<BatchScreeningResult[]> {
  const results = new Array<BatchScreeningResult>(rows.length)
  let nextIndex = 0
  let completed = 0
  const worker = async () => {
    while (nextIndex < rows.length) {
      const index = nextIndex
      nextIndex += 1
      const result = await screenOne(rows[index], signal)
      results[index] = result
      completed += 1
      onProgress?.(completed, rows.length, result)
    }
  }
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), rows.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

// ---------- Re-screening saved sites ----------

export interface RescreenResult {
  id: string
  site?: SavedSite
  error?: string
}

// Re-run the full screening pipeline for a saved site, keeping the user's
// inputs, id, and creation date but refreshing every source and the analysis.
// Used to bring sites scored on an older scale up to the current one.
export async function rescreenSavedSite(saved: SavedSite, signal?: AbortSignal): Promise<SavedSite> {
  const coordinates = saved.coordinates
  const [parcel, official, hazards] = await Promise.all([
    fetchParcelAt(coordinates, saved.stateCode, signal),
    fetchOfficialSiteData(coordinates, signal, undefined, saved.stateCode),
    fetchRegionalHazards(coordinates, signal),
  ])
  let overlays = parcel.status === 'found' && parcel.boundary
    ? await fetchParcelOverlays(parcel.boundary, signal, undefined, saved.stateCode, coordinates)
    : null
  const jurisdiction = official.zoning?.available ? official.zoning.value?.profile : undefined
  if (overlays && parcel.status === 'found' && parcel.boundary) {
    overlays = recomputeSetbackAndNetDevelopable(overlays, parcel.boundary, saved.inputs.intendedUse, coordinates, jurisdictionSetbackStandards(jurisdiction))
  }
  const analysis = analyzeSite(coordinates, saved.inputs, official, parcel.status === 'found', overlays, hazards, parcel)
  return {
    ...saved,
    analysis,
    screeningArea: parcel.status === 'found' && parcel.boundary
      ? { kind: 'parcel', provider: parcel.provenance?.source, boundary: parcel.boundary }
      : saved.screeningArea,
    parcel: parcel.status === 'found' && parcel.id
      ? { id: parcel.id, acres: parcel.acres, acreageKind: parcel.acreageKind, facts: parcel.facts, provenance: parcel.provenance }
      : saved.parcel,
    authority: official.authority.available ? official.authority.value : saved.authority,
    jurisdiction: jurisdiction ?? saved.jurisdiction,
    buildableEnvelope: overlays?.buildableEnvelope.available && overlays.buildableEnvelope.value
      ? { ...overlays.buildableEnvelope.value, provenance: overlays.buildableEnvelope.provenance }
      : saved.buildableEnvelope,
    updatedAt: new Date().toISOString(),
  }
}

export async function rescreenSites(
  sitesToRescreen: SavedSite[],
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal,
  concurrency = 2,
): Promise<RescreenResult[]> {
  const results = new Array<RescreenResult>(sitesToRescreen.length)
  let nextIndex = 0
  let completed = 0
  const worker = async () => {
    while (nextIndex < sitesToRescreen.length) {
      const index = nextIndex
      nextIndex += 1
      const saved = sitesToRescreen[index]
      try {
        results[index] = { id: saved.id, site: await rescreenSavedSite(saved, signal) }
      } catch (error) {
        if (signal?.aborted) throw error
        results[index] = { id: saved.id, error: error instanceof Error ? error.message : String(error) }
      }
      completed += 1
      onProgress?.(completed, sitesToRescreen.length)
    }
  }
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), sitesToRescreen.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

