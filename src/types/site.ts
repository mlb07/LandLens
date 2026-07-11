export type TriState = 'yes' | 'no' | 'unknown'
export type IntendedUse = 'residential' | 'commercial' | 'mixed-use' | 'industrial' | 'other'
export type ProposedUseId = string
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
  proposedUse?: ProposedUseId
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

export interface NationalContextFinding {
  id: 'drinking-water' | 'wastewater' | 'broadband' | 'protected-lands' | 'rail'
  label: string
  status: 'mapped' | 'not-mapped' | 'reference-only' | 'unavailable'
  summary: string
  detail: string
  provenance?: DataProvenance
  actionUrl?: string
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
  nationalContext?: NationalContextFinding[]
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
  parcel?: ParcelSnapshot
  authority?: JurisdictionAuthority
  jurisdiction?: JurisdictionProfile
  buildableEnvelope?: BuildableEnvelopeSnapshot
  createdAt: string
  updatedAt: string
}

export interface BuildableEnvelopeSnapshot {
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
  provenance?: DataProvenance
}

export type JurisdictionUseStatus = 'likely-compatible' | 'conditional-review' | 'likely-incompatible' | 'unresolved'

export interface JurisdictionOverlay {
  name: string
  detail?: string
  layerId: number
}

export interface DimensionalStandards {
  district: string
  minimumLotSquareFeet?: number
  minimumLotWidthFeet?: number
  maximumHeightFeet?: number
  frontSetbackFeet?: number
  streetSideSetbackFeet?: number
  interiorSideSetbackFeet?: number
  rearSetbackFeet?: number
  maximumBuildingCoveragePercent?: number
  maximumImperviousCoverPercent?: number
  maximumFloorAreaRatio?: number
  sourceSection: string
  sourceUrl?: string
  notes: string[]
}

export interface JurisdictionSource {
  id: string
  label: string
  url: string
  role: 'authority' | 'zoning' | 'overlays' | 'future-land-use' | 'standards' | 'permitted-uses' | 'other'
}

export interface JurisdictionAuthority {
  authorityName: string
  authorityType: 'incorporated-place' | 'county-subdivision' | 'county' | 'unresolved'
  incorporatedPlace?: string
  countySubdivision?: string
  countyName?: string
  stateName?: string
  stateCode: string
  geoid?: string
  sourceVintage: string
  coverageNote: string
  resolvedAt: string
}

export type ProposedUseStatus = 'permitted' | 'conditional' | 'prohibited' | 'special-review' | 'unresolved'

export interface ProposedUseDefinition {
  key: ProposedUseId
  label: string
  codeLabel: string
  group: string
  intendedUse: IntendedUse
}

export interface ProposedUseAssessment {
  proposedUse: ProposedUseId
  useLabel: string
  district: string
  status: ProposedUseStatus
  statusLabel: string
  rawCell?: string
  sourceSection: string
  requiresCombiningDistrictReview: boolean
  requiresOverlayReview: boolean
  explanation: string
}

export interface JurisdictionProfile {
  profileId: string
  packId?: string
  profileLabel?: string
  profileDescription?: string
  authorityName: string
  jurisdictionLabel: string
  jurisdictionType: string
  jurisdictionCode?: string
  zoningCode: string
  baseDistrict: string
  standardsApply: boolean
  standards?: DimensionalStandards
  overlays: JurisdictionOverlay[]
  futureLandUse?: string
  useCompatibility: Record<IntendedUse, JurisdictionUseStatus>
  reviewFlags: string[]
  sources?: JurisdictionSource[]
  verifiedAt: string
}

export interface ParcelFacts {
  situsAddress?: string
  county?: string
  municipality?: string
  propertyUseCode?: string
  propertyUseDescription?: string
  propertyClass?: string
  landStatus?: string
  planningAreaDescription?: string
  zoning?: string
  zoningConditions?: string
  legalDescription?: string
  subdivision?: string
  deedReference?: string
  platReference?: string
  recordedDate?: string
  marketValue?: number
  marketLandValue?: number
  marketImprovementValue?: number
  appraisedValue?: number
  appraisedLandValue?: number
  appraisedImprovementValue?: number
  assessedTotalValue?: number
  assessedLandValue?: number
  assessedImprovementValue?: number
  assessedOtherValue?: number
  taxableValue?: number
  taxAmount?: number
  lastSalePrice?: number
  lastSaleDate?: string
  saleQualification?: string
  taxYear?: string
  yearBuilt?: number
  effectiveYearBuilt?: number
  buildingDescription?: string
  buildingQuality?: string
  buildingCount?: number
  buildingAreaSqFt?: number
  livingAreaSqFt?: number
  lotAreaSqFt?: number
  garageAreaSqFt?: number
  carportAreaSqFt?: number
  stories?: number
  unitCount?: number
  roomCount?: number
  bedroomCount?: number
  bathroomCount?: number
  halfBathroomCount?: number
  fireplaceCount?: number
  poolDescription?: string
  frontageFeet?: number
  depthFeet?: number
  waterService?: string
  sewerService?: string
  utilities?: string
  accessDescription?: string
  irrigationDescription?: string
  waterfrontDescription?: string
  permitDescription?: string
  criticalAreaDescription?: string
  percTestArea?: number
  agriculturalAcres?: number
  agriculturalPreservationAcres?: number
  croplandAcres?: number
  forestAcres?: number
  grazingAcres?: number
  irrigatedAcres?: number
  forestPercent?: number
  recordUrl?: string
}

export interface ParcelSnapshot {
  id: string
  acres?: number
  acreageKind?: 'assessor' | 'mapped'
  facts?: ParcelFacts
  provenance?: DataProvenance
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
  facts?: ParcelFacts
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
