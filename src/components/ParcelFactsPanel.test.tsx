import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ParcelFactsPanel } from './ParcelFactsPanel'

describe('ParcelFactsPanel', () => {
  it('renders normalized record, valuation, improvement, service, and land facts', () => {
    render(<ParcelFactsPanel facts={{
      situsAddress: '101 Main Street', propertyUseDescription: 'Commercial land', zoning: 'C2', legalDescription: 'Lot 7 Block A',
      marketValue: 1_500_000, lastSalePrice: 900_000, lastSaleDate: '2023-08', yearBuilt: 1998, buildingAreaSqFt: 12_000,
      waterService: 'City Water', frontageFeet: 125, agriculturalAcres: 3.5, recordUrl: 'https://assessor.example.gov/parcel/1',
    }} provenance={{ source: 'County assessor', sourceUrl: 'https://assessor.example.gov', vintage: '2026 roll' }} />)

    expect(screen.getByText('Official parcel facts')).toBeInTheDocument()
    expect(screen.getByText('$1,500,000')).toBeInTheDocument()
    expect(screen.getByText('$900,000 · 2023-08')).toBeInTheDocument()
    expect(screen.getByText('125 ft')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open assessor record' })).toHaveAttribute('href', 'https://assessor.example.gov/parcel/1')
    expect(screen.getByText(/Values can lag the current market/)).toBeInTheDocument()
  })

  it('renders nothing when a provider returns no normalized facts', () => {
    const { container } = render(<ParcelFactsPanel />)
    expect(container).toBeEmptyDOMElement()
  })

  it('can omit its embedded heading inside the printable report section', () => {
    render(<ParcelFactsPanel facts={{ zoning: 'C2' }} showHeading={false} />)
    expect(screen.queryByText('Official parcel facts')).not.toBeInTheDocument()
    expect(screen.getByText('C2')).toBeInTheDocument()
  })
})
