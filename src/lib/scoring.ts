import type { OfficialSiteData } from '../data/officialDataProvider'
import type { ParcelOverlayData, SoilsOverlay, StormwaterOverlay, EasementsOverlay, ContaminationOverlay, SpeciesOverlay } from '../data/parcelOverlayProvider'
import type { RegionalHazardData } from '../data/regionalHazardProvider'
import type { Coordinates, HardGate, IntendedUse, MetricResult, ParcelSelection, ScoreCategory, SiteAnalysis, SiteInputs, VerdictTone } from '../types/site'

// Core weighted categories — weights sum to 100. See docs/PROJECT_RECORD.md.
export const CATEGORY_WEIGHTS: Record<ScoreCategory, number> = {
  zoning: 12,
  netDevelopable: 9,
  floodplain: 10,
  wetlands: 10,
  slope: 8,
  utilities: 10,
  access: 7,
  soils: 8,
  stormwater: 7,
  easements: 5,
  contamination: 5,
  species: 4,
  market: 5,
}

export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  zoning: 'Zoning & entitlement fit',
  netDevelopable: 'Net developable acreage',
  floodplain: 'Floodplain & floodway',
  wetlands: 'Wetlands, waters & buffers',
  slope: 'Slope, relief & pad area',
  utilities: 'Utilities availability',
  access: 'Access, frontage & roadway',
  soils: 'Soils & geotech suitability',
  stormwater: 'Stormwater & outfall',
  easements: 'Easements & title risk',
  contamination: 'Environmental contamination',
  species: 'Species & historic constraints',
  market: 'Market support & absorption',
}

// Conservative screening floors for "minimum viable yield" gate by intended
// use (acres). These are intentionally low so the gate fires only on sites
// that are almost certainly too small for the product. Local code overrides.
const MIN_VIABLE_ACRES: Record<IntendedUse, number> = {
  residential: 0.15,
  commercial: 0.5,
  'mixed-use': 0.5,
  industrial: 1,
  other: 0.15,
}

const VERDICT_BANDS: Array<{ min: number; verdict: string; tone: VerdictTone }> = [
  { min: 85, verdict: 'Strong shortlist candidate', tone: 'strong' },
  { min: 70, verdict: 'Viable — needs targeted diligence', tone: 'interesting' },
  { min: 50, verdict: 'Challenged — only if pricing/assemblage is exceptional', tone: 'research' },
  { min: 0, verdict: 'Low priority / likely reject', tone: 'weak' },
]

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function missingMetric(category: ScoreCategory, detail: string, provenance?: MetricResult['provenance']): MetricResult {
  return {
    category,
    label: CATEGORY_LABELS[category],
    score: null,
    weight: CATEGORY_WEIGHTS[category],
    displayValue: 'Unavailable',
    status: 'unknown',
    summary: 'No official source is wired for this category yet.',
    detail,
    provenance,
  }
}

function userMetric(category: ScoreCategory, score: number, displayValue: string, summary: string, detail: string): MetricResult {
  return {
    category,
    label: CATEGORY_LABELS[category],
    score,
    weight: CATEGORY_WEIGHTS[category],
    displayValue,
    status: 'user',
    summary,
    detail,
  }
}

// ---------- Per-category metric builders ----------

function zoningMetric(inputs: SiteInputs, official?: OfficialSiteData['zoning'], parcel?: ParcelSelection): MetricResult {
  const notes = inputs.zoningNotes.trim()
  const mappedZoning = official?.available && official.value
    ? { code: official.value.zoningCode || official.value.baseDistrict || 'Unlabeled district', base: official.value.baseDistrict || official.value.zoningCode || 'Unlabeled district', jurisdiction: official.value.jurisdiction, provenance: official.provenance }
    : parcel?.facts?.zoning
      ? { code: parcel.facts.zoning, base: parcel.facts.zoning, jurisdiction: parcel.facts.municipality || parcel.facts.county || 'parcel jurisdiction', provenance: parcel.provenance }
      : undefined
  if (mappedZoning) {
    const { code, base, jurisdiction, provenance } = mappedZoning
    const residential = /^(SF|MF|RM|MH|P)/i.test(base)
    const commercial = /^(CS|CH|GR|LR|GO|LO|NO|CR|CBD|DMU|MU)/i.test(base)
    const industrial = /^(LI|IP|MI)/i.test(base)
    const mixed = /^(MU|DMU|CS-MU|GR-MU)/i.test(base)
    const recognizedDistrictFamily = residential || commercial || industrial || mixed
    const likelyCompatible = inputs.intendedUse === 'residential' ? (residential || mixed)
      : inputs.intendedUse === 'commercial' ? (commercial || mixed)
        : inputs.intendedUse === 'mixed-use' ? mixed
          : inputs.intendedUse === 'industrial' ? industrial
            : true
    const score = !recognizedDistrictFamily ? 58 : likelyCompatible ? 72 : 32
    const userWarning = /\b(prohibit\w*|not allow\w*|not permit\w*)/i.test(notes)
    return {
      category: 'zoning', label: CATEGORY_LABELS.zoning, score: userWarning ? 15 : score, weight: CATEGORY_WEIGHTS.zoning,
      status: 'official', provenance,
      displayValue: `${code} · ${jurisdiction}`,
      summary: userWarning ? 'Your zoning note says the intended use is likely prohibited.' : !recognizedDistrictFamily ? `The mapped ${code} district uses a local code LandLens does not interpret automatically.` : likelyCompatible ? `The mapped ${code} district is a preliminary match for ${inputs.intendedUse.replace('-', ' ')} use.` : `The mapped ${code} district is not an obvious preliminary match for ${inputs.intendedUse.replace('-', ' ')} use.`,
      detail: `Official mapped zoning result: ${code} (base district ${base}). LandLens uses a conservative district-family screen, not a legal use determination. Overlay districts, conditional-use rules, compatibility, parking, impervious-cover limits, subdivision plats, and adopted municipal code can change the outcome. Confirm by-right status with ${jurisdiction}.${notes ? ' Your supplied zoning note is retained as additional context.' : ''}`,
    }
  }
  if (!notes) {
    return missingMetric(
      'zoning',
      'Zoning and entitlement fit need the local zoning atlas or your notes. Without verified zoning, LandLens cannot tell whether the intended use is permitted by-right, conditional, or prohibited.',
    )
  }
  const prohibited = /\b(prohibit\w*|not allow\w*|not permit\w*|no build|restricted use)/i.test(notes)
  const conditional = /\b(conditional|special exception|special use|variance|rezon\w*|comp plan|comprehensive plan)/i.test(notes)
  const byRight = /\b(by[- ]?right|permit\w*|allow\w*|legal use|conforming)/i.test(notes)
  const score = prohibited ? 15 : conditional ? 50 : byRight ? 88 : 62
  const display = prohibited ? 'Likely prohibited' : conditional ? 'Conditional / rezoning likely' : byRight ? 'By-right (user-reported)' : 'Zoning notes provided'
  return userMetric(
    'zoning', score, display,
    prohibited ? 'Your zoning notes suggest the use may be prohibited.' : conditional ? 'Your notes indicate a conditional use or rezoning may be required.' : byRight ? 'Your notes say the use is permitted by-right.' : 'You provided zoning notes; verify by-right status with the jurisdiction.',
    'This is your unverified note. Official local zoning atlases and the municipal code are the binding source. By-right is strongest; conditional use is slower; rezoning is materially riskier; prohibited is a hard fail to manual diligence.',
  )
}

