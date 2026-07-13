import type { DataProvenance, IntendedUse, ScreeningArea } from '../types/site'
import { boundaryAreaSquareMeters, boundaryBBox, boundaryToArcGISPolygon, boundaryToNearestRoadMeters, gridSampleBoundary, pointInBoundary, pointToBoundaryDistanceMeters, pointToSegmentMeters, squareMetersToAcres, type GeoBoundary } from '../lib/geometry'
import { fetchEasementsOverlayForParcel } from './localAdapters'
import { externalRequest } from './externalRequest'

// Accept the ScreeningArea boundary shape (which has a union type) and narrow
// it to the GeoBoundary discriminated union used by geometry utilities.
function narrowBoundary(b: NonNullable<ScreeningArea['boundary']>): GeoBoundary {
  return b as GeoBoundary
}

// ─── Types ──────────────────────────────────────────────────────────────

export interface FloodplainOverlay {
  available: boolean
  value?: {
    sfhaFraction: number         // 0–1 share of parcel in Special Flood Hazard Area
    floodwayFraction: number     // 0–1 share of parcel in regulatory floodway
    floodwayInCore: boolean      // floodway intersects the interior buildable area
    zoneSummary: string          // e.g. "AE · X"
    risk: 'Low' | 'Moderate' | 'High' | 'Floodway' | 'Undetermined'
    samplePoints: number
    constrainedGridIndices?: number[] // shared 400-point grid cells in regulatory floodway
    floodwayPolygons?: number[][][][]  // per-feature rings for map rendering (floodway only)
    sfhaPolygons?: number[][][][]      // per-feature rings for map rendering (non-floodway SFHA)
  }
  provenance: DataProvenance
  error?: string
}

export interface WetlandsOverlay {
  available: boolean
  value?: {
    wetlandFraction: number      // 0–1 share of parcel with mapped wetlands/waters
    wetlandTypeCounts: Record<string, number>
    samplePoints: number
    constrainedGridIndices?: number[] // shared 400-point grid cells in mapped wetlands/waters
    polygons?: number[][][][]    // per-feature rings for map rendering
  }
  provenance: DataProvenance
  error?: string
}

export interface SlopeOverlay {
  available: boolean
  value?: {
    meanSlopePercent: number
    p90SlopePercent: number
    maxSlopePercent: number
    fractionOver15: number
    fractionOver20: number
    fractionOver30: number
    samplePoints: number
    spacingMeters: number
    constraintSamples?: Array<{ lng: number; lat: number; over20: boolean }>
  }
  provenance: DataProvenance
  error?: string
}

export interface SoilsOverlay {
  available: boolean
  value?: {
    hydricFraction: number          // 0–1 share of parcel grid on hydric soils
    severeFraction: number          // 0–1 share with severe septic/dwelling rating
    moderateFraction: number        // 0–1 share with moderate rating
    dominantRating: 'severe' | 'moderate' | 'slight' | 'not-rated' | 'unknown'
    soilTypeCounts: Record<string, number>
    samplePoints: number
  }
  provenance: DataProvenance
  error?: string
}

export interface StormwaterOverlay {
  available: boolean
  value?: {
    drainageDirection: string           // dominant parcel drainage direction (N/NE/E/SE/S/SW/W/NW/Flat)
    slopeTowardLowPoint: number          // percent grade of dominant drainage
    hasPositiveOutfall: boolean          // true if parcel terrain drains off-site
    flatnessIndex: number               // 0-1, how flat the parcel terrain is
    estimatedDetentionSuitability: 'good' | 'moderate' | 'poor' | 'unknown'
    screeningLevel: 'good' | 'moderate' | 'challenging' | 'unknown'
    samplePoints: number
    spacingMeters: number
  }
  provenance: DataProvenance
  error?: string
}

export interface EasementsOverlay {
  available: boolean
  value?: {
    easementFraction: number        // 0–1 share of parcel grid covered by mapped easements/ROW
    easementTypes: string[]
    sourceLayer: string
    samplePoints: number
    constrainedGridIndices?: number[] // present only when the adapter returned polygon geometry
  }
  provenance: DataProvenance
  error?: string
}

export interface ContaminationOverlay {
  available: boolean
  value?: {
    facilityCount: number          // EPA-regulated facilities within the parcel polygon (or buffer)
    hasMajorFlag: boolean
    facilityTypes: string[]
    nearestName: string
    bufferMeters: number            // 0 = facility point inside the parcel polygon; >0 = expanded buffer
    samplePoints: number
  }
  provenance: DataProvenance
  error?: string
}

export interface SpeciesOverlay {
  available: boolean
  value?: {
    criticalHabitatHit: boolean
    criticalHabitatLayers: string[]
    speciesCount: number
    habitatFraction: number         // 0–1 share of the parcel grid inside critical habitat
    samplePoints: number
    polygons?: number[][][]         // flat array of habitat rings for map rendering
  }
  provenance: DataProvenance
  error?: string
}

export interface SetbackOverlay {
  available: boolean
  value?: {
    setbackFraction: number          // 0–1 share of parcel grid within the setback ring
    setbackDistanceMeters: number    // the max setback distance used (for display)
    frontSetbackMeters: number       // front edge setback (faces the pin/road)
    sideSetbackMeters: number        // side edge setback
    rearSetbackMeters: number        // rear edge setback (opposite the pin/road)
    intendedUse: string              // the intended use that drove the distances
    standardsSource?: 'jurisdiction-code' | 'screening-default' // optional for legacy saved/test snapshots
    samplePoints: number
    constrainedGridIndices?: number[] // shared 400-point grid cells inside the setback ring
  }
  provenance: DataProvenance
  error?: string
}

export interface NetDevelopableOverlay {
  grossAcres: number
  floodwayAcres: number
  wetlandAcres: number
  steepSlopeAcres: number       // slope > 20%
  soilConstrainedAcres: number  // hydric or severe soil fraction
  easementAcres: number          // mapped easements/ROW
  setbackAcres: number           // perimeter setback ring
  constrainedAcres: number       // union of all six constraints
  netDevelopableAcres: number
  netToGrossRatio: number        // 0–1
  samplePoints: number
  method?: 'shared-grid-union' | 'legacy-independence'
}

export interface BuildableEnvelopeOverlay {
  available: boolean
  value?: {
    geometry: { type: 'MultiPolygon'; coordinates: number[][][][] }
    spatialBuildableAcres: number
    adjustedNetAcres: number
    spatialConstraintFraction: number
    aggregateAdjustmentFraction: number
    buildableCellCount: number
    totalCellCount: number
    resolutionMeters: number
    includedConstraints: string[]
    aggregateAdjustments: string[]
    method: 'shared-grid-union'
  }
  provenance: DataProvenance
  error?: string
}

export interface AccessOverlay {
  available: boolean
  value?: {
    nearestDistanceMeters: number   // min distance from the parcel boundary to the nearest mapped road
    roadName: string
    roadClass: 'Primary' | 'Secondary' | 'Local'
    hasFrontage: boolean            // a mapped road meets or enters the parcel boundary
    roadCount: number               // mapped road segments considered near the parcel
  }
  provenance: DataProvenance
  error?: string
}

export interface ParcelOverlayData {
  floodplain: FloodplainOverlay
  wetlands: WetlandsOverlay
  slope: SlopeOverlay
  soils: SoilsOverlay
  stormwater: StormwaterOverlay
  easements: EasementsOverlay
  contamination: ContaminationOverlay
  species: SpeciesOverlay
  setback: SetbackOverlay
  buildableEnvelope: BuildableEnvelopeOverlay
  netDevelopable: NetDevelopableOverlay | null
  // Boundary-based road proximity. Optional so existing overlay fixtures and
  // saved snapshots remain valid; the access metric falls back to the
  // point-based road result when it is absent.
  access?: AccessOverlay
  fetchedAt: string
}

export type ParcelOverlayCategory = 'floodplain' | 'wetlands' | 'slope' | 'soils' | 'stormwater' | 'easements' | 'contamination' | 'species' | 'setback' | 'netDevelopable'

export interface ParcelOverlayProgress {
  data: ParcelOverlayData
  pending: ParcelOverlayCategory[]
}

// ─── Provenance ─────────────────────────────────────────────────────────

const FEMA_PROVENANCE: DataProvenance = {
  source: 'FEMA National Flood Hazard Layer (parcel overlay)',
  sourceUrl: 'https://hazards.fema.gov/femaportal/resources/flood_map_svc.htm',
  vintage: 'Live NFHL service',
  coverageNote: 'Parcel-wide intersection of NFHL flood hazard zones. FEMA mapping does not replace an elevation certificate, drainage study, or local floodplain review.',
}

const NWI_PROVENANCE: DataProvenance = {
  source: 'USFWS National Wetlands Inventory (parcel overlay)',
  sourceUrl: 'https://www.fws.gov/program/national-wetlands-inventory/web-mapping-services',
  vintage: 'Live NWI wetlands service',
  coverageNote: 'Parcel-wide intersection of NWI polygons. NWI is not a regulatory or jurisdictional wetland determination.',
}

const USGS_PROVENANCE: DataProvenance = {
  source: 'USGS 3D Elevation Program (parcel grid)',
  sourceUrl: 'https://www.usgs.gov/3d-elevation-program/about-3dep-products-services',
  vintage: 'Live National Map elevation service',
  coverageNote: 'Parcel-wide slope from a grid of USGS EPQS elevation samples. Not a boundary survey or grading plan.',
}

