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

  it('renders expanded nationwide valuation, record, improvement, and land details', () => {
    render(<ParcelFactsPanel facts={{
      zoningConditions: 'Conditional overlay', deedReference: 'Book 12 Page 44', platReference: 'Plat 8',
      marketLandValue: 400_000, appraisedImprovementValue: 700_000, taxAmount: 12_500, saleQualification: 'Arms-length',
      garageAreaSqFt: 600, stories: 2, unitCount: 4, irrigationDescription: 'Irrigation district', waterfrontDescription: 'Riverfront',
      criticalAreaDescription: 'Critical Area 2', percTestArea: 1.25, agriculturalPreservationAcres: 8, forestPercent: 35,
    }} />)
    expect(screen.getByText('Conditional overlay')).toBeInTheDocument()
    expect(screen.getByText('Book 12 Page 44')).toBeInTheDocument()
    expect(screen.getByText('$400,000')).toBeInTheDocument()
    expect(screen.getByText('$12,500')).toBeInTheDocument()
    expect(screen.getByText('600 sq ft')).toBeInTheDocument()
    expect(screen.getByText('Irrigation district')).toBeInTheDocument()
    expect(screen.getByText('35%')).toBeInTheDocument()
  })

  it('can omit its embedded heading inside the printable report section', () => {
    render(<ParcelFactsPanel facts={{ zoning: 'C2' }} showHeading={false} />)
    expect(screen.queryByText('Official parcel facts')).not.toBeInTheDocument()
    expect(screen.getByText('C2')).toBeInTheDocument()
  })
})
