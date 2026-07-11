import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { buildAustinJurisdictionProfile } from '../data/austinJurisdiction'
import { EMPTY_SITE_INPUTS } from '../types/site'
import { SiteForm } from './SiteForm'
import { registerDefaultJurisdictionPacks } from '../data/jurisdictions/defaultPacks'

registerDefaultJurisdictionPacks()

const profile = buildAustinJurisdictionProfile({ zoningCode: 'SF-3-NP', baseDistrict: 'SF', jurisdictionCode: 'FULL' })

describe('SiteForm jurisdiction proposed use', () => {
  it('maps a concrete use to its broad intended-use model', () => {
    const onChange = vi.fn()
    render(<SiteForm inputs={EMPTY_SITE_INPUTS} jurisdiction={profile} onChange={onChange} onAnalyze={() => undefined} dirty={false} />)
    fireEvent.change(screen.getByTestId('proposed-use'), { target: { value: 'restaurant_general' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ proposedUse: 'restaurant_general', intendedUse: 'commercial' }))
  })

  it('clears a concrete use when the broad intended use is changed manually', () => {
    const onChange = vi.fn()
    render(<SiteForm inputs={{ ...EMPTY_SITE_INPUTS, intendedUse: 'commercial', proposedUse: 'restaurant_general' }} jurisdiction={profile} onChange={onChange} onAnalyze={() => undefined} dirty={false} />)
    fireEvent.change(screen.getByLabelText('Intended use'), { target: { value: 'industrial' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ intendedUse: 'industrial', proposedUse: undefined }))
  })
})