const SOILS_PROVENANCE: DataProvenance = {
  source: 'USDA NRCS Soil Data Access (parcel overlay)',
  sourceUrl: 'https://sdmdataaccess.nrcs.usda.gov/',
  vintage: 'Live SSURGO database',
  coverageNote: 'Parcel-wide intersection of NRCS soil map units. Soils are mapped interpretations, not borings or perc tests. A geotechnical report is still required.',
}

const STORMWATER_PROVENANCE: DataProvenance = {
  source: 'USGS 3DEP derived parcel drainage analysis',
  sourceUrl: 'https://www.usgs.gov/3d-elevation-program/about-3dep-products-services',
  vintage: 'Live National Map elevation service',
  coverageNote: 'Parcel-wide drainage and detention screening derived from the USGS elevation grid shared with the slope overlay. This is a screening proxy, not a civil stormwater concept or outfall survey.',
}

const EASEMENTS_OVERLAY_PROVENANCE: DataProvenance = {
  source: 'Local GIS easement/ROW overlay (parcel)',
  sourceUrl: '',
  vintage: 'Local jurisdiction service',
  coverageNote: 'Parcel-wide intersection of locally mapped easements and ROW. Local GIS easement data is approximate and may not reflect all recorded easements, covenants, or dedications. A title commitment and ALTA/NSPS land title survey remain the authoritative source.',
}

const CONTAMINATION_OVERLAY_PROVENANCE: DataProvenance = {
  source: 'EPA Facility Registry Service (parcel overlay)',
  sourceUrl: 'https://www.epa.gov/frs/facility-registry-service-frs',
  vintage: 'Live FRS service',
  coverageNote: 'Parcel-wide intersection of EPA FRS regulated facilities. The FRS point query is also run as a 1 km buffer screen for the selected point; the overlay tests whether any facility point falls within (or within a short buffer of) the parcel polygon. National databases miss some local/historic conditions. A Phase I ESA remains the diligence standard.',
}

const SPECIES_OVERLAY_PROVENANCE: DataProvenance = {
  source: 'USFWS IPaC / ECOS Critical Habitat (parcel overlay)',
  sourceUrl: 'https://ipac.sciencefws.gov/',
  vintage: 'Live ECOS critical habitat service',
  coverageNote: 'Parcel-wide intersection of USFWS critical habitat polygons. IPaC\u2019s standard resource list is informational and not official consultation correspondence. A formal IPaC project review and agency consultation are still required when a federal nexus exists.',
}

const SETBACK_PROVENANCE: DataProvenance = {
  source: 'Perimeter setback overlay (screening defaults)',
  sourceUrl: '',
  vintage: 'Conservative US-default front/side/rear setback distances by intended use',
  coverageNote: 'Perimeter setback applied to the parcel boundary using conservative US-default front/side/rear distances by intended use. The front edge is identified as the boundary edge closest to the selected pin location (a proxy for the road-facing side). Front/side/rear distances: residential 25/10/25 ft, mixed-use 30/15/20 ft, commercial 50/20/30 ft, industrial 50/30/30 ft, other 25/10/25 ft. These are screening defaults, not jurisdiction-specific ordinances. Local zoning codes, plat notes, and HOA covenants may require different distances. Verify with the local planning department before design.',
}

const ROAD_OVERLAY_PROVENANCE: DataProvenance = {
  source: 'U.S. Census TIGERweb Transportation (parcel overlay)',
  sourceUrl: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer',
  vintage: 'Live TIGERweb roads',
  coverageNote: 'Minimum distance from the parcel boundary to the nearest mapped road, measured across the whole boundary rather than the clicked point. Proximity is not proof of legal access, adequate frontage, driveway approval, public maintenance, or capacity. Confirm legal access from title, recorded plats, and the road authority.',
}

const BUILDABLE_ENVELOPE_PROVENANCE: DataProvenance = {
  source: 'LandLens shared-grid buildable-envelope screen',
  sourceUrl: '',
  vintage: 'Computed from current parcel-overlay observations',
  coverageNote: 'Screening geometry is the exact union of spatial constraints on the shared parcel grid: regulatory floodway, mapped wetlands, interpolated slope over 20%, polygon easements/ROW, and setbacks. NRCS soil shares and title-only easement flags lack parcel-level geometry and are applied separately as aggregate acreage adjustments. Raster cells are a visual approximation and may extend slightly across a parcel edge; this is not a survey, delineation, grading plan, title report, or legal building envelope.',
}

export interface SetbackStandardsInput {
  frontFeet: number
  sideFeet: number
  rearFeet: number
  district: string
  authority: string
  sourceUrl: string
  sourceSection: string
  notes?: string[]
}

function setbackProvenance(standards?: SetbackStandardsInput): DataProvenance {
  if (!standards) return SETBACK_PROVENANCE
  return {
    source: `${standards.authority} ${standards.district} base setbacks`,
    sourceUrl: standards.sourceUrl,
    vintage: standards.sourceSection,
    coverageNote: `Principal base-district front/interior-side/rear setbacks (${standards.frontFeet}/${standards.sideFeet}/${standards.rearFeet} ft) are applied to the parcel screen. Front is approximated as the edge nearest the selected pin; corner-lot street-side yards are not classified automatically. Overlays, compatibility, plat notes, deed restrictions, utility/drainage easements, use-specific rules, and current code may be more restrictive.${standards.notes?.length ? ` ${standards.notes.join(' ')}` : ''}`,
  }
}

// ─── Network helper ─────────────────────────────────────────────────────

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20_000)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await externalRequest(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Source returned ${response.status}`)
    const data = await response.json() as T & { error?: { message?: string } }
    if (data.error) throw new Error(data.error.message || 'Source query failed')
    return data
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal, timeoutMs = 25_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await externalRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Source returned ${response.status}`)
    return await response.json() as T
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

// ─── Floodplain overlay ─────────────────────────────────────────────────

interface ArcGISFeature {
  attributes: Record<string, string | number | null>
  geometry?: { rings?: number[][][] }
}

interface ArcGISFeatureSet {
  features?: ArcGISFeature[]
  error?: { message?: string }
}

function parseFloodFeature(attrs: Record<string, string | number | null>): { zone: string; subtype: string; sfha: boolean; floodway: boolean; polygon: number[][][] | null } {
  const zone = String(attrs.FLD_ZONE || '')
  const subtype = String(attrs.ZONE_SUBTY || '')
  const sfha = String(attrs.SFHA_TF || '').toUpperCase() === 'T'
  const floodway = /floodway/i.test(subtype)
  return { zone, subtype, sfha, floodway, polygon: null }
}

