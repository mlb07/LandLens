import { Building2, ExternalLink, Layers3, Ruler } from 'lucide-react'
import { assessJurisdictionProposedUse, getJurisdictionPack, getJurisdictionSources, jurisdictionStatusLabel } from '../data/jurisdictions/registry'
import type { IntendedUse, JurisdictionAuthority, JurisdictionProfile, ProposedUseId } from '../types/site'

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function standardRows(profile?: JurisdictionProfile): Array<{ label: string; value: string }> {
  const s = profile?.standards
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

export function JurisdictionPanel({ profile, authority, intendedUse, proposedUse, showHeading = true }: {
  profile?: JurisdictionProfile
  authority?: JurisdictionAuthority
  intendedUse: IntendedUse
  proposedUse?: ProposedUseId
  showHeading?: boolean
}) {
  if (!profile && !authority) return null
  const pack = getJurisdictionPack(profile)
  const rows = standardRows(profile)
  const status = profile?.useCompatibility[intendedUse]
  const useAssessment = assessJurisdictionProposedUse(profile, proposedUse)
  const reviewFlags = profile ? (useAssessment ? profile.reviewFlags.filter((flag) => !flag.startsWith('Permitted-use status depends')) : profile.reviewFlags) : []
  const sources = getJurisdictionSources(profile)
  return (
    <section className="jurisdiction-card">
      {showHeading && <div className="jurisdiction-heading"><div><Building2 size={15} /><span>{profile ? 'Local development profile' : 'National authority context'}</span><em>{profile ? 'Verified local pack' : 'Census geography'}</em></div><p>{profile?.profileDescription ?? authority?.coverageNote}</p></div>}
      <dl className="jurisdiction-summary">
        <div><dt>{profile ? 'Planning authority' : 'Census geography'}</dt><dd>{profile?.authorityName ?? authority?.authorityName}</dd></div>
        {profile && <div><dt>Jurisdiction</dt><dd>{profile.jurisdictionLabel}</dd></div>}
        {!profile && authority?.countyName && <div><dt>County</dt><dd>{authority.countyName}</dd></div>}
        {profile && <div><dt>Mapped zoning</dt><dd>{profile.zoningCode || 'Unlabeled'}{profile.baseDistrict && profile.baseDistrict !== profile.zoningCode ? ` · base ${profile.baseDistrict}` : ''}</dd></div>}
        {status && <div className={`use-status ${status}`}><dt>Broad {intendedUse.replace('-', ' ')} screen</dt><dd>{jurisdictionStatusLabel(status)}</dd></div>}
        {useAssessment && <div className={`exact-use-status ${useAssessment.status}`}><dt>{useAssessment.useLabel}</dt><dd>{useAssessment.statusLabel}</dd></div>}
        {profile?.futureLandUse && <div><dt>Future land use</dt><dd>{profile.futureLandUse}</dd></div>}
      </dl>
      {useAssessment && <div className={`jurisdiction-use-assessment ${useAssessment.status}`}><strong>{useAssessment.sourceSection} base-use result</strong><p>{useAssessment.explanation}</p>{useAssessment.rawCell && <span>Table cell: {useAssessment.rawCell}</span>}</div>}
      {profile && profile.overlays.length > 0 && <div className="jurisdiction-overlays"><h3><Layers3 size={12} /> Mapped overlays</h3><ul>{profile.overlays.map((overlay) => <li key={`${overlay.layerId}-${overlay.detail ?? overlay.name}`}><strong>{overlay.name}</strong>{overlay.detail && overlay.detail !== overlay.name ? <span>{overlay.detail}</span> : null}</li>)}</ul></div>}
      {profile && rows.length > 0 && <div className="jurisdiction-standards"><h3><Ruler size={12} /> Principal {profile.baseDistrict} standards</h3><dl>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>{profile.standards?.notes.map((note) => <p key={note}>{note}</p>)}</div>}
      {reviewFlags.length > 0 && <div className="jurisdiction-flags"><strong>Manual review flags</strong><ul>{reviewFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul></div>}
      <div className="jurisdiction-sources">
        {sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.id}><ExternalLink size={10} /> {source.label}</a>)}
        {!profile && <a href="https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_restmapservice.html" target="_blank" rel="noreferrer"><ExternalLink size={10} /> Census geography</a>}
      </div>
      {profile && !pack && <p className="jurisdiction-pack-warning">Saved legacy profile; live jurisdiction-pack functions will return after the site is refreshed.</p>}
    </section>
  )
}
