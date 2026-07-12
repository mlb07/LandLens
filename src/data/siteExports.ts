import type { SavedSite, ScoreCategory } from '../types/site'

const METRIC_COLUMNS: ScoreCategory[] = ['zoning', 'netDevelopable', 'floodplain', 'wetlands', 'slope', 'utilities', 'access', 'soils', 'stormwater', 'easements', 'contamination', 'species', 'market', 'hazards']

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function sitesToCsv(sites: SavedSite[]): string {
  const headers = [
    'site_id', 'name', 'state', 'latitude', 'longitude', 'intended_use', 'parcel_id', 'gross_acres',
    'adjusted_net_acres', 'net_method', 'final_score', 'verdict', 'confidence', 'gated_to_manual',
    'authority', 'parcel_source', ...METRIC_COLUMNS.map((category) => `${category}_score`), 'updated_at',
  ]
  const rows = sites.map((site) => [
    site.id, site.inputs.name, site.stateCode, site.coordinates.lat, site.coordinates.lng, site.inputs.intendedUse,
    site.parcel?.id, site.inputs.acres, site.buildableEnvelope?.adjustedNetAcres,
    site.buildableEnvelope?.method ?? '', site.analysis.finalScore, site.analysis.verdict, site.analysis.confidence,
    site.analysis.gatedToManual, site.jurisdiction?.authorityName ?? site.authority?.authorityName,
    site.parcel?.provenance?.source, ...METRIC_COLUMNS.map((category) => site.analysis.metrics[category]?.score), site.updatedAt,
  ])
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

export function sitesToGeoJson(sites: SavedSite[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const site of sites) {
    const sharedProperties = {
      siteId: site.id, name: site.inputs.name, stateCode: site.stateCode,
      finalScore: site.analysis.finalScore, verdict: site.analysis.verdict,
      confidence: site.analysis.confidence, intendedUse: site.inputs.intendedUse,
      parcelId: site.parcel?.id ?? null, adjustedNetAcres: site.buildableEnvelope?.adjustedNetAcres ?? null,
    }
    features.push({ type: 'Feature', properties: { ...sharedProperties, featureType: 'site-point' }, geometry: { type: 'Point', coordinates: [site.coordinates.lng, site.coordinates.lat] } })
    const boundary = site.screeningArea?.kind === 'parcel' ? site.screeningArea.boundary : undefined
    if (boundary) features.push({ type: 'Feature', properties: { ...sharedProperties, featureType: 'parcel-boundary', source: site.parcel?.provenance?.source ?? null }, geometry: boundary as GeoJSON.Polygon | GeoJSON.MultiPolygon })
    if (site.buildableEnvelope) features.push({ type: 'Feature', properties: { ...sharedProperties, featureType: 'screening-buildable-envelope', method: site.buildableEnvelope.method, resolutionMeters: site.buildableEnvelope.resolutionMeters }, geometry: site.buildableEnvelope.geometry })
  }
  return { type: 'FeatureCollection', features }
}