function netDevelopableMetric(inputs: SiteInputs, hasParcelBoundary: boolean, overlays?: ParcelOverlayData | null): MetricResult {
  // When parcel overlays are available, use the computed net developable.
  if (overlays?.netDevelopable) {
    const nd = overlays.netDevelopable
    const ratio = nd.netToGrossRatio
    const score = ratio >= 0.85 ? 92 : ratio >= 0.70 ? 82 : ratio >= 0.50 ? 62 : ratio >= 0.35 ? 40 : 20
    const subtractedSoils = nd.soilConstrainedAcres > 0
    const subtractedEasements = nd.easementAcres > 0
    const subtractedSetbacks = nd.setbackAcres > 0
    const breakdown = `Gross ${nd.grossAcres} ac minus floodway ${nd.floodwayAcres} ac, wetlands ${nd.wetlandAcres} ac, steep slope (>20%) ${nd.steepSlopeAcres} ac${subtractedSoils ? `, hydric/severe soils ${nd.soilConstrainedAcres} ac` : ''}${subtractedEasements ? `, mapped easements/ROW ${nd.easementAcres} ac` : ''}${subtractedSetbacks ? `, perimeter setbacks ${nd.setbackAcres} ac` : ''} = constrained ${nd.constrainedAcres} ac. Net developable ${nd.netDevelopableAcres} ac. Based on ${nd.samplePoints} grid sample points. Setbacks use conservative US-default distances by intended use; verify with the local zoning ordinance.`
    return {
      category: 'netDevelopable', label: CATEGORY_LABELS.netDevelopable, score, weight: CATEGORY_WEIGHTS.netDevelopable,
      status: 'official', provenance: { source: 'Parcel overlay calculation', sourceUrl: '#', vintage: 'Computed from FEMA, NWI, USGS, NRCS soils, local easements, and perimeter setback overlays', coverageNote: `Net developable is gross acres minus the union of floodway, wetlands, steep slope (>20%), hydric/severe soils${subtractedEasements ? ', recorded easements' : ''}, and perimeter setbacks. Setback distances are conservative US defaults by intended use; local zoning ordinances may differ.` },
      displayValue: `${nd.netDevelopableAcres} net / ${nd.grossAcres} gross`,
      summary: ratio >= 0.70 ? `Net developable ratio is ${Math.round(ratio * 100)}% — strong.` : ratio >= 0.50 ? `Net developable ratio is ${Math.round(ratio * 100)}% — workable but constrained.` : `Net developable ratio is ${Math.round(ratio * 100)}% — heavily constrained.`,
      detail: breakdown,
    }
  }
  // Fall back to gross-acreage user input.
  const acres = Number(inputs.acres)
  if (!inputs.acres || !Number.isFinite(acres) || acres <= 0) {
    return missingMetric(
      'netDevelopable',
      hasParcelBoundary
        ? 'A parcel boundary is loaded. Parcel-wide overlays are still running or unavailable. Enter the assessor acreage for a gross placeholder.'
        : 'Net developable acreage needs the parcel boundary plus parcel-wide overlays. Enter the assessor acreage for a rough placeholder reading.',
    )
  }
  let score = acres >= 20 ? 92 : acres >= 10 ? 85 : acres >= 5 ? 78 : acres >= 2 ? 68 : acres >= 1 ? 58 : acres >= 0.5 ? 45 : 30
  if (inputs.intendedUse === 'industrial' && acres < 2) score = Math.min(score, 35)
  if (inputs.intendedUse === 'commercial' && acres < 0.5) score = Math.min(score, 35)
  return userMetric(
    'netDevelopable', score, `${acres} acres (gross)`,
    'Gross acreage from your input — net developable is lower once floodplain, wetlands, steep slope, hydric/severe soils, and easements are subtracted.',
    'This is a gross-acreage placeholder. True net developable acreage requires parcel-wide FEMA, NWI, slope, soil, and easement overlays.',
  )
}

function floodplainMetric(data: OfficialSiteData['flood'] | undefined, overlay?: ParcelOverlayData['floodplain']): MetricResult {
  // Prefer parcel-wide overlay when available.
  if (overlay?.available && overlay.value) {
    const v = overlay.value
    const score = v.floodwayFraction > 0 ? 5 : v.sfhaFraction > 0.25 ? 20 : v.sfhaFraction > 0 ? 45 : v.risk === 'Undetermined' ? 50 : 90
    const pct = (frac: number) => `${Math.round(frac * 100)}%`
    return {
      category: 'floodplain', label: CATEGORY_LABELS.floodplain, score, weight: CATEGORY_WEIGHTS.floodplain,
      status: 'official', provenance: overlay.provenance,
      displayValue: `${v.zoneSummary} · SFHA ${pct(v.sfhaFraction)} · floodway ${pct(v.floodwayFraction)}`,
      summary: v.floodwayFraction > 0 ? `${pct(v.floodwayFraction)} of the parcel is in a regulatory floodway.` : v.sfhaFraction > 0 ? `${pct(v.sfhaFraction)} of the parcel is in a Special Flood Hazard Area.` : 'No FEMA flood hazard intersects the parcel.',
      detail: `Parcel-wide overlay across ${v.samplePoints} grid points. Zone summary: ${v.zoneSummary}. FEMA mapping does not replace an elevation certificate, drainage study, or local floodplain review.`,
    }
  }
  // Fall back to point-based result.
  if (!data?.available || !data.value) {
    return missingMetric(
      'floodplain',
      'No floodplain score is inferred when FEMA coverage or the live service is unavailable. Check the FEMA map manually and evaluate the entire parcel.',
      data?.provenance,
    )
  }
  const { risk, zone } = data.value
  const score = risk === 'Floodway' ? 5 : risk === 'High' ? 25 : risk === 'Moderate' ? 58 : risk === 'Undetermined' ? 45 : 90
  return {
    category: 'floodplain', label: CATEGORY_LABELS.floodplain, score, weight: CATEGORY_WEIGHTS.floodplain,
    status: 'official', provenance: data.provenance,
    displayValue: `FEMA ${zone} · ${risk} (point)`,
    summary: risk === 'Low' ? 'The selected point is in a mapped minimal-hazard zone.' : risk === 'Moderate' ? 'The selected point has a mapped moderate flood hazard.' : risk === 'Floodway' ? 'The selected point intersects a mapped regulatory floodway.' : risk === 'High' ? 'The selected point is in a Special Flood Hazard Area.' : 'FEMA identifies an undetermined flood hazard at this point.',
    detail: `${data.value.subtype || 'No FEMA zone subtype was supplied.'} This is a point result, not a parcel-wide floodplain calculation. FEMA mapping does not replace an elevation certificate, drainage study, or local floodplain review.`,
  }
}

function wetlandsMetric(data: OfficialSiteData['environmental'] | undefined, overlay?: ParcelOverlayData['wetlands']): MetricResult {
  // Prefer parcel-wide overlay when available.
  if (overlay?.available && overlay.value) {
    const v = overlay.value
    const score = v.wetlandFraction > 0.25 ? 15 : v.wetlandFraction > 0.10 ? 40 : v.wetlandFraction > 0 ? 60 : 88
    const pct = `${Math.round(v.wetlandFraction * 100)}%`
    const topTypes = Object.entries(v.wetlandTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t).join(', ')
    return {
      category: 'wetlands', label: CATEGORY_LABELS.wetlands, score, weight: CATEGORY_WEIGHTS.wetlands,
      status: 'official', provenance: overlay.provenance,
      displayValue: v.wetlandFraction > 0 ? `${pct} wetlands${topTypes ? ` · ${topTypes}` : ''}` : 'No NWI wetlands on parcel',
      summary: v.wetlandFraction > 0.10 ? `${pct} of the parcel has mapped wetlands — a meaningful constraint.` : v.wetlandFraction > 0 ? `${pct} of the parcel has mapped wetlands.` : 'No NWI wetlands intersect the parcel.',
      detail: `Parcel-wide overlay across ${v.samplePoints} grid points. NWI is not a regulatory or jurisdictional delineation; a qualified delineation and USACE review are still required.`,
    }
  }
  // Fall back to point-based result.
  if (!data?.available || !data.value) {
    return missingMetric(
      'wetlands',
      'No wetland score is inferred when NWI is unavailable. Desktop environmental review and field delineation remain necessary.',
      data?.provenance,
    )
  }
  const hit = data.value.mappedWetland
  return {
    category: 'wetlands', label: CATEGORY_LABELS.wetlands, score: hit ? 15 : 88, weight: CATEGORY_WEIGHTS.wetlands,
    status: 'official', provenance: data.provenance,
    displayValue: hit ? (data.value.wetlandType || 'Mapped wetland at point') : 'No NWI wetland at point',
    summary: hit ? 'The selected point intersects a mapped NWI wetland.' : 'The selected point does not intersect an NWI wetland polygon.',
    detail: hit ? `NWI classification: ${data.value.classification || 'not supplied'}. NWI is not a regulatory or jurisdictional delineation; a qualified delineation and USACE review are still required.` : 'This point result does not clear the rest of the parcel. Unmapped or jurisdictional waters may still be present.',
  }
}

function slopeMetric(data: OfficialSiteData['slope'] | undefined, overlay?: ParcelOverlayData['slope']): MetricResult {
  // Prefer parcel-wide overlay when available.
  if (overlay?.available && overlay.value) {
    const v = overlay.value
    const score = v.meanSlopePercent <= 3 ? 95 : v.meanSlopePercent <= 8 ? 80 : v.meanSlopePercent <= 15 ? 55 : v.meanSlopePercent <= 20 ? 35 : v.meanSlopePercent <= 30 ? 20 : 10
    return {
      category: 'slope', label: CATEGORY_LABELS.slope, score, weight: CATEGORY_WEIGHTS.slope,
      status: 'official', provenance: overlay.provenance,
      displayValue: `mean ${v.meanSlopePercent}% · p90 ${v.p90SlopePercent}% · >20%: ${Math.round(v.fractionOver20 * 100)}%`,
      summary: v.meanSlopePercent <= 8 ? 'Parcel-wide terrain is relatively level.' : v.meanSlopePercent <= 15 ? 'Parcel-wide terrain may add grading and drainage work.' : v.meanSlopePercent <= 20 ? 'Parcel-wide terrain is likely expensive to develop.' : 'Parcel-wide terrain is a steep development constraint.',
      detail: `Computed from ${v.samplePoints} USGS elevation samples on a ${v.spacingMeters}m grid. Mean slope ${v.meanSlopePercent}%, p90 ${v.p90SlopePercent}%, max ${v.maxSlopePercent}%. ${Math.round(v.fractionOver20 * 100)}% of the parcel exceeds 20% slope; ${Math.round(v.fractionOver30 * 100)}% exceeds 30%. Hillside ordinances often trigger review above 15–20%. Not a survey.`,
    }
  }
  // Fall back to point-based result.
  if (!data?.available || !data.value) {
    return missingMetric(
      'slope',
      'No terrain score is inferred when USGS elevation samples are unavailable. A topographic survey remains the development-grade source.',
      data?.provenance,
    )
  }
  const slope = data.value.slopePercent
  const score = slope <= 3 ? 95 : slope <= 8 ? 80 : slope <= 15 ? 55 : slope <= 20 ? 35 : slope <= 30 ? 20 : 10
  return {
    category: 'slope', label: CATEGORY_LABELS.slope, score, weight: CATEGORY_WEIGHTS.slope,
    status: 'official', provenance: data.provenance,
    displayValue: `${slope.toFixed(1)}% local slope (point)`,
    summary: slope <= 8 ? 'The immediate terrain samples are relatively level.' : slope <= 15 ? 'The immediate terrain may add grading and drainage work.' : slope <= 20 ? 'The immediate terrain is likely expensive to develop.' : 'The immediate terrain samples indicate a steep development constraint.',
    detail: `Calculated from USGS elevations 50 meters north, south, east, and west of the selected point. Center elevation is ${data.value.centerElevationMeters.toFixed(1)} m. Hillside ordinances often trigger extra review above 15–20% and protect 30%+ slopes. This does not capture the steepest part of a parcel or replace a survey.`,
  }
}

