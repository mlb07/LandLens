import { BadgeCheck, Calculator, ChevronDown, Info, MapPinned } from 'lucide-react'
import type { IntendedUse, ParcelSelection, SiteInputs, TriState } from '../types/site'

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

export function SiteForm({ inputs, parcel, onChange, onAnalyze, dirty }: {
  inputs: SiteInputs
  parcel?: ParcelSelection
  onChange: (inputs: SiteInputs) => void
  onAnalyze: () => void
  dirty: boolean
}) {
  function update<K extends keyof SiteInputs>(key: K, value: SiteInputs[K]) {
    onChange({ ...inputs, [key]: value })
  }

  return (
    <div className="site-form">
      <div className="panel-heading">
        <div className="eyebrow"><MapPinned size={14} /> Site details</div>
        <h2>What do you know?</h2>
        <p>Enter what you have. Unknown answers are acceptable and will lower confidence—not secretly count as facts.</p>
      </div>

      {parcel?.status === 'found' && <div className="parcel-autofill-note"><BadgeCheck size={15} /><div><strong>Official parcel match</strong><span>{parcel.acreageKind === 'assessor' ? 'Name and acreage came from official parcel attributes.' : 'Name came from the parcel record when available; mapped acreage was calculated from the returned official boundary.'} Review before relying on them.</span></div></div>}

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
            <select value={inputs.intendedUse} onChange={(event) => update('intendedUse', event.target.value as IntendedUse)}>
              {intendedUses.map((use) => <option key={use.value} value={use.value}>{use.label}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
        </label>
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
