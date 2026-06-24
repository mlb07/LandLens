export type TriState = 'yes' | 'no' | 'unknown'
export type IntendedUse = 'residential' | 'commercial' | 'mixed-use' | 'industrial' | 'other'
export type DataStatus = 'official' | 'user' | 'unknown' | 'mock'
export type VerdictTone = 'strong' | 'interesting' | 'research' | 'weak' | 'manual'

export interface Coordinates {
  lat: number
  lng: number
}

export interface SiteInputs {
  name: string
  acres: string
  location: string
  estimatedPrice: string
  intendedUse: IntendedUse
  roadFrontage: TriState
  utilitiesNearby: TriState
  zoningNotes: string
  notes: string
}

// Thirteen weighted core categories (weights sum to 100). Order matches the
// project scoring framework. Unimplemented categories are shown as
// unavailable or user-supplied and excluded from the weighted calc until a
// real source is wired — never fabricated.
export type ScoreCategory =
  | 'zoning'          // 12  zoning & entitlement fit
  | 'netDevelopable'  //  9  net developable acreage & theoretical yield
  | 'floodplain'      // 10  FEMA floodplain & floodway
  | 'wetlands'        // 10  NWI wetlands, waters & buffers
  | 'slope'           //  8  USGS slope, relief & buildable pad area
  | 'utilities'       // 10  utility availability & likely capacity
  | 'access'          //  7  access, frontage & roadway context
  | 'soils'           //  8  NRCS soils & geotechnical suitability
  | 'stormwater'      //  7  stormwater & outfall feasibility
  | 'easements'       //  5  easements, encumbrances & ROW dedication risk
  | 'contamination'   //  5  environmental contamination & prior use
  | 'species'         //  4  species, critical habitat & historic/cultural
  | 'market'          //  5  market support & absorption context

export interface DataProvenance {
  source: string
  sourceUrl: string
  vintage?: string
  coverageNote?: string
}

export interface MetricResult {
  category: ScoreCategory
  label: string
  score: number | null
  weight: number
  summary: string
  detail: string
  displayValue: string
  status: DataStatus
  provenance?: DataProvenance
}

// A hard gate is a condition serious enough to send the parcel straight to
// manual diligence regardless of the weighted score. The numeric score is
// still computed for transparency but the verdict becomes "Manual diligence
// required" and the gate reason is shown prominently.
export interface HardGate {
  id: string
  label: string
  reason: string
  triggered: boolean
}

export interface SiteAnalysis {
  finalScore: number | null
  rawScore: number | null
  scoredWeight: number
  verdict: string
  verdictTone: VerdictTone
  confidence: number
  confidenceLabel: string
  confidencePenalty: number
  regionalHazardModifier: number
  hardGates: HardGate[]
  gatedToManual: boolean
  metrics: Record<ScoreCategory, MetricResult>
  strengths: string[]
  redFlags: string[]
  unknowns: string[]
  nextSteps: string[]
}

export interface SavedSite {
  id: string
  stateCode: string
  coordinates: Coordinates
  inputs: SiteInputs
  analysis: SiteAnalysis
  screeningArea?: ScreeningArea
  createdAt: string
  updatedAt: string
}

export interface ScreeningArea {
  kind: 'point' | 'parcel' | 'custom'
  provider?: string
  boundary?: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

export interface ParcelSelection {
  status: 'found' | 'none' | 'unsupported' | 'error'
  message: string
  id?: string
  name?: string
  acres?: number
  acreageKind?: 'assessor' | 'mapped'
  boundary?: ScreeningArea['boundary']
  provenance?: DataProvenance
}

export const EMPTY_SITE_INPUTS: SiteInputs = {
  name: '',
  acres: '',
  location: '',
  estimatedPrice: '',
  intendedUse: 'residential',
  roadFrontage: 'unknown',
  utilitiesNearby: 'unknown',
  zoningNotes: '',
  notes: '',
}
