import { BadgeCheck, Calculator, ChevronDown, Info, MapPinned } from 'lucide-react'
import type { IntendedUse, JurisdictionAuthority, JurisdictionProfile, NationalContextFinding, ParcelSelection, SiteInputs, TriState } from '../types/site'
import { JurisdictionPanel } from './JurisdictionPanel'
import { ParcelFactsPanel } from './ParcelFactsPanel'
import { getJurisdictionPack, getJurisdictionProposedUseDefinition, getJurisdictionProposedUses } from '../data/jurisdictions/registry'
import type { CoverageTelemetry } from '../data/coverageProvider'
import { CoveragePanel } from './CoveragePanel'
import { NationalContextPanel } from './NationalContextPanel'

const intendedUses: Array<{ value: IntendedUse; label: string }> = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed-use', label: 'Mixed-use' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'other', label: 'Other' },
]

function TriStateField({ label, value, onChange }: { label: string; value: TriState; onChange: (value: TriState) => void }) {
  return (
    <fieldset className="field tri-state-field">
      <legend>{label}</legend>
      <div className="segmented-control">
        {(['yes', 'no', 'unknown'] as TriState[]).map((option) => (
          <button type="button" key={option} className={value === option ? 'active' : ''} onClick={() => onChange(option)}>
            {option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function SiteForm({ inputs, parcel, jurisdiction, authority, coverage, nationalContext, onChange, onAnalyze, dirty }: {
  inputs: SiteInputs
  parcel?: ParcelSelection
  jurisdiction?: JurisdictionProfile
  authority?: JurisdictionAuthority
  coverage?: CoverageTelemetry
  nationalContext?: NationalContextFinding[]
  onChange: (inputs: SiteInputs) => void
  onAnalyze: () => void
  dirty: boolean
}) {
  function update<K extends keyof SiteInputs>(key: K, value: SiteInputs[K]) {
    onChange({ ...inputs, [key]: value })
  }

  function selectProposedUse(value: string) {
    if (!value) {
      onChange({ ...inputs, proposedUse: undefined })
      return
    }
    const definition = getJurisdictionProposedUseDefinition(jurisdiction, value)
    onChange({ ...inputs, proposedUse: definition?.key, intendedUse: definition?.intendedUse ?? inputs.intendedUse })
  }

  function selectIntendedUse(value: IntendedUse) {
    onChange({ ...inputs, intendedUse: value, proposedUse: undefined })
  }

  return (
    <div className="site-form">
      <div className="panel-heading">
        <div className="eyebrow"><MapPinned size={14} /> Site details</div>
        <h2>What do you know?</h2>
        <p>Enter what you have. Unknown answers are acceptable and will lower confidence—not secretly count as facts.</p>
      </div>

      {coverage && <CoveragePanel coverage={coverage} />}

      <NationalContextPanel findings={nationalContext} />

      {parcel?.status === 'found' && <div className="parcel-autofill-note"><BadgeCheck size={15} /><div><strong>Official parcel match</strong><span>{parcel.acreageKind === 'assessor' ? 'Name and acreage came from official parcel attributes.' : 'Name came from the parcel record when available; mapped acreage was calculated from the returned official boundary.'} Review before relying on them.</span></div></div>}

      {parcel?.status === 'found' && <ParcelFactsPanel facts={parcel.facts} provenance={parcel.provenance} />}

      {(jurisdiction || authority) && <JurisdictionPanel profile={jurisdiction} authority={authority} intendedUse={inputs.intendedUse} proposedUse={inputs.proposedUse} />}

      <div className="form-grid">
        <label className="field field-full">
          <span>Site name</span>
          <input value={inputs.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Cedar Creek tract" />
        </label>
        <label className="field">
          <span>Acres</span>
          <input value={inputs.acres} onChange={(event) => update('acres', event.target.value)} type="number" min="0" step="0.1" placeholder="0.0" />
        </label>
        <label className="field">
          <span>Estimated land price</span>
          <div className="input-prefix"><span>$</span><input value={inputs.estimatedPrice} onChange={(event) => update('estimatedPrice', event.target.value)} type="number" min="0" step="1000" placeholder="0" /></div>
        </label>
        <label className="field field-full">
          <span>City / county / state</span>
          <input value={inputs.location} onChange={(event) => update('location', event.target.value)} placeholder="e.g. Franklin County, Ohio" />
        </label>
        <label className="field field-full">
          <span>Intended use</span>
          <div className="select-wrap">
            <select value={inputs.intendedUse} onChange={(event) => selectIntendedUse(event.target.value as IntendedUse)}>
              {intendedUses.map((use) => <option key={use.value} value={use.value}>{use.label}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
        </label>
        {jurisdiction && getJurisdictionProposedUses(jurisdiction).length > 0 && <label className="field field-full proposed-use-field">
          <span>{getJurisdictionPack(jurisdiction)?.proposedUseLabel ?? 'Proposed-use detail'} <em>Optional</em></span>
          <div className="select-wrap">
            <select data-testid="proposed-use" value={inputs.proposedUse ?? ''} onChange={(event) => selectProposedUse(event.target.value)}>
              <option value="">Use broad intended-use screening</option>
              {Array.from(new Set(getJurisdictionProposedUses(jurisdiction).map((use) => use.group))).map((group) => (
                <optgroup label={group} key={group}>
                  {getJurisdictionProposedUses(jurisdiction).filter((use) => use.group === group).map((use) => <option key={use.key} value={use.key}>{use.label}</option>)}
                </optgroup>
              ))}
            </select>
            <ChevronDown size={16} />
          </div>
          <small>{getJurisdictionPack(jurisdiction)?.proposedUseHelpText ?? 'Checks the selected use against the registered local use table. Other code provisions and overlays may supersede the result.'}</small>
        </label>}
        <TriStateField label="Road frontage" value={inputs.roadFrontage} onChange={(value) => update('roadFrontage', value)} />
        <TriStateField label="Utilities nearby" value={inputs.utilitiesNearby} onChange={(value) => update('utilitiesNearby', value)} />
        <label className="field field-full">
          <span>Zoning notes</span>
          <textarea value={inputs.zoningNotes} onChange={(event) => update('zoningNotes', event.target.value)} placeholder="Known zoning, future land use, or entitlement notes" rows={3} />
        </label>
        <label className="field field-full">
          <span>Personal notes</span>
          <textarea value={inputs.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Broker details, questions, observations..." rows={3} />
        </label>
      </div>

      <div className="form-footnote"><Info size={15} /> Manual details are user-supplied and are not independently verified.</div>
      <button className="primary-button analyze-button" type="button" onClick={onAnalyze}>
        <Calculator size={18} /> {dirty ? 'Update development score' : 'Recalculate score'}
      </button>
    </div>
  )
}