function utilitiesMetric(inputs: SiteInputs, official?: OfficialSiteData['utilityService'], local?: OfficialSiteData['localUtility'], parcel?: ParcelSelection): MetricResult {
  if (local?.available && local.value) {
    const v = local.value
    let score = v.inServiceArea ? 68 : 28
    if (official?.available && official.value?.inWaterServiceArea) score = Math.max(score, 78)
    if (inputs.utilitiesNearby === 'yes') score = Math.max(score, 80)
    if (inputs.utilitiesNearby === 'no') score = Math.min(score, 35)
    return {
      category: 'utilities', label: CATEGORY_LABELS.utilities, score, weight: CATEGORY_WEIGHTS.utilities,
      status: 'official', provenance: local.provenance,
      displayValue: v.inServiceArea ? `${v.utilityName} ${v.utilityType} area` : `Outside mapped ${v.utilityName} area`,
      summary: v.inServiceArea ? `The point falls within the mapped ${v.utilityName} ${v.utilityType} service area.${official?.available && official.value?.inWaterServiceArea ? ' EPA also maps public water service.' : ''}` : `The point is outside the mapped ${v.utilityName} ${v.utilityType} service area.`,
      detail: `${v.utilityName}'s mapped ${v.utilityType} service area is a screening signal only. It does not prove capacity, allocation, extension cost, utility design, or a right to serve.${official?.available && official.value ? ' EPA water-service mapping is also available as supplemental evidence.' : ''} Obtain written will-serve and capacity letters before ranking or acquisition.`,
    }
  }
  const parcelServices = [parcel?.facts?.waterService, parcel?.facts?.sewerService, parcel?.facts?.utilities].filter(Boolean) as string[]
  if (parcelServices.length) {
    const serviceText = parcelServices.join(' · ')
    const unavailableCount = parcelServices.filter((service) => /\b(none|not available|unknown|no service)\b/i.test(service)).length
    const allUnavailable = unavailableCount === parcelServices.length
    let score = allUnavailable ? 32 : unavailableCount > 0 ? 55 : 66
    if (inputs.utilitiesNearby === 'yes') score = Math.max(score, 78)
    if (inputs.utilitiesNearby === 'no') score = Math.min(score, 35)
    return {
      category: 'utilities', label: CATEGORY_LABELS.utilities, score, weight: CATEGORY_WEIGHTS.utilities,
      status: 'official', provenance: parcel?.provenance,
      displayValue: serviceText,
      summary: allUnavailable ? 'The parcel record does not identify a mapped utility-service path.' : unavailableCount > 0 ? 'The parcel record identifies only a partial utility-service path.' : 'The assessor/parcel record publishes utility-service descriptors for this parcel.',
      detail: `Parcel record utility fields: ${serviceText}. These attributes can be generalized, coded, or outdated. They do not prove capacity, allocation, connection location, extension cost, or a right to serve. Obtain written will-serve and capacity letters.`,
    }
  }
  // Prefer official EPA water service area data when available.
  if (official?.available && official.value) {
    const v = official.value
    let score = v.inWaterServiceArea ? 70 : 30
    // Adjust based on user input if they also answered.
    if (inputs.utilitiesNearby === 'yes') score = Math.max(score, 75)
    if (inputs.utilitiesNearby === 'no') score = Math.min(score, 35)
    return {
      category: 'utilities', label: CATEGORY_LABELS.utilities, score, weight: CATEGORY_WEIGHTS.utilities,
      status: 'official', provenance: official.provenance,
      displayValue: v.inWaterServiceArea ? `In ${v.pwsName || 'EPA water service area'}` : 'Not in mapped water service area',
      summary: v.inWaterServiceArea ? `EPA maps this point within a public water system service area (${v.pwsName || v.pwsId}).` : 'EPA does not map this point within a public water system service area.',
      detail: `EPA explicitly states public water service area boundaries may differ from actual service areas. "In area" does not prove capacity, allocation, or extension cost. A will-serve / capacity letter from each provider is required before ranking.`,
    }
  }
  // Fall back to user input.
  if (inputs.utilitiesNearby === 'unknown') {
    return missingMetric(
      'utilities',
      'Utility availability and capacity need local utility service maps or EPA public water service areas, plus a will-serve / capacity letter. Select yes/no or leave unknown.',
    )
  }
  const score = inputs.utilitiesNearby === 'yes' ? 80 : 25
  return userMetric(
    'utilities', score, `Utilities: ${inputs.utilitiesNearby}`,
    inputs.utilitiesNearby === 'yes'
      ? 'You indicated utilities are nearby. Capacity is still unverified.'
      : 'You indicated utilities are not nearby — a major feasibility constraint.',
    'EPA public water service areas may differ from actual service. "Nearby" does not prove capacity, allocation, or extension cost. A will-serve / capacity letter from each provider is required before ranking.',
  )
}

function accessMetric(data: OfficialSiteData['road'] | undefined, inputs: SiteInputs, parcel?: ParcelSelection): MetricResult {
  const mappedFrontage = parcel?.facts?.frontageFeet
  if (!data?.available || !data.value) {
    if (inputs.roadFrontage === 'unknown') {
      if (mappedFrontage) {
        return {
          category: 'access', label: CATEGORY_LABELS.access, score: 72, weight: CATEGORY_WEIGHTS.access,
          status: 'official', provenance: parcel?.provenance, displayValue: `${mappedFrontage.toLocaleString()} ft reported frontage`,
          summary: 'The parcel record reports frontage, but legal and usable access remain unverified.',
          detail: 'Assessor frontage is a dimensional attribute, not proof of deeded access, a public-road connection, driveway approval, or adequate roadway capacity. Confirm title, plat, road authority, and access permits.',
        }
      }
      return missingMetric(
        'access',
        'Access and frontage need a TIGERweb road result or your frontage answer. Legal access and frontage must be confirmed from title, plats, and the road authority.',
        data?.provenance,
      )
    }
    return userMetric(
      'access', inputs.roadFrontage === 'yes' ? 78 : 22, `Frontage: ${inputs.roadFrontage}`,
      inputs.roadFrontage === 'yes' ? 'You indicated road frontage. Legal access is still unverified.' : 'You indicated no road frontage — a hard access constraint.',
      'Frontage in GIS is not legal, deeded access. Title, plats, and the road authority are binding.',
    )
  }
  const distance = data.value.nearestDistanceMeters
  let score = distance <= 25 ? 92 : distance <= 75 ? 80 : distance <= 150 ? 65 : distance <= 300 ? 48 : 30
  if (mappedFrontage) score = Math.max(score, 80)
  if (inputs.roadFrontage === 'yes') score = Math.max(score, 82)
  if (inputs.roadFrontage === 'no') score = Math.min(score, 22)
  return {
    category: 'access', label: CATEGORY_LABELS.access, score, weight: CATEGORY_WEIGHTS.access,
    status: inputs.roadFrontage === 'unknown' ? 'official' : 'user', provenance: data.provenance,
    displayValue: `${distance} m to ${data.value.roadName}${mappedFrontage ? ` · ${mappedFrontage.toLocaleString()} ft frontage` : ''}`,
    summary: inputs.roadFrontage === 'no' ? 'You indicated no road frontage, which is a major constraint.' : distance <= 75 ? 'A Census-mapped road is close to the selected point.' : distance <= 300 ? 'A mapped road is nearby, but access may require additional work.' : 'No Census-mapped road was found close to the selected point.',
    detail: `${data.value.roadName} is classified as a ${data.value.roadClass.toLowerCase()} road. Proximity is not proof of legal access, adequate frontage, driveway approval, public maintenance, or capacity.`,
  }
}