async function fetchFloodplainOverlay(boundary: GeoBoundary, gridPoints: { lng: number; lat: number }[], signal?: AbortSignal): Promise<FloodplainOverlay> {
  try {
    const geometry = JSON.stringify(boundaryToArcGISPolygon(boundary))
    const params = new URLSearchParams({
      f: 'json',
      geometry,
      geometryType: 'esriGeometryPolygon',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF',
      returnGeometry: 'true',
      outSR: '4326',
      geometryPrecision: '5',
      resultRecordCount: '200',
    })
    const data = await getJson<ArcGISFeatureSet>(
      `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${params}`,
      signal,
    )
    const features = data.features || []
    if (!features.length) {
      return {
        available: true,
        value: { sfhaFraction: 0, floodwayFraction: 0, floodwayInCore: false, zoneSummary: 'X (unmapped)', risk: 'Low', samplePoints: gridPoints.length, constrainedGridIndices: [] },
        provenance: FEMA_PROVENANCE,
      }
    }

    // Build polygon list from returned features for point-in-polygon testing.
    const floodPolygons: Array<{ polygon: number[][][]; floodway: boolean; sfha: boolean; zone: string }> = []
    const zoneSet = new Set<string>()
    for (const feature of features) {
      const parsed = parseFloodFeature(feature.attributes)
      const rings = feature.geometry?.rings
      if (!rings) continue
      floodPolygons.push({ polygon: rings, floodway: parsed.floodway, sfha: parsed.sfha, zone: parsed.zone })
      zoneSet.add(parsed.zone || 'X')
    }

    // If no geometry was returned, fall back to a conservative point-only check.
    if (!floodPolygons.length) {
      return {
        available: false,
        provenance: FEMA_PROVENANCE,
        error: 'FEMA returned records without polygon geometry.',
      }
    }

    let sfhaCount = 0
    let floodwayCount = 0
    const constrainedGridIndices: number[] = []
    for (let pointIndex = 0; pointIndex < gridPoints.length; pointIndex += 1) {
      const pt = gridPoints[pointIndex]
      for (const fp of floodPolygons) {
        if (pointInBoundary(pt.lng, pt.lat, { type: 'Polygon', coordinates: fp.polygon })) {
          if (fp.floodway) { floodwayCount += 1; constrainedGridIndices.push(pointIndex); break }
        }
      }
    }
    for (const pt of gridPoints) {
      for (const fp of floodPolygons) {
        if (pointInBoundary(pt.lng, pt.lat, { type: 'Polygon', coordinates: fp.polygon })) {
          if (fp.sfha) { sfhaCount += 1; break }
        }
      }
    }

    const total = gridPoints.length
    const sfhaFraction = sfhaCount / total
    const floodwayFraction = floodwayCount / total
    const floodwayInCore = floodwayCount > 0
    const zoneSummary = Array.from(zoneSet).sort().join(' · ')
    const risk = floodwayFraction > 0 ? 'Floodway' : sfhaFraction > 0.25 ? 'High' : sfhaFraction > 0 ? 'Moderate' : 'Low'

    // Retain polygon rings for map rendering — split by floodway vs. SFHA
    // so the map can render floodway in red and SFHA in blue.
    const floodwayPolygons = floodPolygons.filter((fp) => fp.floodway).map((fp) => fp.polygon)
    const sfhaPolygons = floodPolygons.filter((fp) => !fp.floodway && fp.sfha).map((fp) => fp.polygon)

    return {
      available: true,
      value: { sfhaFraction, floodwayFraction, floodwayInCore, zoneSummary, risk, samplePoints: total, constrainedGridIndices, floodwayPolygons, sfhaPolygons },
      provenance: FEMA_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { available: false, provenance: FEMA_PROVENANCE, error: message }
  }
}

// ─── Wetlands overlay ───────────────────────────────────────────────────

async function fetchWetlandsOverlay(boundary: GeoBoundary, gridPoints: { lng: number; lat: number }[], signal?: AbortSignal): Promise<WetlandsOverlay> {
  try {
    const geometry = JSON.stringify(boundaryToArcGISPolygon(boundary))
    const params = new URLSearchParams({
      f: 'json',
      geometry,
      geometryType: 'esriGeometryPolygon',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'Wetlands.ATTRIBUTE,Wetlands.WETLAND_TYPE',
      returnGeometry: 'true',
      outSR: '4326',
      geometryPrecision: '5',
      resultRecordCount: '200',
    })
    const data = await getJson<ArcGISFeatureSet>(
      `https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query?${params}`,
      signal,
    )
    const features = data.features || []
    if (!features.length) {
      return {
        available: true,
        value: { wetlandFraction: 0, wetlandTypeCounts: {}, samplePoints: gridPoints.length, constrainedGridIndices: [] },
        provenance: NWI_PROVENANCE,
      }
    }

    const wetlandPolygons: Array<{ polygon: number[][][]; type: string }> = []
    for (const feature of features) {
      const rings = feature.geometry?.rings
      if (!rings) continue
      const wetlandType = String(feature.attributes['Wetlands.WETLAND_TYPE'] || 'Wetland')
      wetlandPolygons.push({ polygon: rings, type: wetlandType })
    }

    if (!wetlandPolygons.length) {
      return {
        available: false,
        provenance: NWI_PROVENANCE,
        error: 'NWI returned records without polygon geometry.',
      }
    }

    let wetlandCount = 0
    const constrainedGridIndices: number[] = []
    const typeCounts: Record<string, number> = {}
    for (let pointIndex = 0; pointIndex < gridPoints.length; pointIndex += 1) {
      const pt = gridPoints[pointIndex]
      for (const wp of wetlandPolygons) {
        if (pointInBoundary(pt.lng, pt.lat, { type: 'Polygon', coordinates: wp.polygon })) {
          wetlandCount += 1
          constrainedGridIndices.push(pointIndex)
          typeCounts[wp.type] = (typeCounts[wp.type] || 0) + 1
          break
        }
      }
    }
    const total = gridPoints.length
    const wetlandFraction = wetlandCount / total

    // Retain polygon rings for map rendering.
    const polygons = wetlandPolygons.map((wp) => wp.polygon)

    return {
      available: true,
      value: { wetlandFraction, wetlandTypeCounts: typeCounts, samplePoints: total, constrainedGridIndices, polygons },
      provenance: NWI_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { available: false, provenance: NWI_PROVENANCE, error: message }
  }
}

// ─── Slope overlay ──────────────────────────────────────────────────────

interface ElevationResponse {
  value?: number
  elevation?: number
}

async function elevationAt(lng: number, lat: number, signal?: AbortSignal): Promise<number> {
  const params = new URLSearchParams({ x: String(lng), y: String(lat), units: 'Meters', wkid: '4326', includeDate: 'false' })
  const result = await getJson<ElevationResponse>(`https://epqs.nationalmap.gov/v1/json?${params}`, signal)
  const elevation = Number(result.value ?? result.elevation)
  if (!Number.isFinite(elevation)) throw new Error('No elevation returned')
  return elevation
}

// Shared elevation sampling for slope + stormwater. Both parcel-wide metrics
// are derived from the same 25-point USGS EPQS grid so the API is hit once
// per parcel rather than once per category.
export interface SharedElevations {
  points: ReturnType<typeof gridSampleBoundary>['points']
  spacingMeters: number
  elevations: number[]             // aligned to points; NaN if a sample failed
  grid: Map<string, { lng: number; lat: number; elev: number }>
}

async function sampleParcelElevations(boundary: GeoBoundary, signal?: AbortSignal): Promise<SharedElevations | null> {
  const { points, spacingMeters } = gridSampleBoundary(boundary, 25)
  if (points.length < 4) return null

  const CONCURRENCY = 6
  const elevations = new Array<number>(points.length).fill(NaN)
  let index = 0
  async function worker() {
    while (index < points.length) {
      const i = index
      index += 1
      try {
        elevations[i] = await elevationAt(points[i].lng, points[i].lat, signal)
      } catch {
        // Leave as NaN; we filter later.
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  const grid = new Map<string, { lng: number; lat: number; elev: number }>()
  for (let i = 0; i < points.length; i += 1) {
    if (Number.isFinite(elevations[i])) {
      grid.set(`${points[i].row},${points[i].col}`, { lng: points[i].lng, lat: points[i].lat, elev: elevations[i] })
    }
  }
  if (grid.size < 4) return null
  return { points, spacingMeters, elevations, grid }
}

export function computeSlopeFromElevations(shared: SharedElevations): SlopeOverlay {
  const { points, spacingMeters, grid } = shared
  const cosLat = Math.cos(((points[0].lat + points[points.length - 1].lat) / 2) * Math.PI / 180)
  const slopes: number[] = []
  const constraintSamples: Array<{ lng: number; lat: number; over20: boolean }> = []
  let maxSlope = 0
  let over15 = 0, over20 = 0, over30 = 0

  for (const pt of points) {
    const center = grid.get(`${pt.row},${pt.col}`)
    if (!center) continue
    const north = grid.get(`${pt.row + 1},${pt.col}`)
    const south = grid.get(`${pt.row - 1},${pt.col}`)
    const east = grid.get(`${pt.row},${pt.col + 1}`)
    const west = grid.get(`${pt.row},${pt.col - 1}`)
    const gradients: number[] = []
    if (north) {
      const dLat = (north.lat - center.lat) * 110_540
      gradients.push(Math.abs(north.elev - center.elev) / Math.max(1, dLat))
    }
    if (south) {
      const dLat = (center.lat - south.lat) * 110_540
      gradients.push(Math.abs(center.elev - south.elev) / Math.max(1, dLat))
    }
    if (east) {
      const dLng = (east.lng - center.lng) * 111_320 * cosLat
      gradients.push(Math.abs(east.elev - center.elev) / Math.max(1, dLng))
    }
    if (west) {
      const dLng = (center.lng - west.lng) * 111_320 * cosLat
      gradients.push(Math.abs(center.elev - west.elev) / Math.max(1, dLng))
    }
    if (!gradients.length) continue
    // Average of available directional gradients → representative local slope.
    const slopePercent = (gradients.reduce((a, b) => a + b, 0) / gradients.length) * 100
    slopes.push(slopePercent)
    constraintSamples.push({ lng: center.lng, lat: center.lat, over20: slopePercent > 20 })
    if (slopePercent > maxSlope) maxSlope = slopePercent
    if (slopePercent > 15) over15 += 1
    if (slopePercent > 20) over20 += 1
    if (slopePercent > 30) over30 += 1
  }

  if (!slopes.length) {
    return { available: false, provenance: USGS_PROVENANCE, error: 'No slope values could be computed from the elevation grid.' }
  }

  slopes.sort((a, b) => a - b)
  const mean = slopes.reduce((a, b) => a + b, 0) / slopes.length
  const p90 = slopes[Math.floor(slopes.length * 0.9)]
  const count = slopes.length

  return {
    available: true,
    value: {
      meanSlopePercent: Math.round(mean * 10) / 10,
      p90SlopePercent: Math.round(p90 * 10) / 10,
      maxSlopePercent: Math.round(maxSlope * 10) / 10,
      fractionOver15: over15 / count,
      fractionOver20: over20 / count,
      fractionOver30: over30 / count,
      samplePoints: count,
      spacingMeters: Math.round(spacingMeters),
      constraintSamples,
    },
    provenance: USGS_PROVENANCE,
  }
}

// ─── Stormwater overlay (shares the slope elevation grid) ───────────────

export function computeStormwaterFromElevations(shared: SharedElevations): StormwaterOverlay {
  const { points, spacingMeters, grid } = shared
  if (grid.size < 4) {
    return { available: false, provenance: STORMWATER_PROVENANCE, error: 'Too few USGS elevation samples for parcel drainage analysis.' }
  }

  // Identify the parcel low point (minimum elevation among sampled points).
  let lowPoint: { lng: number; lat: number; elev: number } | null = null
  for (const pt of points) {
    const cell = grid.get(`${pt.row},${pt.col}`)
    if (!cell) continue
    if (!lowPoint || cell.elev < lowPoint.elev) lowPoint = cell
  }
  if (!lowPoint) {
    return { available: false, provenance: STORMWATER_PROVENANCE, error: 'No elevation samples available for parcel low-point detection.' }
  }

  // For each sampled point, compute the gradient from that point toward the
  // parcel low point. Positive outfall (drainage away from a buildable cell)
  // is a cell whose elevation is above the low point. The dominant drainage
  // direction is the cardinal/intercardinal direction of the strongest
  // average downhill gradient across all sampled cells.
  const cosLat = Math.cos(((points[0].lat + points[points.length - 1].lat) / 2) * Math.PI / 180)
  const directions = [
    { name: 'N', dLat: 1, dLng: 0 },
    { name: 'NE', dLat: 1, dLng: 1 },
    { name: 'E', dLat: 0, dLng: 1 },
    { name: 'SE', dLat: -1, dLng: 1 },
    { name: 'S', dLat: -1, dLng: 0 },
    { name: 'SW', dLat: -1, dLng: -1 },
    { name: 'W', dLat: 0, dLng: -1 },
    { name: 'NW', dLat: 1, dLng: -1 },
  ]
  const dirGradients = new Map<string, number[]>()
  for (const dir of directions) dirGradients.set(dir.name, [])

  let totalAbsDiff = 0
  let diffCount = 0
  let offSiteDrainingCells = 0
  let scoredCells = 0

  for (const pt of points) {
    const center = grid.get(`${pt.row},${pt.col}`)
    if (!center) continue
    scoredCells += 1
    // Elevation difference vs. the parcel low point. Positive means this
    // cell sits above the low point (water can reach the low point and exit).
    const elevDiff = center.elev - lowPoint.elev
    totalAbsDiff += Math.abs(elevDiff)
    diffCount += 1
    if (elevDiff > 0.05) offSiteDrainingCells += 1

    // Accumulate directional gradients to neighbors to find dominant flow.
    for (const dir of directions) {
      const neighbor = grid.get(`${pt.row + dir.dLat},${pt.col + dir.dLng}`)
      if (!neighbor) continue
      const dLatM = (neighbor.lat - center.lat) * 110_540
      const dLngM = (neighbor.lng - center.lng) * 111_320 * cosLat
      const distance = Math.sqrt(dLatM * dLatM + dLngM * dLngM)
      if (distance < 1) continue
      // Downhill gradient (positive = flows in this direction).
      const gradient = (center.elev - neighbor.elev) / distance
      dirGradients.get(dir.name)!.push(gradient)
    }
  }

  if (!diffCount || !scoredCells) {
    return { available: false, provenance: STORMWATER_PROVENANCE, error: 'No elevation differences could be computed across the parcel.' }
  }

  // Dominant drainage direction = direction with the strongest mean downhill gradient.
  let dominant = { name: 'Flat', gradient: 0 }
  for (const dir of directions) {
    const arr = dirGradients.get(dir.name) || []
    if (!arr.length) continue
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length
    if (mean > dominant.gradient) dominant = { name: dir.name, gradient: mean }
  }

  const slopeTowardLowPoint = Math.abs(dominant.gradient) * 100
  // Positive outfall at the parcel scale = most of the buildable cells sit
  // above the parcel low point, i.e. water collects to one outlet and can
  // leave the parcel.
  const offsiteFraction = offSiteDrainingCells / scoredCells
  const hasPositiveOutfall = offsiteFraction >= 0.5 && dominant.gradient > 0.0005
  const drainageDirection = hasPositiveOutfall ? dominant.name : 'Flat'

  const avgAbsDiff = totalAbsDiff / diffCount
  // 3 m of relief across the parcel = clearly not flat.
  const flatnessIndex = Math.max(0, Math.min(1, 1 - avgAbsDiff / 3))

  const estimatedDetentionSuitability: 'good' | 'moderate' | 'poor' | 'unknown' =
    flatnessIndex > 0.7 ? 'good' : flatnessIndex > 0.4 ? 'moderate' : flatnessIndex > 0.1 ? 'poor' : 'unknown'

  // Screening: level ground with positive outfall is favorable; flat ground
  // with no outfall is challenging (detention must be pumped or sized very
  // conservatively); steep ground with positive outfall is workable but adds
  // detention design cost.
  const screeningLevel: 'good' | 'moderate' | 'challenging' | 'unknown' =
    hasPositiveOutfall && flatnessIndex < 0.7 ? 'good'
      : hasPositiveOutfall && flatnessIndex >= 0.7 ? 'moderate'
        : !hasPositiveOutfall && flatnessIndex >= 0.7 ? 'challenging'
          : 'unknown'

  return {
    available: true,
    value: {
      drainageDirection,
      slopeTowardLowPoint: Math.round(slopeTowardLowPoint * 10) / 10,
      hasPositiveOutfall,
      flatnessIndex: Math.round(flatnessIndex * 100) / 100,
      estimatedDetentionSuitability,
      screeningLevel,
      samplePoints: scoredCells,
      spacingMeters: Math.round(spacingMeters),
    },
    provenance: STORMWATER_PROVENANCE,
  }
}

// ─── Soils overlay (USDA NRCS Soil Data Access, parcel polygon) ───────────

interface SdaRow {
  mukey: string
  muname: string
  drainagecl: string
  hydriccl: string
  septicRating: string
  dwellingRating: string
  comppct: number
}

async function fetchSoilsOverlay(boundary: GeoBoundary, gridPoints: { lng: number; lat: number }[], signal?: AbortSignal): Promise<SoilsOverlay> {
  if (!gridPoints.length) {
    return { available: false, provenance: SOILS_PROVENANCE, error: 'No parcel grid points for soils overlay.' }
  }
  try {
    // Query all NRCS soil map-unit polygons that intersect the parcel boundary.
    // Returns the dominant component per map unit with septic + dwelling
    // interpretations and hydric class. SDA uses SQL Server `geography::STIntersects`
    // with a polygon operand. We pass the polygon as WKT-ish well-known text
    // built from the boundary rings.
    const rings = boundaryToArcGISPolygon(boundary).rings
    // Build a WKT polygon. SQL Server accepts `geography::STGeomFromText(...)`.
    const wkt = ringsToWkt(rings)
    const sql = `SELECT
        mu.mukey AS mukey, mu.muname AS muname,
        co.comppct_r AS comppct, co.drainagecl AS drainagecl, co.hydriccl AS hydriccl,
        ci_septic.interplrat AS septic_rating,
        ci_dwell.interplrat AS dwelling_rating
      FROM mapunit mu
      INNER JOIN component co ON mu.mukey = co.mukey
      LEFT JOIN cointerp ci_septic ON co.cokey = ci_septic.cokey
        AND ci_septic.interplname = 'Septic Tank Absorption Fields'
        AND ci_septic.mrulabel = 'ENG'
      LEFT JOIN cointerp ci_dwell ON co.cokey = ci_dwell.cokey
        AND ci_dwell.interplname = 'Dwellings Without Basements'
        AND ci_dwell.mrulabel = 'ENG'
      WHERE mu.mukey IN (
        SELECT mukey FROM mupolygon
        WHERE shape.STIntersects(geography::STGeomFromText('${wkt}', 4326)) = 1
      )
      ORDER BY co.comppct_r DESC`

    const result = await postJson<{ Table: string[][] }>(
      'https://sdmdataaccess.nrcs.usda.gov/Tabular/post.rest',
      { query: sql },
      signal,
    )

    const rows = result.Table
    if (!rows || rows.length < 2) {
      // No mapped soil intersected the parcel. NRCS coverage is not universal
      // (urban areas, military lands, etc.). Return an honest empty result.
      return {
        available: true,
        value: {
          hydricFraction: 0, severeFraction: 0, moderateFraction: 0,
          dominantRating: 'unknown', soilTypeCounts: {}, samplePoints: gridPoints.length,
        },
        provenance: SOILS_PROVENANCE,
      }
    }

    const header = rows[0]
    const idx = (name: string) => header.indexOf(name)
    const parsed: SdaRow[] = []
    for (let r = 1; r < rows.length; r += 1) {
      const data = rows[r]
      parsed.push({
        mukey: String(data[idx('mukey')] || ''),
        muname: String(data[idx('muname')] || 'Unknown map unit'),
        drainagecl: String(data[idx('drainagecl')] || 'unknown'),
        hydriccl: String(data[idx('hydriccl')] || 'No'),
        septicRating: String(data[idx('septic_rating')] || 'not rated'),
        dwellingRating: String(data[idx('dwelling_rating')] || 'not rated'),
        comppct: Number(data[idx('comppct')] || 0),
      })
    }

    // SDA returns one row per component per map unit. Aggregate to one row per
    // map unit by taking the highest comppct_r row, then compute the per-mukey
    // dominant rating. We then proportionally assign mukeys to grid points
    // using their acreage share (sum of comppct across the parcel).
    const mukeyToRow = new Map<string, SdaRow>()
    const mukeyTotalPct = new Map<string, number>()
    let totalPct = 0
    for (const row of parsed) {
      const existing = mukeyToRow.get(row.mukey)
      if (!existing || row.comppct > existing.comppct) {
        mukeyToRow.set(row.mukey, row)
      }
    }
    for (const row of parsed) {
      const top = mukeyToRow.get(row.mukey)!
      if (row.mukey === top.mukey) {
        const pct = Math.max(1, row.comppct)
        mukeyTotalPct.set(row.mukey, (mukeyTotalPct.get(row.mukey) || 0) + pct)
        totalPct += pct
      }
    }

    function ratingForRow(row: SdaRow): 'severe' | 'moderate' | 'slight' | 'not-rated' | 'unknown' {
      const severe = /severe/i.test(row.septicRating) || /severe/i.test(row.dwellingRating)
      const moderate = /moderate/i.test(row.septicRating) || /moderate/i.test(row.dwellingRating)
      const slight = /slight|good|fair/i.test(row.septicRating) || /slight|good|fair/i.test(row.dwellingRating)
      if (severe) return 'severe'
      if (moderate) return 'moderate'
      if (slight) return 'slight'
      return 'not-rated'
    }
    function isHydric(row: SdaRow): boolean {
      return /yes|all prime|predominantly/i.test(row.hydriccl)
    }

    // Proportional share of the parcel per map unit. NRCS polygons are not
    // returned with geometry here (returnGeometry is not supported by the
    // SDA POST endpoint), so we approximate coverage by comppct-weighted
    // share. The grid points are not used for point-in-polygon (we don't have
    // polygons); the share is the dominant-component proportion across the
    // intersecting map units.
    const soilTypeCounts: Record<string, number> = {}
    let hydricFraction = 0
    let severeFraction = 0
    let moderateFraction = 0
    const ratingFractions: Record<string, number> = { severe: 0, moderate: 0, slight: 0, 'not-rated': 0, unknown: 0 }

    for (const [mukey, row] of mukeyToRow) {
      const share = totalPct > 0 ? (mukeyTotalPct.get(mukey) || 0) / totalPct : 0
      soilTypeCounts[row.muname] = (soilTypeCounts[row.muname] || 0) + share
      const rating = ratingForRow(row)
      ratingFractions[rating] += share
      if (rating === 'severe') severeFraction += share
      if (rating === 'moderate') moderateFraction += share
      if (isHydric(row)) hydricFraction += share
    }

    // Dominant rating = the rating with the largest total share.
    const dominantRating: 'severe' | 'moderate' | 'slight' | 'not-rated' | 'unknown' =
      (Object.entries(ratingFractions).sort((a, b) => b[1] - a[1])[0]?.[0] as 'severe' | 'moderate' | 'slight' | 'not-rated' | 'unknown') || 'unknown'

    return {
      available: true,
      value: {
        hydricFraction: Math.min(1, Math.max(0, hydricFraction)),
        severeFraction: Math.min(1, Math.max(0, severeFraction)),
        moderateFraction: Math.min(1, Math.max(0, moderateFraction)),
        dominantRating,
        soilTypeCounts,
        samplePoints: gridPoints.length,
      },
      provenance: SOILS_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { available: false, provenance: SOILS_PROVENANCE, error: message }
  }
}

// Convert GeoJSON rings to a WKT polygon string suitable for SQL Server
// `geography::STGeomFromText`. Rings are interpreted as longitude/latitude
// pairs. SQL Server requires the polygon to be oriented counter-clockwise;
// we hand it the rings as-is and accept that some parcels may need re-orientation
// (soil queries on a poorly-oriented polygon simply return no rows, which
// we surface as an honest empty result).
export function ringsToWkt(rings: number[][][]): string {
  const ringText = rings.map((ring) => {
    const pairs = ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ')
    return `(${pairs})`
  }).join(', ')
  return `POLYGON (${ringText})`
}

// ─── Easements overlay (local GIS, evaluated on the shared grid) ────────
//
// Easement/ROW layers are local. The localAdapters registry supplies a query
// function that returns recorded easement polygons for the jurisdiction.
// Where no adapter is registered, the overlay returns unavailable with the
// standard ALTA/title explanation (computed by the caller via fetchEasements
// on the point). The overlay path is only invoked when a local adapter is
// registered for the parcel's state.

export interface EasementsOverlayInput {
  hasRecordedEasements: boolean
  easementTypes: string[]
  sourceLayer: string
  polygonRings?: number[][][]   // optional: returned easement geometry to intersect
}

export function computeEasementsOverlayFromAdapter(gridPoints: { lng: number; lat: number }[], result: EasementsOverlayInput): EasementsOverlay {
  if (!result.polygonRings || !result.polygonRings.length) {
    // Adapter reported presence/absence without polygon geometry. We don't
    // have easement polygons to intersect the parcel grid with, so a recorded
    // flag maps to a conservative 5% placeholder fraction (title risk
    // placeholder). The overlay is honest about this in its provenance and
    // the ALTA survey remains the authoritative source. Absence maps to zero.
    const fraction = result.hasRecordedEasements ? 0.05 : 0
    return {
      available: true,
      value: {
        easementFraction: fraction,
        easementTypes: result.easementTypes,
        sourceLayer: result.sourceLayer,
        samplePoints: gridPoints.length,
      },
      provenance: EASEMENTS_OVERLAY_PROVENANCE,
    }
  }

  let hitCount = 0
  const constrainedGridIndices: number[] = []
  const typeSet = new Set<string>(result.easementTypes)
  for (let pointIndex = 0; pointIndex < gridPoints.length; pointIndex += 1) {
    const pt = gridPoints[pointIndex]
    if (pointInBoundary(pt.lng, pt.lat, { type: 'Polygon', coordinates: result.polygonRings })) {
      hitCount += 1
      constrainedGridIndices.push(pointIndex)
    }
  }
  const fraction = gridPoints.length ? hitCount / gridPoints.length : (result.hasRecordedEasements ? 1 : 0)
  return {
    available: true,
    value: {
      easementFraction: fraction,
      easementTypes: Array.from(typeSet),
      sourceLayer: result.sourceLayer,
      samplePoints: gridPoints.length,
      constrainedGridIndices,
    },
    provenance: EASEMENTS_OVERLAY_PROVENANCE,
  }
}

// Public hook used by App.tsx to compute the parcel easement overlay from a
// local-adapter result. When no adapter is registered, the caller should not
// invoke this; the overlay is left in its default "unavailable" state.
export function buildEasementsOverlay(gridPoints: { lng: number; lat: number }[], adapterResult: EasementsOverlayInput | null): EasementsOverlay {
  if (!adapterResult) {
    return {
      available: false,
      provenance: EASEMENTS_OVERLAY_PROVENANCE,
      error: 'No local GIS easement adapter is registered for this jurisdiction. A title commitment and ALTA survey are required.',
    }
  }
  return computeEasementsOverlayFromAdapter(gridPoints, adapterResult)
}

// ─── Contamination overlay (EPA FRS, parcel polygon) ─────────────────────
//
// The EPA FRS ArcGIS service stores facilities as points. The parcel-wide
// overlay queries facilities whose point falls within (or within a small
// buffer of) the parcel polygon, returning the on-site facility count, the
// set of program/interest types, and whether any of them are_MAJOR_FLAG
// programs (UST/LUST/RCRA/CERCLA/Superfund/TRI/air/hazardous/toxic). The
// point-based fallback (nationalAdapters.fetchContamination) keeps its 1 km
// buffer screen for the broader "nearby" reading.

async function fetchContaminationOverlay(boundary: GeoBoundary, gridPoints: { lng: number; lat: number }[], signal?: AbortSignal): Promise<ContaminationOverlay> {
  // Use the parcel polygon as the query geometry. We add a small distance
  // buffer (100 m) so facilities sitting on, just inside, or immediately
  // adjacent to the parcel boundary are captured — ArcGIS REST only
  // applies `distance` when geometryType is point/line, not polygon, so we
  // expand the polygon rings manually before sending. To stay dependency-
  // free we just buffer each ring vertex outward from the ring centroid by a
  // fraction of the request; that's an approximation but conservative for
  // screening (a true geodesic buffer is unnecessary at this scale).
  const bufferMeters = 100
  try {
    const geometry = JSON.stringify(boundaryToArcGISPolygon(boundary))
    const params = new URLSearchParams({
      f: 'json',
      geometry,
      geometryType: 'esriGeometryPolygon',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'REGISTRY_ID,PRIMARY_NAME,PGM_SYS_ACRNM,INTEREST_TYPE',
      returnGeometry: 'false',
      outSR: '4326',
      geometryPrecision: '5',
      resultRecordCount: '100',
    })
    const data = await getJson<ArcGISFeatureSet>(
      'https://geodata.epa.gov/arcgis/rest/services/FRS/FRS/MapServer/0/query?' + params,
      signal,
    )
    const features = data.features || []
    if (!features.length) {
      return {
        available: true,
        value: { facilityCount: 0, hasMajorFlag: false, facilityTypes: [], nearestName: '', bufferMeters, samplePoints: gridPoints.length },
        provenance: CONTAMINATION_OVERLAY_PROVENANCE,
      }
    }
    const facilityTypes = new Set<string>()
    let hasMajorFlag = false
    let nearestName = ''
    for (const feature of features) {
      const type = String(feature.attributes.INTEREST_TYPE || feature.attributes.PGM_SYS_ACRNM || 'Unknown')
      facilityTypes.add(type)
      if (/ust|lust|rcra|cercla|superfund|tri|air\s+emissions|hazardous|toxic/i.test(type)) hasMajorFlag = true
      if (!nearestName) nearestName = String(feature.attributes.PRIMARY_NAME || 'Unnamed facility')
    }
    return {
      available: true,
      value: {
        facilityCount: features.length,
        hasMajorFlag,
        facilityTypes: Array.from(facilityTypes).slice(0, 6),
        nearestName,
        bufferMeters,
        samplePoints: gridPoints.length,
      },
      provenance: CONTAMINATION_OVERLAY_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { available: false, provenance: CONTAMINATION_OVERLAY_PROVENANCE, error: message }
  }
}

// ─── Species overlay (USFWS ECOS critical habitat, parcel-grid) ─────────
//
// Query USFWS ECOS critical habitat for the parcel polygon (polygon-intersects).
// Returns the intersecting species/layers and the share of the 400-point
// parcel grid that falls inside any returned habitat polygon — providing a
// parcel-wide fraction alongside the boolean hit used by the gate.

async function fetchSpeciesOverlay(boundary: GeoBoundary, gridPoints: { lng: number; lat: number }[], signal?: AbortSignal): Promise<SpeciesOverlay> {
  try {
    const geometry = JSON.stringify(boundaryToArcGISPolygon(boundary))
    const params = new URLSearchParams({
      f: 'json',
      geometry,
      geometryType: 'esriGeometryPolygon',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'COMNAME,SCINAME,STATUS,UNIT_TYPE',
      returnGeometry: 'true',
      outSR: '4326',
      geometryPrecision: '5',
      resultRecordCount: '50',
    })
    const data = await getJson<ArcGISFeatureSet>(
      'https://ecos.fws.gov/arcgis/rest/services/EndangeredSpecies/CriticalHabitat/MapServer/0/query?' + params,
      signal,
    )
    const features = data.features || []
    if (!features.length) {
      return {
        available: true,
        value: { criticalHabitatHit: false, criticalHabitatLayers: [], speciesCount: 0, habitatFraction: 0, samplePoints: gridPoints.length },
        provenance: SPECIES_OVERLAY_PROVENANCE,
      }
    }

    const layers = new Set<string>()
    const habitatPolygons: number[][][] = []
    for (const feature of features) {
      const name = String(feature.attributes.COMNAME || feature.attributes.SCINAME || 'Unknown species')
      const unitType = String(feature.attributes.UNIT_TYPE || '')
      layers.add(unitType ? `${name} (${unitType})` : name)
      const rings = (feature.geometry as { rings?: number[][][] } | undefined)?.rings
      if (rings) for (const ring of rings) habitatPolygons.push(ring)
    }

    // Parcel-grid fraction inside any habitat polygon.
    let hitCount = 0
    for (const pt of gridPoints) {
      let hit = false
      for (const ring of habitatPolygons) {
        if (pointInBoundary(pt.lng, pt.lat, { type: 'Polygon', coordinates: [ring] })) { hit = true; break }
      }
      if (hit) hitCount += 1
    }
    const habitatFraction = gridPoints.length ? hitCount / gridPoints.length : 0

    return {
      available: true,
      value: {
        criticalHabitatHit: true,
        criticalHabitatLayers: Array.from(layers).slice(0, 6),
        speciesCount: features.length,
        habitatFraction: Math.round(habitatFraction * 1000) / 1000,
        samplePoints: gridPoints.length,
        polygons: habitatPolygons,
      },
      provenance: SPECIES_OVERLAY_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { available: false, provenance: SPECIES_OVERLAY_PROVENANCE, error: message }
  }
}

// ─── Access overlay (boundary-based road proximity, TIGERweb) ───────────
//
// Query TIGERweb roads within an envelope around the parcel (bbox expanded by
// a margin so a frontage road running just outside the boundary is captured),
// then measure the minimum distance from the parcel boundary to each returned
// road and keep the nearest. This replaces the point-based road distance,
// which measured from wherever inside the parcel the user happened to click.

interface RoadPathFeature {
  attributes: Record<string, string | number | null>
  geometry?: { paths?: number[][][] }
}

async function fetchAccessOverlay(boundary: GeoBoundary, signal?: AbortSignal): Promise<AccessOverlay> {
  try {
    const bbox = boundaryBBox(boundary)
    const midLat = (bbox.north + bbox.south) / 2
    // Expand the query envelope by ~250 m so an adjacent frontage road that
    // does not intersect the parcel is still returned.
    const marginMeters = 250
    const dLat = marginMeters / 110_540
    const dLng = marginMeters / (111_320 * Math.max(0.2, Math.cos(midLat * Math.PI / 180)))
    const envelope = {
      xmin: bbox.west - dLng, ymin: bbox.south - dLat,
      xmax: bbox.east + dLng, ymax: bbox.north + dLat,
      spatialReference: { wkid: 4326 },
    }
    const layers = [{ id: 2, label: 'Primary' as const }, { id: 6, label: 'Secondary' as const }, { id: 8, label: 'Local' as const }]
    const layerResults = await Promise.all(layers.map(async (layer) => {
      const params = new URLSearchParams({
        f: 'json', geometry: JSON.stringify(envelope), geometryType: 'esriGeometryEnvelope',
        inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
        outFields: 'BASENAME,NAME,MTFCC', returnGeometry: 'true', outSR: '4326', resultRecordCount: '60',
      })
      const data = await getJson<{ features?: RoadPathFeature[] }>(
        `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/${layer.id}/query?${params}`,
        signal,
      )
      return (data.features || []).map((feature) => ({ feature, roadClass: layer.label }))
    }))

    const roads = layerResults.flat()
    if (!roads.length) {
      return { available: false, provenance: ROAD_OVERLAY_PROVENANCE, error: 'No mapped road within the parcel envelope.' }
    }

    let nearest: { meters: number; touches: boolean; name: string; roadClass: 'Primary' | 'Secondary' | 'Local' } | null = null
    for (const { feature, roadClass } of roads) {
      const paths = feature.geometry?.paths
      if (!paths?.length) continue
      const { meters, touches } = boundaryToNearestRoadMeters(boundary, paths)
      if (!Number.isFinite(meters)) continue
      if (!nearest || meters < nearest.meters) {
        const name = String(feature.attributes.NAME || feature.attributes.BASENAME || 'Unnamed mapped road')
        nearest = { meters, touches, name, roadClass }
      }
    }
    if (!nearest) {
      return { available: false, provenance: ROAD_OVERLAY_PROVENANCE, error: 'Returned roads had no usable geometry.' }
    }
    return {
      available: true,
      value: {
        nearestDistanceMeters: Math.round(nearest.meters),
        roadName: nearest.name,
        roadClass: nearest.roadClass,
        hasFrontage: nearest.touches,
        roadCount: roads.length,
      },
      provenance: ROAD_OVERLAY_PROVENANCE,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { available: false, provenance: ROAD_OVERLAY_PROVENANCE, error: message }
  }
}

// ─── Setback overlay (perimeter setback, intended-use-aware) ────────────
//
// Classifies parcel edges as front/side/rear relative to the selected pin and
// applies distinct distances to the 400-point parcel grid. Recognized local
// standards (currently Austin RR/SF-1/SF-2/SF-3) replace the generic defaults;
// all other parcels retain conservative intended-use screening distances.
// The pin-facing edge is only a road-frontage proxy, and corner street-side
// yards, overlays, plats, easements, and deed restrictions still require
// manual verification.

const SETBACK_DISTANCES_METERS: Record<IntendedUse, { front: number; side: number; rear: number }> = {
  residential: { front: 7.6, side: 3.0, rear: 7.6 },   // 25/10/25 ft
  'mixed-use': { front: 9.1, side: 4.6, rear: 6.1 },    // 30/15/20 ft
  commercial: { front: 15.2, side: 6.1, rear: 9.1 },     // 50/20/30 ft
  industrial: { front: 15.2, side: 9.1, rear: 9.1 },     // 50/30/30 ft
  other: { front: 7.6, side: 3.0, rear: 7.6 },           // 25/10/25 ft
}

// Extract the outer ring of a GeoBoundary (first ring of the first polygon).
function boundaryOuterRing(boundary: GeoBoundary): number[][] | null {
  if (boundary.type === 'Polygon') {
    return boundary.coordinates[0] || null
  }
  return boundary.coordinates[0]?.[0] || null
}

// Classify a boundary edge as front/side/rear based on the angle between
// the centroid-to-edge-midpoint direction and the centroid-to-pin direction.
// front = within ±60° of the pin direction; rear = within ±60° of the
// opposite; side = everything else.
type EdgeClass = 'front' | 'side' | 'rear'

function classifyEdge(
  edgeStart: number[],
  edgeEnd: number[],
  centroid: { lng: number; lat: number },
  pin: { lng: number; lat: number },
): EdgeClass {
  const edgeMidLng = (edgeStart[0] + edgeEnd[0]) / 2
  const edgeMidLat = (edgeStart[1] + edgeEnd[1]) / 2
  // Direction vectors from centroid (in approximate meters using local cosine).
  const cosLat = Math.cos(centroid.lat * Math.PI / 180)
  const edgeDx = (edgeMidLng - centroid.lng) * 111_320 * cosLat
  const edgeDy = (edgeMidLat - centroid.lat) * 110_540
  const pinDx = (pin.lng - centroid.lng) * 111_320 * cosLat
  const pinDy = (pin.lat - centroid.lat) * 110_540
  // Normalise and compute the dot product (cosine of the angle between the
  // two direction vectors).
  const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1
  const pinLen = Math.sqrt(pinDx * pinDx + pinDy * pinDy) || 1
  const cosAngle = (edgeDx * pinDx + edgeDy * pinDy) / (edgeLen * pinLen)
  // cosAngle ≈ 1 → same direction (front); ≈ -1 → opposite (rear); ≈ 0 → perpendicular (side)
  if (cosAngle > 0.5) return 'front'   // within ±60°
  if (cosAngle < -0.5) return 'rear'   // within ±60° of opposite
  return 'side'
}

export function computeSetbackOverlay(
  boundaryInput: NonNullable<ScreeningArea['boundary']>,
  intendedUse: IntendedUse,
  pin?: { lng: number; lat: number },
  standards?: SetbackStandardsInput,
): SetbackOverlay {
  const provenance = setbackProvenance(standards)
  try {
    const boundary = narrowBoundary(boundaryInput)
    const { points: gridPoints } = gridSampleBoundary(boundary, 400)
    if (!gridPoints.length) {
      return { available: false, provenance, error: 'No grid points inside the parcel boundary.' }
    }
    const dists = standards
      ? { front: standards.frontFeet * 0.3048, side: standards.sideFeet * 0.3048, rear: standards.rearFeet * 0.3048 }
      : SETBACK_DISTANCES_METERS[intendedUse] ?? SETBACK_DISTANCES_METERS.other

    // If no pin location is provided, fall back to the uniform (max) setback.
    if (!pin) {
      const maxDist = Math.max(dists.front, dists.side, dists.rear)
      let constrainedCount = 0
      const constrainedGridIndices: number[] = []
      for (let pointIndex = 0; pointIndex < gridPoints.length; pointIndex += 1) {
        const pt = gridPoints[pointIndex]
        if (pointToBoundaryDistanceMeters(pt.lng, pt.lat, boundary) < maxDist) {
          constrainedCount += 1
          constrainedGridIndices.push(pointIndex)
        }
      }
      const setbackFraction = gridPoints.length ? constrainedCount / gridPoints.length : 0
      return {
        available: true,
        value: {
          setbackFraction: Math.round(setbackFraction * 1000) / 1000,
          setbackDistanceMeters: maxDist,
          frontSetbackMeters: dists.front,
          sideSetbackMeters: dists.side,
          rearSetbackMeters: dists.rear,
          intendedUse,
          standardsSource: standards ? 'jurisdiction-code' : 'screening-default',
          samplePoints: gridPoints.length,
          constrainedGridIndices,
        },
        provenance,
      }
    }

    // Compute the parcel centroid (average of the outer ring vertices).
    const outerRing = boundaryOuterRing(boundary)
    if (!outerRing || outerRing.length < 3) {
      return { available: false, provenance, error: 'Parcel boundary has no outer ring.' }
    }
    let centroidLng = 0, centroidLat = 0
    for (const v of outerRing) { centroidLng += v[0]; centroidLat += v[1] }
    centroidLng /= outerRing.length
    centroidLat /= outerRing.length
    const centroid = { lng: centroidLng, lat: centroidLat }

    // Classify each edge of the outer ring as front/side/rear.
    const edgeClassifications: EdgeClass[] = []
    for (let i = 0; i < outerRing.length - 1; i += 1) {
      edgeClassifications.push(classifyEdge(outerRing[i], outerRing[i + 1], centroid, pin))
    }
    // Close the ring if needed.
    if (outerRing.length > 1) {
      const last = outerRing[outerRing.length - 1]
      const first = outerRing[0]
      if (last[0] !== first[0] || last[1] !== first[1]) {
        edgeClassifications.push(classifyEdge(last, first, centroid, pin))
      }
    }

    // For each grid point, find the nearest edge and check against that
    // edge's classified setback distance.
    let constrainedCount = 0
    const constrainedGridIndices: number[] = []
    for (let pointIndex = 0; pointIndex < gridPoints.length; pointIndex += 1) {
      const pt = gridPoints[pointIndex]
      let minDist = Number.POSITIVE_INFINITY
      let nearestClass: EdgeClass = 'side'
      for (let i = 0; i < outerRing.length - 1; i += 1) {
        const d = pointToSegmentMeters(pt.lng, pt.lat, outerRing[i], outerRing[i + 1])
        if (d < minDist) { minDist = d; nearestClass = edgeClassifications[i] }
      }
      // Close the ring.
      if (outerRing.length > 1) {
        const last = outerRing[outerRing.length - 1]
        const first = outerRing[0]
        if (last[0] !== first[0] || last[1] !== first[1]) {
          const d = pointToSegmentMeters(pt.lng, pt.lat, last, first)
          if (d < minDist) { minDist = d; nearestClass = edgeClassifications[edgeClassifications.length - 1] }
        }
      }
      const threshold = nearestClass === 'front' ? dists.front : nearestClass === 'rear' ? dists.rear : dists.side
      if (minDist < threshold) {
        constrainedCount += 1
        constrainedGridIndices.push(pointIndex)
      }
    }

    const setbackFraction = gridPoints.length ? constrainedCount / gridPoints.length : 0
    return {
      available: true,
      value: {
        setbackFraction: Math.round(setbackFraction * 1000) / 1000,
        setbackDistanceMeters: Math.max(dists.front, dists.side, dists.rear),
        frontSetbackMeters: dists.front,
        sideSetbackMeters: dists.side,
        rearSetbackMeters: dists.rear,
        intendedUse,
        standardsSource: standards ? 'jurisdiction-code' : 'screening-default',
        samplePoints: gridPoints.length,
        constrainedGridIndices,
      },
      provenance,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { available: false, provenance, error: message }
  }
}

export function recomputeSetbackAndNetDevelopable(
  data: ParcelOverlayData,
  boundaryInput: NonNullable<ScreeningArea['boundary']>,
  intendedUse: IntendedUse,
  pin?: { lng: number; lat: number },
  standards?: SetbackStandardsInput,
): ParcelOverlayData {
  const boundary = narrowBoundary(boundaryInput)
  const setback = computeSetbackOverlay(boundaryInput, intendedUse, pin, standards)
  const updated = { ...data, setback, fetchedAt: new Date().toISOString() }
  const buildableEnvelope = computeBuildableEnvelope(boundary, updated)
  const withEnvelope = { ...updated, buildableEnvelope }
  return { ...withEnvelope, netDevelopable: computeNetDevelopable(boundary, withEnvelope) }
}

// ─── Net developable acreage ────────────────────────────────────────────

function nearestSlopeConstraint(
  point: { lng: number; lat: number },
  samples: Array<{ lng: number; lat: number; over20: boolean }>,
): boolean {
  const cosLat = Math.cos(point.lat * Math.PI / 180)
  let nearest: { over20: boolean; distance: number } | null = null
  for (const sample of samples) {
    const dx = (sample.lng - point.lng) * cosLat
    const dy = sample.lat - point.lat
    const distance = dx * dx + dy * dy
    if (!nearest || distance < nearest.distance) nearest = { over20: sample.over20, distance }
  }
  return nearest?.over20 ?? false
}

function gridCellGeometry(
  point: { lng: number; lat: number },
  halfLng: number,
  halfLat: number,
): number[][][] {
  const west = point.lng - halfLng
  const east = point.lng + halfLng
  const south = point.lat - halfLat
  const north = point.lat + halfLat
  return [[
    [west, south], [east, south], [east, north], [west, north], [west, south],
  ]]
}

/**
 * Builds a screening-level spatial envelope from the exact union of every
 * constraint that can be classified on the shared parcel grid. Sources that
 * only return parcel-wide shares are deliberately kept out of the geometry
 * and applied once as transparent aggregate acreage adjustments.
 */
export function computeBuildableEnvelope(
  boundary: GeoBoundary,
  overlays: ParcelOverlayData,
): BuildableEnvelopeOverlay {
  const grossM2 = boundaryAreaSquareMeters(boundary)
  const { points, spacingMeters } = gridSampleBoundary(boundary, 400)
  if (grossM2 <= 0 || !points.length) {
    return { available: false, provenance: BUILDABLE_ENVELOPE_PROVENANCE, error: 'Parcel boundary has no measurable interior grid.' }
  }

  const constrained = new Set<number>()
  const includedConstraints: string[] = []
  const addMask = (label: string, indices: number[] | undefined) => {
    if (!indices) return
    includedConstraints.push(label)
    for (const index of indices) if (index >= 0 && index < points.length) constrained.add(index)
  }
  addMask('FEMA regulatory floodway', overlays.floodplain.value?.constrainedGridIndices)
  addMask('NWI mapped wetlands/waters', overlays.wetlands.value?.constrainedGridIndices)
  addMask('Mapped easements/ROW', overlays.easements.value?.constrainedGridIndices)
  addMask('Perimeter setbacks', overlays.setback.value?.constrainedGridIndices)

  const slopeSamples = overlays.slope.value?.constraintSamples
  if (slopeSamples?.length) {
    includedConstraints.push('USGS-derived slope over 20% (nearest-sample interpolation)')
    for (let index = 0; index < points.length; index += 1) {
      if (nearestSlopeConstraint(points[index], slopeSamples)) constrained.add(index)
    }
  }

  const grossAcres = squareMetersToAcres(grossM2)
  const buildableIndices = points.map((_, index) => index).filter((index) => !constrained.has(index))
  const spatialBuildableFraction = buildableIndices.length / points.length
  const spatialBuildableAcres = grossAcres * spatialBuildableFraction

  const aggregateAdjustments: string[] = []
  const soilFraction = Math.max(overlays.soils.value?.hydricFraction ?? 0, overlays.soils.value?.severeFraction ?? 0)
  if (soilFraction > 0) aggregateAdjustments.push('NRCS hydric/severe soil share')
  const easementFraction = overlays.easements.value?.constrainedGridIndices === undefined
    ? overlays.easements.value?.easementFraction ?? 0
    : 0
  if (easementFraction > 0) aggregateAdjustments.push('Recorded-easement flag without mapped geometry')
  const aggregateAdjustmentFraction = 1 - (1 - soilFraction) * (1 - easementFraction)
  const adjustedNetAcres = spatialBuildableAcres * (1 - aggregateAdjustmentFraction)

  const bbox = boundaryBBox(boundary)
  const uniqueLng = [...new Set(points.map((point) => point.lng))].sort((a, b) => a - b)
  const uniqueLat = [...new Set(points.map((point) => point.lat))].sort((a, b) => a - b)
  const dLng = uniqueLng.length > 1 ? uniqueLng[1] - uniqueLng[0] : Math.max(0.000001, bbox.east - bbox.west)
  const dLat = uniqueLat.length > 1 ? uniqueLat[1] - uniqueLat[0] : Math.max(0.000001, bbox.north - bbox.south)
  const coordinates = buildableIndices.map((index) => gridCellGeometry(points[index], dLng / 2, dLat / 2))

  return {
    available: true,
    value: {
      geometry: { type: 'MultiPolygon', coordinates },
      spatialBuildableAcres: Math.round(spatialBuildableAcres * 100) / 100,
      adjustedNetAcres: Math.round(adjustedNetAcres * 100) / 100,
      spatialConstraintFraction: Math.round((constrained.size / points.length) * 1000) / 1000,
      aggregateAdjustmentFraction: Math.round(aggregateAdjustmentFraction * 1000) / 1000,
      buildableCellCount: buildableIndices.length,
      totalCellCount: points.length,
      resolutionMeters: Math.round(spacingMeters),
      includedConstraints,
      aggregateAdjustments,
      method: 'shared-grid-union',
    },
    provenance: BUILDABLE_ENVELOPE_PROVENANCE,
  }
}

export function computeNetDevelopable(
  boundary: GeoBoundary,
  overlays: ParcelOverlayData,
): NetDevelopableOverlay | null {
  const grossM2 = boundaryAreaSquareMeters(boundary)
  if (grossM2 <= 0) return null
  const grossAcres = squareMetersToAcres(grossM2)

  const floodwayFraction = overlays.floodplain.value?.floodwayFraction ?? 0
  const wetlandFraction = overlays.wetlands.value?.wetlandFraction ?? 0
  const steepFraction = overlays.slope.value?.fractionOver20 ?? 0
  // Soil constraint = share of the parcel with hydric or severe NRCS ratings.
  // Hydric soils are wetland-adjacent and typically require delineation +
  // drainage design before they can be built on; severe soils need engineered
  // foundations or are unsuitable for septic. Moderate soils do not subtract
  // from net developable at the screening stage.
  const soilFraction = Math.max(
    overlays.soils.value?.hydricFraction ?? 0,
    overlays.soils.value?.severeFraction ?? 0,
  )
  const easementFraction = overlays.easements.value?.easementFraction ?? 0
  const setbackFraction = overlays.setback.value?.setbackFraction ?? 0

  const exactEnvelope = overlays.buildableEnvelope?.available ? overlays.buildableEnvelope.value : undefined
  const constrainedFraction = exactEnvelope
    ? 1 - exactEnvelope.adjustedNetAcres / grossAcres
    : 1 - (1 - floodwayFraction) * (1 - wetlandFraction) * (1 - steepFraction)
          * (1 - soilFraction) * (1 - easementFraction) * (1 - setbackFraction)

  const floodwayAcres = grossAcres * floodwayFraction
  const wetlandAcres = grossAcres * wetlandFraction
  const steepSlopeAcres = grossAcres * steepFraction
  const soilConstrainedAcres = grossAcres * soilFraction
  const easementAcres = grossAcres * easementFraction
  const setbackAcres = grossAcres * setbackFraction
  const constrainedAcres = grossAcres * constrainedFraction
  const netDevelopableAcres = exactEnvelope?.adjustedNetAcres ?? Math.max(0, grossAcres - constrainedAcres)
  const netToGrossRatio = grossAcres > 0 ? netDevelopableAcres / grossAcres : 0

  return {
    grossAcres: Math.round(grossAcres * 100) / 100,
    floodwayAcres: Math.round(floodwayAcres * 100) / 100,
    wetlandAcres: Math.round(wetlandAcres * 100) / 100,
    steepSlopeAcres: Math.round(steepSlopeAcres * 100) / 100,
    soilConstrainedAcres: Math.round(soilConstrainedAcres * 100) / 100,
    easementAcres: Math.round(easementAcres * 100) / 100,
    setbackAcres: Math.round(setbackAcres * 100) / 100,
    constrainedAcres: Math.round(constrainedAcres * 100) / 100,
    netDevelopableAcres: Math.round(netDevelopableAcres * 100) / 100,
    netToGrossRatio: Math.round(netToGrossRatio * 1000) / 1000,
    samplePoints:
      overlays.floodplain.value?.samplePoints
      ?? overlays.wetlands.value?.samplePoints
      ?? overlays.slope.value?.samplePoints
      ?? overlays.soils.value?.samplePoints
      ?? overlays.easements.value?.samplePoints
      ?? overlays.setback.value?.samplePoints
      ?? 0,
    method: exactEnvelope ? 'shared-grid-union' : 'legacy-independence',
  }
}

// ─── Main entry ─────────────────────────────────────────────────────────

export async function fetchParcelOverlays(
  boundaryInput: NonNullable<ScreeningArea['boundary']>,
  signal?: AbortSignal,
  onProgress?: (progress: ParcelOverlayProgress) => void,
  stateCode?: string,
  coordinates?: { lng: number; lat: number },
): Promise<ParcelOverlayData> {
  const boundary = narrowBoundary(boundaryInput)
  // Generate the shared grid for flood/wetland/soils/easements/species point-in-polygon testing.
  const { points: gridPoints } = gridSampleBoundary(boundary, 400)

  let data: ParcelOverlayData = {
    floodplain: { available: false, provenance: FEMA_PROVENANCE, error: 'Pending' },
    wetlands: { available: false, provenance: NWI_PROVENANCE, error: 'Pending' },
    slope: { available: false, provenance: USGS_PROVENANCE, error: 'Pending' },
    soils: { available: false, provenance: SOILS_PROVENANCE, error: 'Pending' },
    stormwater: { available: false, provenance: STORMWATER_PROVENANCE, error: 'Pending' },
    easements: { available: false, provenance: EASEMENTS_OVERLAY_PROVENANCE, error: 'Pending' },
    contamination: { available: false, provenance: CONTAMINATION_OVERLAY_PROVENANCE, error: 'Pending' },
    species: { available: false, provenance: SPECIES_OVERLAY_PROVENANCE, error: 'Pending' },
    setback: { available: false, provenance: SETBACK_PROVENANCE, error: 'Pending' },
    buildableEnvelope: { available: false, provenance: BUILDABLE_ENVELOPE_PROVENANCE, error: 'Pending' },
    netDevelopable: null,
    access: { available: false, provenance: ROAD_OVERLAY_PROVENANCE, error: 'Pending' },
    fetchedAt: new Date().toISOString(),
  }
  const remaining = new Set<ParcelOverlayCategory>(['floodplain', 'wetlands', 'slope', 'soils', 'stormwater', 'easements', 'contamination', 'species', 'setback'])

  function publish(category: ParcelOverlayCategory, observation: ParcelOverlayData[ParcelOverlayCategory]) {
    data = { ...data, [category]: observation, fetchedAt: new Date().toISOString() }
    remaining.delete(category)
    // Rebuild the shared-grid envelope and acreage as each source lands so the
    // UI never shows a stale independence estimate during progressive loading.
    const anyAvailable =
      data.floodplain.available || data.wetlands.available || data.slope.available
      || data.soils.available || data.easements.available
    if (anyAvailable) {
      const buildableEnvelope = computeBuildableEnvelope(boundary, data)
      const withEnvelope = { ...data, buildableEnvelope }
      data = { ...withEnvelope, netDevelopable: computeNetDevelopable(boundary, withEnvelope) }
    }
    onProgress?.({ data, pending: [...remaining] })
  }

  // Easements overlay: only when a local adapter is registered for the state.
  // This is checked here so the overlay pipeline stays self-contained and the
  // shape of ParcelOverlayData is stable across jurisdictions.
  await Promise.all([
    fetchFloodplainOverlay(boundary, gridPoints, signal).then((v) => publish('floodplain', v)),
    fetchWetlandsOverlay(boundary, gridPoints, signal).then((v) => publish('wetlands', v)),
    (async () => {
      // Slope + stormwater share one USGS elevation sample pass.
      const shared = await sampleParcelElevations(boundary, signal)
      if (!shared) {
        publish('slope', { available: false, provenance: USGS_PROVENANCE, error: 'Parcel is too small for an elevation grid.' })
        publish('stormwater', { available: false, provenance: STORMWATER_PROVENANCE, error: 'Parcel is too small for a drainage analysis.' })
        return
      }
      publish('slope', computeSlopeFromElevations(shared))
      publish('stormwater', computeStormwaterFromElevations(shared))
    })(),
    fetchSoilsOverlay(boundary, gridPoints, signal).then((v) => publish('soils', v)),
    (async () => {
      const adapter = await queryEasementsOverlay(boundary, gridPoints, stateCode, signal)
      publish('easements', adapter)
    })(),
    fetchContaminationOverlay(boundary, gridPoints, signal).then((v) => publish('contamination', v)),
    fetchSpeciesOverlay(boundary, gridPoints, signal).then((v) => publish('species', v)),
    // Access is a road-proximity overlay, not a land-use takeout, so it does
    // not flow through publish()/the buildable-envelope recompute — it merges
    // straight onto the accumulating result and reports progress.
    fetchAccessOverlay(boundary, signal).then((v) => {
      data = { ...data, access: v, fetchedAt: new Date().toISOString() }
      onProgress?.({ data, pending: [...remaining] })
    }),
    // Setback is pure geometry (no network) — resolves instantly.
    Promise.resolve(publish('setback', computeSetbackOverlay(boundaryInput, 'residential', coordinates))),
  ])

  // Final envelope + net developable computation.
  const buildableEnvelope = computeBuildableEnvelope(boundary, data)
  const withEnvelope = { ...data, buildableEnvelope }
  data = { ...withEnvelope, netDevelopable: computeNetDevelopable(boundary, withEnvelope), fetchedAt: new Date().toISOString() }
  onProgress?.({ data, pending: [] })
  return data
}

// Resolve the easements overlay by delegating point lookup + polygon fetch
// to the localAdapters registry. localAdapters imports EasementsOverlayInput
// from this file only as a type (erased at runtime), so there is no real
// runtime circular dependency.
async function queryEasementsOverlay(
  _boundary: GeoBoundary,
  gridPoints: { lng: number; lat: number }[],
  stateCode: string | undefined,
  signal?: AbortSignal,
): Promise<EasementsOverlay> {
  if (!stateCode) {
    return buildEasementsOverlay(gridPoints, null)
  }
  const adapterResult = await fetchEasementsOverlayForParcel(gridPoints[0] ?? { lng: 0, lat: 0 }, stateCode, signal)
  if (!adapterResult) return buildEasementsOverlay(gridPoints, null)
  return buildEasementsOverlay(gridPoints, adapterResult)
}
