import { Building2, ExternalLink, Layers3, Ruler } from 'lucide-react'
import { AUSTIN_FLUM_SOURCE_URL, AUSTIN_JURISDICTION_SOURCE_URL, AUSTIN_OVERLAY_SOURCE_URL, AUSTIN_STANDARDS_SOURCE_URL, jurisdictionStatusLabel } from '../data/austinJurisdiction'
import type { IntendedUse, JurisdictionProfile } from '../types/site'
import type { AustinProposedUse } from '../types/site'
import { AUSTIN_PERMITTED_USES_SOURCE_URL, assessAustinProposedUse, austinUseStatusLabel } from '../data/austinPermittedUses'

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function standardRows(profile: JurisdictionProfile): Array<{ label: string; value: string }> {
  const s = profile.standards
  if (!s) return []
  return [
    s.minimumLotSquareFeet ? { label: 'Minimum lot', value: `${number.format(s.minimumLotSquareFeet)} sq ft` } : undefined,
    s.minimumLotWidthFeet ? { label: 'Minimum width', value: `${number.format(s.minimumLotWidthFeet)} ft` } : undefined,
    s.maximumHeightFeet ? { label: 'Maximum height', value: `${number.format(s.maximumHeightFeet)} ft` } : undefined,
    s.frontSetbackFeet && s.interiorSideSetbackFeet && s.rearSetbackFeet
      ? { label: 'Front / side / rear', value: `${s.frontSetbackFeet} / ${s.interiorSideSetbackFeet} / ${s.rearSetbackFeet} ft` }
      : undefined,
    s.streetSideSetbackFeet ? { label: 'Street-side yard', value: `${s.streetSideSetbackFeet} ft` } : undefined,
    s.maximumBuildingCoveragePercent ? { label: 'Building coverage', value: `${s.maximumBuildingCoveragePercent}% max` } : undefined,
    s.maximumImperviousCoverPercent ? { label: 'Impervious cover', value: `${s.maximumImperviousCoverPercent}% max` } : undefined,
    s.maximumFloorAreaRatio ? { label: 'Floor-area ratio', value: `${s.maximumFloorAreaRatio}:1 max` } : undefined,
  ].filter((row): row is { label: string; value: string } => row !== undefined)
}

export function JurisdictionPanel({ profile, intendedUse, proposedUse, showHeading = true }: { profile?: JurisdictionProfile; intendedUse: IntendedUse; proposedUse?: AustinProposedUse; showHeading?: boolean }) {
  if (!profile) return null
  const rows = standardRows(profile)
  const status = profile.useCompatibility[intendedUse]
  const useAssessment = assessAustinProposedUse(profile, proposedUse)
  const reviewFlags = useAssessment ? profile.reviewFlags.filter((flag) => !flag.startsWith('Permitted-use status depends')) : profile.reviewFlags
  return (
    <section className="jurisdiction-card">
      {showHeading && <div className="jurisdiction-heading"><div><Building2 size={15} /><span>Local development profile</span><em>Live city GIS</em></div><p>Jurisdiction-aware zoning screen for Austin/Travis. District-family compatibility is not a permitted-use determination.</p></div>}
      <dl className="jurisdiction-summary">
        <div><dt>Planning authority</dt><dd>{profile.authorityName}</dd></div>
        <div><dt>Jurisdiction</dt><dd>{profile.jurisdictionLabel}</dd></div>
        <div><dt>Mapped zoning</dt><dd>{profile.zoningCode || 'Unlabeled'}{profile.baseDistrict && profile.baseDistrict !== profile.zoningCode ? ` · base ${profile.baseDistrict}` : ''}</dd></div>
        <div className={`use-status ${status}`}><dt>Broad {intendedUse.replace('-', ' ')} screen</dt><dd>{jurisdictionStatusLabel(status)}</dd></div>
        {useAssessment && <div className={`exact-use-status ${useAssessment.status}`}><dt>{useAssessment.useLabel}</dt><dd>{austinUseStatusLabel(useAssessment.status)}</dd></div>}
        {profile.futureLandUse && <div><dt>Future land use</dt><dd>{profile.futureLandUse}</dd></div>}
      </dl>
      {useAssessment && <div className={`jurisdiction-use-assessment ${useAssessment.status}`}><strong>§25-2-491 base-use result</strong><p>{useAssessment.explanation}</p>{useAssessment.rawCell && <span>Table cell: {useAssessment.rawCell}</span>}</div>}
      {profile.overlays.length > 0 && <div className="jurisdiction-overlays"><h3><Layers3 size={12} /> Mapped overlays</h3><ul>{profile.overlays.map((overlay) => <li key={`${overlay.layerId}-${overlay.detail ?? overlay.name}`}><strong>{overlay.name}</strong>{overlay.detail && overlay.detail !== overlay.name ? <span>{overlay.detail}</span> : null}</li>)}</ul></div>}
      {rows.length > 0 && <div className="jurisdiction-standards"><h3><Ruler size={12} /> Principal {profile.baseDistrict} standards</h3><dl>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>{profile.standards?.notes.map((note) => <p key={note}>{note}</p>)}</div>}
      {reviewFlags.length > 0 && <div className="jurisdiction-flags"><strong>Manual review flags</strong><ul>{reviewFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul></div>}
      <div className="jurisdiction-sources">
        <a href={AUSTIN_JURISDICTION_SOURCE_URL} target="_blank" rel="noreferrer"><ExternalLink size={10} /> Jurisdiction</a>
        <a href={AUSTIN_OVERLAY_SOURCE_URL} target="_blank" rel="noreferrer"><ExternalLink size={10} /> Overlays</a>
        {profile.futureLandUse && <a href={AUSTIN_FLUM_SOURCE_URL} target="_blank" rel="noreferrer"><ExternalLink size={10} /> Future land use</a>}
        {profile.standards && <a href={AUSTIN_STANDARDS_SOURCE_URL} target="_blank" rel="noreferrer"><ExternalLink size={10} /> §25-2-492</a>}
        {useAssessment && <a href={AUSTIN_PERMITTED_USES_SOURCE_URL} target="_blank" rel="noreferrer"><ExternalLink size={10} /> §25-2-491</a>}
      </div>
    </section>
  )
}