function marketMetric(inputs: SiteInputs, demographics?: OfficialSiteData['demographics'], bps?: OfficialSiteData['bps']): MetricResult {
  const hasDemo = demographics?.available && demographics.value
  const hasBps = bps?.available && bps.value

  if (!hasDemo && !hasBps) {
    return missingMetric(
      'market',
      'Market support uses ACS population trend and Census building permits when configured. Add VITE_CENSUS_API_KEY to enable both. Employment, income, supply, and intended-use-specific absorption still need separate study.',
      demographics?.provenance,
    )
  }

  // Census BPS measures residential-structure permits (1-unit, 2-4 unit, 5+
  // units). It is a strong demand proxy for `residential` and a supportive (but
  // weaker) signal for `mixed-use`; it does not measure commercial or
  // industrial absorption directly. Reflect that in the weighting so a
  // residential-intent site gets full credit on the permit trend while a
  // commercial/industrial-intent site leans more on the demographic signal and
  // surfaces a missing-data caveat.
  const intendedUse = inputs.intendedUse
  const bpsIsDirectSignal = intendedUse === 'residential' || intendedUse === 'mixed-use'
  // Permit-trend weight in the composite when both demo + BPS are available.
  const bpsWeightWhenBoth = bpsIsDirectSignal ? 0.4 : intendedUse === 'other' ? 0.4 : 0.2
  const popWeightWhenBoth = 1 - bpsWeightWhenBoth

  // Combine population growth and building permits for a composite market score.
  let popScore = 65 // neutral default when only BPS is available
  let demoDisplay = ''
  if (hasDemo) {
    const growth = demographics!.value!.growthPercent
    popScore = growth >= 10 ? 90 : growth >= 5 ? 80 : growth >= 0 ? 65 : growth >= -5 ? 45 : 25
    demoDisplay = `pop ${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`
  }

  let bpsScore = 65 // neutral default when only demographics is available
  let bpsDisplay = ''
  if (hasBps) {
    const trend = bps!.value!.permitTrend
    // For non-residential / non-mixed uses the permit signal is informative but
    // indirect — cap its upside so a hot residential market doesn't pin the
    // commercial/industrial market sub-score at 90.
    const cap = bpsIsDirectSignal ? 100 : intendedUse === 'other' ? 100 : 78
    bpsScore = Math.min(cap, trend >= 20 ? 90 : trend >= 5 ? 78 : trend >= 0 ? 65 : trend >= -10 ? 45 : 25)
    bpsDisplay = `permits ${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`
  }

  const score = hasDemo && hasBps ? Math.round(popScore * popWeightWhenBoth + bpsScore * bpsWeightWhenBoth) : hasDemo ? popScore : bpsScore
  const displayParts = [demoDisplay, bpsDisplay].filter(Boolean)
  const provenance = hasBps ? bps!.provenance : demographics!.provenance

  const intendedUseLabel = intendedUse === 'mixed-use' ? 'mixed-use' : intendedUse
  const weakSignalNote = bpsIsDirectSignal
    ? ''
    : ` Census BPS measures residential permit trend; for ${intendedUseLabel} use it is a supportive but indirect signal — pull intended-use-specific absorption, employment, and income from a market study.`

  return {
    category: 'market', label: CATEGORY_LABELS.market, score, weight: CATEGORY_WEIGHTS.market,
    status: 'official', provenance,
    displayValue: displayParts.join(' · ') + (bpsIsDirectSignal ? '' : ` · ${intendedUseLabel}`),
    summary: hasDemo && hasBps
      ? `ACS ${demoDisplay}; BPS ${bpsDisplay} in ${bps!.value!.countyName}.${bpsIsDirectSignal ? '' : ` BPS is a residential signal — it is ${intendedUse === 'other' ? 'a weak' : 'an indirect'} proxy for ${intendedUseLabel} demand.`}`
      : hasDemo
        ? `ACS estimates show ${popScore >= 75 ? 'strong' : popScore >= 50 ? 'stable' : 'weak'} tract population change.`
        : `Census BPS shows ${bpsScore >= 75 ? 'strong' : bpsScore >= 50 ? 'stable' : 'weak'} permit trend in ${bps!.value!.countyName}.${bpsIsDirectSignal ? '' : ` BPS is a residential signal — it is an indirect proxy for ${intendedUseLabel} demand.`}`,
    detail: hasBps
      ? `Building permits: ${bps!.value!.totalPermits2024} in 2024 (${bps!.value!.permitsPerThousand2024}/1k pop). Permit trend: ${bps!.value!.permitTrend > 0 ? '+' : ''}${bps!.value!.permitTrend}%. ${hasDemo ? `ACS population: ${demographics!.value!.priorPopulation.toLocaleString()} → ${demographics!.value!.currentPopulation.toLocaleString()}.` : ''} Population and permits are market signals; intended-use-specific demand, income, and absorption need their own study.${weakSignalNote}`
      : `ACS 5-year estimate changed from ${demographics!.value!.priorPopulation.toLocaleString()} to ${demographics!.value!.currentPopulation.toLocaleString()}. Population is one market signal; permits, income, and absorption need their own study.`,
  }
}

// ---------- Stormwater metric (USGS 3DEP drainage proxy) ----------

function stormwaterMetric(data?: OfficialSiteData['stormwater'], overlay?: StormwaterOverlay): MetricResult {
  // Prefer parcel-wide overlay when available.
  if (overlay?.available && overlay.value) {
    const v = overlay.value
    const score = v.screeningLevel === 'good' ? 85 : v.screeningLevel === 'moderate' ? 62 : v.screeningLevel === 'challenging' ? 35 : 50
    return {
      category: 'stormwater', label: CATEGORY_LABELS.stormwater, score, weight: CATEGORY_WEIGHTS.stormwater,
      status: 'official', provenance: overlay.provenance,
      displayValue: `${v.screeningLevel} · drains ${v.drainageDirection} · ${v.flatnessIndex === 1 ? 'flat' : v.flatnessIndex > 0.5 ? 'moderate' : 'sloped'}`,
      summary: v.screeningLevel === 'good' ? 'Parcel-wide terrain drains with moderate slope — favorable for stormwater.' : v.screeningLevel === 'moderate' ? 'Parcel-wide terrain drains but is relatively flat — detention may need careful design.' : v.screeningLevel === 'challenging' ? 'Parcel-wide terrain is flat with no clear outfall — stormwater design will be challenging.' : 'Parcel drainage could not be determined from available elevation samples.',
      detail: `Parcel-wide drainage analysis across ${v.samplePoints} sampled cells on a ${v.spacingMeters}m grid shared with the slope overlay. Dominant drainage direction: ${v.drainageDirection}. Slope to parcel low point: ${v.slopeTowardLowPoint}%. Flatness index: ${v.flatnessIndex} (1=flat, 0=sloped). Positive outfall: ${v.hasPositiveOutfall ? 'yes' : 'no'}. Detention suitability: ${v.estimatedDetentionSuitability}. This shares the USGS elevation grid with the slope overlay and is a screening proxy, not a civil stormwater concept or outfall survey. Local stormwater criteria and a civil concept plan are required.`,
    }
  }
  if (!data?.available || !data.value) {
    return missingMetric(
      'stormwater',
      data?.error && /progress/i.test(data.error)
        ? 'USGS drainage analysis is querying. If it remains unavailable, a civil stormwater concept plan and outfall verification are still required.'
        : 'USGS drainage analysis did not return a usable result. Stormwater and outfall feasibility need DEM flow-direction analysis plus local stormwater conveyance. A civil concept plan and outfall verification are still required.',
      data?.provenance,
    )
  }
  const v = data.value
  const score = v.screeningLevel === 'good' ? 85 : v.screeningLevel === 'moderate' ? 62 : v.screeningLevel === 'challenging' ? 35 : 50
  return {
    category: 'stormwater', label: CATEGORY_LABELS.stormwater, score, weight: CATEGORY_WEIGHTS.stormwater,
    status: 'official', provenance: data.provenance,
    displayValue: `${v.screeningLevel} · drains ${v.drainageDirection} · ${v.flatnessIndex === 1 ? 'flat' : v.flatnessIndex > 0.5 ? 'moderate' : 'sloped'}`,
    summary: v.screeningLevel === 'good' ? 'Terrain drains away from the point with moderate slope — favorable for stormwater.' : v.screeningLevel === 'moderate' ? 'Terrain drains but is relatively flat — detention may need careful design.' : v.screeningLevel === 'challenging' ? 'Flat terrain with no clear outfall — stormwater design will be challenging.' : 'Drainage pattern could not be determined from available elevation samples.',
    detail: `Drainage direction: ${v.drainageDirection}. Slope to low point: ${v.slopeTowardLowPoint}%. Flatness index: ${v.flatnessIndex} (1=flat, 0=sloped). Positive outfall: ${v.hasPositiveOutfall ? 'yes' : 'no'}. Detention suitability: ${v.estimatedDetentionSuitability}. This is a screening proxy from 8-direction USGS elevation samples, not a civil stormwater concept or outfall survey. Local stormwater criteria and a civil concept plan are required.`,
  }
}

// ---------- Easements metric (local GIS / title) ----------

function easementsMetric(data?: OfficialSiteData['easements'], overlay?: EasementsOverlay): MetricResult {
  // Prefer parcel-wide overlay when available.
  if (overlay?.available && overlay.value) {
    const v = overlay.value
    const score = v.easementFraction > 0.02 ? 40 : v.easementTypes.length > 0 && v.easementTypes[0] !== 'none flag' ? 55 : 78
    return {
      category: 'easements', label: CATEGORY_LABELS.easements, score, weight: CATEGORY_WEIGHTS.easements,
      status: 'official', provenance: overlay.provenance,
      displayValue: v.easementFraction > 0 ? `${Math.round(v.easementFraction * 100)}% of parcel${v.easementTypes.length && v.easementTypes[0] !== 'none flag' ? ` · ${v.easementTypes.join(', ')}` : ''}` : 'No mapped easements on parcel',
      summary: v.easementFraction > 0.02 ? `${Math.round(v.easementFraction * 100)}% of the parcel is covered by locally mapped easements/ROW.` : v.easementTypes.length && v.easementTypes[0] !== 'none flag' ? `Local GIS shows an easement flag on the parcel (${v.easementTypes.join(', ')}); no easement polygon geometry returned.` : 'No mapped easements intersect the parcel.',
      detail: `Parcel-wide easement/ROW overlay across ${v.samplePoints} grid points against ${v.sourceLayer}. Easement fraction: ${Math.round(v.easementFraction * 100)}%. Local GIS easement data is approximate and may not reflect all recorded easements, covenants, or dedications. A title commitment and ALTA/NSPS land title survey are the authoritative source and are still required before acquisition.`,
    }
  }
  if (!data?.available || !data.value) {
    return missingMetric(
      'easements',
      data?.error && /progress/i.test(data.error)
        ? 'Local GIS easement screening is querying. If no local adapter is registered, a title commitment and ALTA survey remain the authoritative source.'
        : (data?.provenance?.coverageNote || 'No local GIS easement/ROW adapter is registered for this jurisdiction. Easements, encumbrances, covenants, and dedications can only be confirmed from title commitment and an ALTA/NSPS land title survey.'),
      data?.provenance,
    )
  }
  const v = data.value
  const score = v.hasRecordedEasements ? 35 : 75
  return {
    category: 'easements', label: CATEGORY_LABELS.easements, score, weight: CATEGORY_WEIGHTS.easements,
    status: 'official', provenance: data.provenance,
    displayValue: v.hasRecordedEasements ? `${v.easementTypes.length} easement type${v.easementTypes.length === 1 ? '' : 's'} mapped` : 'No mapped easements',
    summary: v.hasRecordedEasements ? `Local GIS shows recorded easements: ${v.easementTypes.join(', ')}.` : 'Local GIS shows no recorded easements at this point.',
    detail: `Source: ${v.sourceLayer}. Local GIS easement data is approximate and may not reflect all recorded easements, covenants, or dedications. A title commitment and ALTA/NSPS land title survey are the authoritative source and are still required before acquisition.`,
  }
}

// ---------- Soils metric (NRCS SSURGO/SDA) ----------

function soilsMetric(data?: OfficialSiteData['soils'], overlay?: SoilsOverlay): MetricResult {
  // Prefer parcel-wide overlay when available.
  if (overlay?.available && overlay.value) {
    const v = overlay.value
    const severe = v.dominantRating === 'severe'
    const moderate = v.dominantRating === 'moderate'
    // Weight the score by the share of the parcel that is unfavorable:
    // severeFraction is the most damaging, then moderateFraction.
    const score = severe && v.severeFraction > 0.25 ? 18
      : severe ? 35
        : moderate && v.moderateFraction > 0.25 ? 45
          : moderate ? 58
            : v.dominantRating === 'slight' ? 85
              : v.dominantRating === 'unknown' ? 60
                : 60
    const topSoils = Object.entries(v.soilTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, share]) => `${name} (${Math.round((share || 0) * 100)}%)`).join('; ')
    return {
      category: 'soils', label: CATEGORY_LABELS.soils, score, weight: CATEGORY_WEIGHTS.soils,
      status: 'official', provenance: overlay.provenance,
      displayValue: `${v.dominantRating === 'severe' ? 'Severe' : v.dominantRating === 'moderate' ? 'Moderate' : v.dominantRating === 'slight' ? 'Slight' : v.dominantRating === 'unknown' ? 'Not rated' : 'Not rated'} · hydric ${Math.round(v.hydricFraction * 100)}% · severe ${Math.round(v.severeFraction * 100)}%`,
      summary: severe ? `${Math.round(v.severeFraction * 100)}% of the parcel has severe NRCS septic/dwelling ratings.${v.hydricFraction > 0 ? ` ${Math.round(v.hydricFraction * 100)}% is hydric.` : ''}` : moderate ? `${Math.round(v.moderateFraction * 100)}% of the parcel has moderate NRCS ratings.` : v.dominantRating === 'slight' ? 'NRCS ratings are favorable across most of the parcel.' : 'NRCS soils coverage unavailable for this parcel.',
      detail: `Parcel-wide soil map-unit query across NRCS intersecting ${v.samplePoints} grid points. Dominant rating: ${v.dominantRating}. Hydric fraction: ${Math.round(v.hydricFraction * 100)}%. Severe fraction: ${Math.round(v.severeFraction * 100)}%. Moderate fraction: ${Math.round(v.moderateFraction * 100)}%. Top map units by share: ${topSoils || 'none returned'}. NRCS soils are mapped interpretations, not borings. A geotechnical report and perc testing are still required.`,
    }
  }
  if (!data?.available || !data.value) {
    return missingMetric(
      'soils',
      data?.error && /progress/i.test(data.error)
        ? 'NRCS SSURGO / Soil Data Access is querying. If it remains unavailable, a CORS or service limitation may apply. A geotechnical report with borings remains the development-grade source.'
        : 'NRCS SSURGO / Soil Data Access did not return a usable result. This may be a CORS limitation of the browser-based SDA endpoint or a service issue. A geotechnical report with borings remains the development-grade source.',
      data?.provenance,
    )
  }
  const v = data.value
  const severe = v.dominantRating === 'severe'
  const moderate = v.dominantRating === 'moderate'
  const score = severe ? 20 : moderate ? 50 : v.dominantRating === 'slight' ? 85 : 60
  return {
    category: 'soils', label: CATEGORY_LABELS.soils, score, weight: CATEGORY_WEIGHTS.soils,
    status: 'official', provenance: data.provenance,
    displayValue: `${v.dominantRating === 'severe' ? 'Severe' : v.dominantRating === 'moderate' ? 'Moderate' : v.dominantRating === 'slight' ? 'Slight' : 'Not rated'} · ${v.drainageClass}`,
    summary: severe ? `Dominant NRCS rating is severe for septic/dwelling. ${v.hydric ? 'Hydric soils present.' : ''}` : moderate ? `Dominant NRCS rating is moderate. Drainage class: ${v.drainageClass}.` : v.dominantRating === 'slight' ? `NRCS ratings are favorable. Drainage class: ${v.drainageClass}.` : `NRCS ratings not available. Drainage class: ${v.drainageClass}.`,
    detail: `Map unit: ${v.mapUnitName} (mukey ${v.mukey}). Septic: ${v.septicRating}. Dwelling: ${v.dwellingRating}. Hydric: ${v.hydricClass}. NRCS soils are mapped interpretations, not borings. A geotechnical report and perc testing are still required.`,
  }
}

// ---------- Contamination metric (EPA FRS) ----------

function contaminationMetric(data?: OfficialSiteData['contamination'], overlay?: ContaminationOverlay): MetricResult {
  // Prefer parcel-wide overlay when available.
  if (overlay?.available && overlay.value) {
    const v = overlay.value
    if (v.facilityCount === 0) {
      return {
        category: 'contamination', label: CATEGORY_LABELS.contamination, score: 88, weight: CATEGORY_WEIGHTS.contamination,
        status: 'official', provenance: overlay.provenance,
        displayValue: 'No EPA facilities on parcel',
        summary: 'No EPA-regulated facilities were found within the parcel polygon (or its surrounding buffer).',
        detail: `Parcel-wide EPA FRS overlay across ${v.samplePoints} grid points with a ${v.bufferMeters} m buffer around the parcel polygon. EPA FRS covers facilities in programs like RCRA, CERCLA, TRI, NPDES, and UST. National databases miss some local/historic conditions. A Phase I ESA is still required.`,
      }
    }
    const score = v.hasMajorFlag ? 25 : v.facilityCount > 5 ? 50 : v.facilityCount > 1 ? 65 : 72
    return {
      category: 'contamination', label: CATEGORY_LABELS.contamination, score, weight: CATEGORY_WEIGHTS.contamination,
      status: 'official', provenance: overlay.provenance,
      displayValue: `${v.facilityCount} facilit${v.facilityCount === 1 ? 'y' : 'ies'} on parcel${v.hasMajorFlag ? ' · major flag' : ''}`,
      summary: v.hasMajorFlag ? `${v.facilityCount} EPA-regulated facilit${v.facilityCount === 1 ? 'y' : 'ies'} within the parcel polygon (including a ${v.bufferMeters} m buffer), with major hazardous/toxic program flags.` : `${v.facilityCount} EPA-regulated facilit${v.facilityCount === 1 ? 'y' : 'ies'} within the parcel polygon (including a ${v.bufferMeters} m buffer). Nearest: ${v.nearestName}.`,
      detail: `Parcel-wide EPA FRS overlay across ${v.samplePoints} grid points with a ${v.bufferMeters} m buffer around the parcel polygon. Facility types: ${v.facilityTypes.join(', ')}. EPA FRS covers RCRA, CERCLA, TRI, NPDES, UST, and other programs. National databases miss some local/historic conditions. A Phase I ESA is still required.`,
    }
  }
  if (!data?.available || !data.value) {
    return missingMetric(
      'contamination',
      data?.error && /progress/i.test(data.error)
        ? 'EPA FRS contamination screening is querying. If it remains unavailable, a CORS or service limitation may apply. A Phase I ESA remains the diligence standard.'
        : 'EPA FRS did not return a usable result. This may be a CORS limitation of the browser-based FRS endpoint or a service issue. A Phase I ESA remains the diligence standard.',
      data?.provenance,
    )
  }
  const v = data.value
  if (v.facilityCount === 0) {
    return {
      category: 'contamination', label: CATEGORY_LABELS.contamination, score: 88, weight: CATEGORY_WEIGHTS.contamination,
      status: 'official', provenance: data.provenance,
      displayValue: 'No EPA facilities within 1 km (point)',
      summary: 'No EPA-regulated facilities were found within 1,000 meters of the selected point.',
      detail: 'EPA FRS covers facilities in programs like RCRA, CERCLA, TRI, NPDES, and UST. National databases miss some local/historic conditions. A Phase I ESA is still required.',
    }
  }
  const score = v.hasMajorFlag ? 25 : v.facilityCount > 5 ? 50 : v.facilityCount > 1 ? 65 : 72
  return {
    category: 'contamination', label: CATEGORY_LABELS.contamination, score, weight: CATEGORY_WEIGHTS.contamination,
    status: 'official', provenance: data.provenance,
    displayValue: `${v.facilityCount} facilit${v.facilityCount === 1 ? 'y' : 'ies'} within 1 km${v.hasMajorFlag ? ' · major flag' : ''} (point)`,
    summary: v.hasMajorFlag ? `${v.facilityCount} EPA-regulated facilit${v.facilityCount === 1 ? 'y' : 'ies'} within 1 km, including major hazardous/toxic program flags.` : `${v.facilityCount} EPA-regulated facilit${v.facilityCount === 1 ? 'y' : 'ies'} within 1 km. Nearest: ${v.nearestName}.`,
    detail: `Facility types: ${v.facilityTypes.join(', ')}. EPA FRS covers RCRA, CERCLA, TRI, NPDES, UST, and other programs. National databases miss some local/historic conditions. A Phase I ESA is still required.`,
  }
}

// ---------- Species / Critical Habitat metric (USFWS ECOS) ----------

function speciesMetric(data?: OfficialSiteData['species'], overlay?: SpeciesOverlay): MetricResult {
  // Prefer parcel-wide overlay when available.
  if (overlay?.available && overlay.value) {
    const v = overlay.value
    if (!v.criticalHabitatHit) {
      return {
        category: 'species', label: CATEGORY_LABELS.species, score: 85, weight: CATEGORY_WEIGHTS.species,
        status: 'official', provenance: overlay.provenance,
        displayValue: 'No critical habitat on parcel',
        summary: 'No USFWS critical habitat polygon intersects the parcel boundary.',
        detail: `Parcel-wide USFWS ECOS overlay tested against ${v.samplePoints} parcel grid points. IPaC’s standard resource list is informational and not official consultation correspondence. A full IPaC project review and SHPO review are still recommended.`,
      }
    }
    return {
      category: 'species', label: CATEGORY_LABELS.species, score: 20, weight: CATEGORY_WEIGHTS.species,
      status: 'official', provenance: overlay.provenance,
      displayValue: `${v.speciesCount} critical habitat hit${v.speciesCount === 1 ? '' : 's'} · ${Math.round(v.habitatFraction * 100)}% of parcel`,
      summary: `The parcel intersects critical habitat for ${v.criticalHabitatLayers.slice(0, 2).join(', ')}. ${Math.round(v.habitatFraction * 100)}% of the ${v.samplePoints} sampled grid points fall within mapped habitat.`,
      detail: `Parcel-wide USFWS ECOS overlay tested against ${v.samplePoints} parcel grid points. Critical habitat layers: ${v.criticalHabitatLayers.join(', ')}. IPaC’s standard resource list is informational and not official consultation correspondence. A formal IPaC project review and agency consultation are required when a federal nexus exists.`,
    }
  }
  if (!data?.available || !data.value) {
    return missingMetric(
      'species',
      data?.error && /progress/i.test(data.error)
        ? 'USFWS IPaC / ECOS critical habitat screening is querying. If it remains unavailable, a CORS or service limitation may apply. Official agency consultation is still separate from screening.'
        : 'USFWS IPaC / ECOS did not return a usable result. This may be a CORS limitation of the browser-based ECOS endpoint or a service issue. Official agency consultation is still separate from screening.',
      data?.provenance,
    )
  }
  const v = data.value
  if (!v.criticalHabitatHit) {
    return {
      category: 'species', label: CATEGORY_LABELS.species, score: 85, weight: CATEGORY_WEIGHTS.species,
      status: 'official', provenance: data.provenance,
      displayValue: 'No critical habitat at point (point)',
      summary: 'No USFWS critical habitat polygon intersects the selected point.',
      detail: 'This is a point result and does not clear the entire parcel. IPaC’s standard resource list is informational and not official consultation correspondence. A full IPaC project review and SHPO review are still recommended.',
    }
  }
  return {
    category: 'species', label: CATEGORY_LABELS.species, score: 20, weight: CATEGORY_WEIGHTS.species,
    status: 'official', provenance: data.provenance,
    displayValue: `${v.speciesCount} critical habitat hit${v.speciesCount === 1 ? '' : 's'} (point)`,
    summary: `The selected point intersects critical habitat for ${v.criticalHabitatLayers.slice(0, 2).join(', ')}.`,
    detail: `Critical habitat layers: ${v.criticalHabitatLayers.join(', ')}. IPaC’s standard resource list is informational and not official consultation correspondence. A formal IPaC project review and agency consultation are required when a federal nexus exists.`,
  }
}

// ---------- Hard gates ----------

function evaluateHardGates(metrics: Record<ScoreCategory, MetricResult>, inputs: SiteInputs, official?: OfficialSiteData, overlays?: ParcelOverlayData | null): HardGate[] {
  const pointFloodway = official?.flood.available && official.flood.value?.floodway
  const overlayFloodwayInCore = overlays?.floodplain.available && overlays.floodplain.value?.floodwayInCore
  const floodway = Boolean(pointFloodway || overlayFloodwayInCore)
  const netAcres = overlays?.netDevelopable?.netDevelopableAcres
  const gates: HardGate[] = [
    {
      id: 'use-permitted',
      label: 'Use permitted & entitlement path clear',
      reason: 'Intended use is not clearly permitted under the site\'s zoning.',
      triggered: metrics.zoning.status !== 'unknown' && metrics.zoning.score !== null && metrics.zoning.score <= 20,
    },
    {
      id: 'legal-access',
      label: 'Legal access & viable frontage',
      reason: 'No road frontage was reported. A landlocked or inaccessible parcel cannot be developed without an access easement or dedication.',
      triggered: inputs.roadFrontage === 'no',
    },
    {
      id: 'floodway-in-core',
      label: 'No mapped regulatory floodway in likely buildable core',
      reason: 'The selected point intersects a FEMA regulatory floodway. A floodway in the buildable core usually prevents a feasible building pad.',
      triggered: Boolean(floodway),
    },
    {
      id: 'utility-path',
      label: 'Viable water / sewer / septic path',
      reason: 'You indicated utilities are not nearby and no viable septic/well path has been identified.',
      triggered: inputs.utilitiesNearby === 'no',
    },
    {
      id: 'contamination',
      label: 'No severe on-site contamination flag',
      reason: (() => {
        const overlayFacilities = overlays?.contamination.available ? overlays.contamination.value : undefined
        const pointFacilities = official?.contamination?.available ? official.contamination.value : undefined
        if (overlayFacilities?.hasMajorFlag) {
          return `${overlayFacilities.facilityCount} EPA-regulated facilit${overlayFacilities.facilityCount === 1 ? 'y' : 'ies'} with major hazardous/toxic flags on the parcel itself (including a ${overlayFacilities.bufferMeters} m buffer). Nearest: ${overlayFacilities.nearestName || 'unnamed'}.`
        }
        if (pointFacilities?.hasMajorFlag) {
          return `${pointFacilities.facilityCount} EPA-regulated facilities with major hazardous/toxic flags within 1,000 meters. Nearest: ${pointFacilities.nearestName}.`
        }
        return 'Environmental contamination screening did not return a severe flag. A Phase I ESA is still required before acquisition.'
      })(),
      triggered: Boolean(
        (overlays?.contamination.available && overlays.contamination.value?.hasMajorFlag)
        || (official?.contamination?.available && official.contamination.value?.hasMajorFlag),
      ),
    },
    {
      id: 'species-historic',
      label: 'No critical habitat / regulatory resource overlap',
      reason: (() => {
        const overlayHit = overlays?.species.available ? overlays.species.value : undefined
        const pointHit = official?.species?.available ? official.species.value : undefined
        const layers = overlayHit?.criticalHabitatLayers || pointHit?.criticalHabitatLayers || []
        if (overlayHit?.criticalHabitatHit) {
          return `The parcel intersects critical habitat for ${layers.slice(0, 2).join(', ')} (${Math.round((overlayHit.habitatFraction || 0) * 100)}% of the parcel grid).`
        }
        if (pointHit?.criticalHabitatHit) {
          return `The selected point intersects critical habitat for ${layers.slice(0, 2).join(', ')}.`
        }
        return 'Species, critical habitat, and historic/cultural screening did not return a critical habitat hit. IPaC and SHPO review are still required when a federal or local nexus exists.'
      })(),
      triggered: Boolean(
        (overlays?.species.available && overlays.species.value?.criticalHabitatHit)
        || (official?.species?.available && official.species.value?.criticalHabitatHit),
      ),
    },
    {
      id: 'net-yield',
      label: 'Net developable acreage above minimum viable yield',
      reason: overlays?.netDevelopable
        ? `Net developable acreage (${netAcres} ac) is below the conservative ${MIN_VIABLE_ACRES[inputs.intendedUse]}-acre screening floor for ${inputs.intendedUse.replace('-', ' ')} use.`
        : `Gross acreage is below the conservative ${MIN_VIABLE_ACRES[inputs.intendedUse]}-acre screening floor for ${inputs.intendedUse.replace('-', ' ')} use.`,
      triggered: (() => {
        if (overlays?.netDevelopable && netAcres !== undefined) {
          return netAcres < MIN_VIABLE_ACRES[inputs.intendedUse]
        }
        const acres = Number(inputs.acres)
        if (!Number.isFinite(acres) || acres <= 0) return false
        return acres < MIN_VIABLE_ACRES[inputs.intendedUse]
      })(),
    },
  ]
  return gates
}

// ---------- Verdict ----------

function getVerdict(rawScore: number | null, scoredWeight: number, gatedToManual: boolean, evidenceCoverage: 'partial' | 'full'): Pick<SiteAnalysis, 'verdict' | 'verdictTone'> {
  if (gatedToManual) return { verdict: 'Manual diligence required', verdictTone: 'manual' }
  if (rawScore === null) return { verdict: 'Not enough verified data', verdictTone: 'research' }
  if (scoredWeight < 75 && rawScore >= 70 && evidenceCoverage === 'partial') {
    return { verdict: 'Promising, limited evidence', verdictTone: 'research' }
  }
  const band = VERDICT_BANDS.find((entry) => rawScore >= entry.min)
  return band ? { verdict: band.verdict, verdictTone: band.tone } : { verdict: 'Not enough verified data', verdictTone: 'research' }
}

// ---------- Main entry ----------

export function analyzeSite(_coordinates: Coordinates, inputs: SiteInputs, official?: OfficialSiteData, hasParcelBoundary = false, overlays?: ParcelOverlayData | null, hazards?: RegionalHazardData | null, parcel?: ParcelSelection): SiteAnalysis {
  const hasOverlays = Boolean(overlays)
  const metrics: Record<ScoreCategory, MetricResult> = {
    zoning: zoningMetric(inputs, official?.zoning, parcel),
    netDevelopable: netDevelopableMetric(inputs, hasParcelBoundary, overlays),
    floodplain: floodplainMetric(official?.flood, overlays?.floodplain),
    wetlands: wetlandsMetric(official?.environmental, overlays?.wetlands),
    slope: slopeMetric(official?.slope, overlays?.slope),
    utilities: utilitiesMetric(inputs, official?.utilityService, official?.localUtility, parcel),
    access: accessMetric(official?.road, inputs, parcel),
    soils: soilsMetric(official?.soils, overlays?.soils),
    stormwater: stormwaterMetric(official?.stormwater, overlays?.stormwater),
    easements: easementsMetric(official?.easements, overlays?.easements),
    contamination: contaminationMetric(official?.contamination, overlays?.contamination),
    species: speciesMetric(official?.species, overlays?.species),
    market: marketMetric(inputs, official?.demographics, official?.bps),
  }

  const hardGates = evaluateHardGates(metrics, inputs, official, overlays)
  const triggeredGates = hardGates.filter((gate) => gate.triggered)
  const gatedToManual = triggeredGates.length > 0

  const scoredMetrics = Object.values(metrics).filter((metric): metric is MetricResult & { score: number } => metric.score !== null)
  const scoredWeight = scoredMetrics.reduce((total, metric) => total + metric.weight, 0)
  const evidenceCoverage: 'partial' | 'full' = scoredWeight >= 75 ? 'full' : 'partial'

  // Weighted raw score over scored categories only, normalized to 100.
  const rawScore: number | null = scoredWeight >= 50
    ? clamp(scoredMetrics.reduce((total, metric) => total + metric.score * metric.weight, 0) / (scoredWeight / 100))
    : null

  // Regional hazard modifier: 0 to -5 from sea-level rise, wildfire, and radon.
  // Only applies when at least one hazard source returned data. Clamped to [-5, 0].
  const regionalHazardModifier = hazards?.available ? hazards.totalPenalty : 0

  // Confidence penalty: 0 to -10 scaled by categories with no source at all.
  const unknownCount = Object.values(metrics).filter((metric) => metric.status === 'unknown').length
  const confidencePenalty = Math.min(10, Math.round(unknownCount * 1.5))

  // Final score applies modifiers + penalty to the raw score, but only when
  // there is enough weighted evidence. A gated site keeps its computed score
  // for transparency but the verdict is "Manual diligence required".
  let finalScore: number | null = null
  if (rawScore !== null) {
    const adjusted = rawScore + regionalHazardModifier - confidencePenalty
    finalScore = clamp(adjusted)
  }

  // Confidence: separate from the score, reflects how much is verified.
  const officialKnown = Object.values(metrics).filter((metric) => metric.status === 'official').length
  const userKnown = Object.values(metrics).filter((metric) => metric.status === 'user').length
  const sourceUnknowns = unknownCount
  const confidence = clamp(20 + officialKnown * 6 + userKnown * 5 - sourceUnknowns * 2)
  const confidenceLabel = confidence >= 75 ? 'Higher preliminary confidence' : confidence >= 55 ? 'Moderate preliminary confidence' : 'Low preliminary confidence'

  // ---------- Strengths, red flags, unknowns ----------
  const strengths: string[] = []
  const redFlags: string[] = []
  const unknowns: string[] = []

  for (const gate of triggeredGates) {
    redFlags.push(`Hard gate: ${gate.label}. ${gate.reason}`)
  }

  if (metrics.floodplain.status === 'official' && metrics.floodplain.score !== null && metrics.floodplain.score >= 75) strengths.push(hasOverlays ? 'No FEMA flood hazard intersects the parcel boundary.' : 'The selected point is outside FEMA\'s mapped elevated-hazard zones.')
  if (metrics.wetlands.status === 'official' && metrics.wetlands.score !== null && metrics.wetlands.score >= 75) strengths.push(hasOverlays ? 'No NWI wetlands intersect the parcel boundary.' : 'No NWI wetland intersects the selected point.')
  if (metrics.slope.status === 'official' && metrics.slope.score !== null && metrics.slope.score >= 75) strengths.push(hasOverlays ? 'USGS parcel-wide terrain samples indicate favorable slopes.' : 'USGS samples indicate favorable local terrain.')
  if (metrics.access.status !== 'unknown' && metrics.access.score !== null && metrics.access.score >= 75) strengths.push('A mapped road is close to the selected point.')
  if (metrics.market.status === 'official' && metrics.market.score !== null && metrics.market.score >= 75) strengths.push('ACS tract population change is supportive.')
  if (metrics.utilities.status === 'user' && metrics.utilities.score !== null && metrics.utilities.score >= 70) strengths.push('You indicated utilities are nearby.')
  if (metrics.zoning.status === 'user' && metrics.zoning.score !== null && metrics.zoning.score >= 80) strengths.push('Your zoning notes indicate a by-right permitted use.')
  if (metrics.netDevelopable.status === 'official' && metrics.netDevelopable.score !== null && metrics.netDevelopable.score >= 75) strengths.push(`Net developable acreage is strong at ${overlays?.netDevelopable?.netDevelopableAcres} ac (${Math.round((overlays?.netDevelopable?.netToGrossRatio ?? 0) * 100)}% of gross).`)
  else if (metrics.netDevelopable.status === 'user' && metrics.netDevelopable.score !== null && metrics.netDevelopable.score >= 75) strengths.push('Reported gross acreage is ample for the intended use.')
  if (metrics.soils.status === 'official' && metrics.soils.score !== null && metrics.soils.score >= 75) strengths.push('NRCS soil ratings are favorable for building and septic.')
  if (metrics.contamination.status === 'official' && metrics.contamination.score !== null && metrics.contamination.score >= 75) strengths.push('No EPA-regulated facilities within 1,000 meters.')
  if (metrics.species.status === 'official' && metrics.species.score !== null && metrics.species.score >= 75) strengths.push('No USFWS critical habitat intersects the selected point.')

  if (overlays?.floodplain.value?.sfhaFraction ?? official?.flood.value?.sfha) {
    const pct = overlays?.floodplain.value ? ` ${Math.round(overlays.floodplain.value.sfhaFraction * 100)}%` : ''
    redFlags.push(`The parcel${hasOverlays ? ` (${pct})` : ' / selected point'} is in a FEMA Special Flood Hazard Area.`)
  }
  if (overlays?.wetlands.value?.wetlandFraction ?? official?.environmental.value?.mappedWetland) {
    const pct = overlays?.wetlands.value ? ` ${Math.round(overlays.wetlands.value.wetlandFraction * 100)}%` : ''
    redFlags.push(`The parcel${hasOverlays ? ` (${pct})` : ' / selected point'} intersects NWI wetlands.`)
  }
  if (metrics.slope.status === 'official' && metrics.slope.score !== null && metrics.slope.score < 50) redFlags.push(hasOverlays ? 'USGS parcel-wide terrain indicates potentially costly slope.' : 'USGS terrain samples indicate potentially costly slope.')
  if (metrics.access.score !== null && metrics.access.score < 50) redFlags.push('Mapped-road proximity or stated frontage is weak.')
  if (metrics.utilities.status === 'user' && metrics.utilities.score !== null && metrics.utilities.score < 40) redFlags.push('You indicated utilities are not nearby.')
  if (metrics.zoning.status === 'user' && metrics.zoning.score !== null && metrics.zoning.score < 30) redFlags.push('Your zoning notes indicate the use may be prohibited or requires rezoning.')
  if (Number(inputs.acres) > 0 && Number(inputs.acres) < 1 && inputs.intendedUse !== 'residential') redFlags.push('Reported acreage may be too small for the intended non-residential use.')
  if (metrics.market.status === 'official' && metrics.market.score !== null && metrics.market.score < 50) redFlags.push('ACS tract population change is weak.')
  if (metrics.soils.status === 'official' && metrics.soils.score !== null && metrics.soils.score < 40) redFlags.push('NRCS soils ratings are severe for septic/dwelling — geotechnical review and perc testing are critical.')
  if (overlays?.soils.value && overlays.soils.value.severeFraction > 0.30) redFlags.push(`${Math.round(overlays.soils.value.severeFraction * 100)}% of the parcel has severe NRCS soil ratings — significant subtraction from net developable acreage.`)
  if (metrics.contamination.status === 'official' && metrics.contamination.score !== null && metrics.contamination.score < 40) redFlags.push('EPA-regulated facilities with major hazardous/toxic flags are within 1,000 meters.')
  if (metrics.species.status === 'official' && metrics.species.score !== null && metrics.species.score < 40) redFlags.push('The selected point intersects USFWS critical habitat — agency consultation is required.')
  if (hazards?.available) {
    for (const hazard of hazards.hazards) {
      if (!hazard.available || hazard.penalty >= 0) continue
      if (hazard.type === 'seaLevelRise' && hazard.level === 'severe') redFlags.push('NOAA projects this point is within the 1.5 ft sea-level rise inundation area.')
      if (hazard.type === 'wildfire' && (hazard.level === 'high' || hazard.level === 'severe')) redFlags.push(`USFS wildfire hazard potential is ${hazard.level} at this point.`)
      if (hazard.type === 'radon' && hazard.level === 'high') redFlags.push('EPA Radon Zone 1 (highest potential) — radon-resistant construction is recommended.')
    }
  }
  if (overlays?.netDevelopable && overlays.netDevelopable.netToGrossRatio < 0.50) redFlags.push(`Net developable ratio is only ${Math.round(overlays.netDevelopable.netToGrossRatio * 100)}% — over half the parcel is constrained.`)

  for (const metric of Object.values(metrics)) {
    if (metric.status !== 'unknown') continue
    unknowns.push(`${metric.label} could not be verified from an official source.`)
  }
  if (inputs.utilitiesNearby === 'unknown') unknowns.push('Utility availability and capacity are unknown.')
  if (!inputs.zoningNotes.trim()) unknowns.push('Zoning and future land use have not been verified.')
  if (inputs.roadFrontage === 'unknown') unknowns.push('Legal road frontage has not been verified.')
  if (metrics.market.status === 'official' && inputs.intendedUse !== 'residential' && inputs.intendedUse !== 'mixed-use') {
    unknowns.push(`Census BPS permits are a residential-structure signal; for ${inputs.intendedUse} use, a market study of ${inputs.intendedUse === 'commercial' ? 'retail/commercial rents, vacancy, and household income' : inputs.intendedUse === 'industrial' ? 'industrial vacancy, lease rates, and employment' : 'intended-use demand and absorption'} is still needed.`)
  }
  unknowns.push(hasOverlays
    ? 'Parcel-wide overlays are loaded for FEMA, NWI, slope, soils, stormwater, easements, EPA contamination, USFWS critical habitat, and perimeter setbacks. Net developable acreage subtracts the union of floodway, wetlands, steep slope, hydric/severe soils, mapped easements, and setbacks. Contamination and critical habitat are hard gates (not land-use takeouts) and are not subtracted from net developable acreage. Setback distances are conservative US defaults by intended use; verify with the local zoning ordinance.'
    : hasParcelBoundary
      ? 'A parcel boundary is loaded, but flood, wetland, slope, soils, and easement metrics still describe the selected point — not the entire parcel.'
      : 'This is a point screen; parcel boundaries, ownership, easements, and net buildable acreage are not loaded.')
  if (regionalHazardModifier === 0 && !hazards?.available) unknowns.push('Regional hazard modifier (sea-level rise, wildfire, radon) could not be screened from NOAA, USFS, or EPA. This may be a CORS limitation.')
  else if (regionalHazardModifier === 0 && hazards?.available) unknowns.push('Regional hazard sources returned data but no hazard penalty was applied.')
  else if (regionalHazardModifier < 0) {
    const activeHazards = hazards!.hazards.filter((h) => h.available && h.penalty < 0).map((h) => h.type === 'seaLevelRise' ? 'sea-level rise' : h.type === 'wildfire' ? 'wildfire' : 'radon')
    unknowns.push(`Regional hazard modifier ${regionalHazardModifier} from: ${activeHazards.join(', ')}. These are screening-level modifiers, not site-specific assessments.`)
  }

  return {
    finalScore, rawScore, scoredWeight,
    ...getVerdict(rawScore, scoredWeight, gatedToManual, evidenceCoverage),
    confidence, confidenceLabel, confidencePenalty, regionalHazardModifier,
    hardGates, gatedToManual, metrics,
    strengths: strengths.length ? strengths : ['No major strength has been verified yet.'],
    redFlags: redFlags.length ? redFlags : ['No hard constraint was detected at the selected point by the available sources.'],
    unknowns,
    nextSteps: buildNextSteps(triggeredGates, hasParcelBoundary, hasOverlays),
  }
}

function buildNextSteps(triggeredGates: HardGate[], hasParcelBoundary: boolean, hasOverlays = false): string[] {
  const steps: string[] = []
  if (triggeredGates.length > 0) {
    steps.push('Resolve the hard-gate findings above before investing further time or capital.')
  }
  if (!hasOverlays) {
    steps.push(
      hasParcelBoundary
        ? 'Run FEMA, NWI, slope, soils, stormwater, easements, and setbacks as full parcel overlays to calculate net buildable acreage.'
        : 'Load or obtain the assessor parcel boundary, then rerun FEMA, NWI, slope, soils, stormwater, and easements as parcel-wide overlays.',
    )
  } else {
    steps.push('Add parcel-wide contamination, species, and jurisdiction-specific setback overlays for a complete net-buildable-area calculation.')
  }
  steps.push(
    'Confirm ownership, easements, legal access, and frontage from title and recorded plats (ALTA survey when required).',
    'Request a boundary/topographic survey and civil review for grading and drainage.',
    'Verify zoning, future land use, setbacks, density, and entitlements with the local jurisdiction.',
    'Request will-serve / capacity letters from water, wastewater, electric, and stormwater providers.',
    'Complete wetlands, waters, soils, threatened-species, and Phase I environmental due diligence.',
    'Test the intended use with permits, employment, supply, absorption, and project-level financial analysis.',
  )
  return steps
}
