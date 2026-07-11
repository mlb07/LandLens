import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.route(/https:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const url = route.request().url()
    const parsed = new URL(url)
    if (parsed.hostname === 'taxmaps.traviscountytx.gov' && parsed.pathname.endsWith('/Parcels/FeatureServer/0/query')) {
      if (parsed.searchParams.get('returnIdsOnly') === 'true') {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ objectIdFieldName: 'OBJECTID', objectIds: [101] }) })
      }
      if (parsed.searchParams.get('f') === 'geojson') {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {
              PROP_ID: 'T-101', situs_address: '101 Main Street', tcad_acres: 12.5, land_state_cd: 'F1', land_type_desc: 'Commercial land', sub_dec: 'Downtown subdivision',
              legal_desc: 'Lot 7 Block A', market_value: 1_500_000, appraised_val: 1_350_000, assessed_val: 1_200_000,
              land_homesite_val: 400_000, land_non_homesite_val: 100_000, imprv_homesite_val: 650_000, imprv_non_homesite_val: 50_000, F1year_imprv: 1998,
            },
            geometry: { type: 'Polygon', coordinates: [[[-97.744, 30.266], [-97.742, 30.266], [-97.742, 30.268], [-97.744, 30.268], [-97.744, 30.266]]] },
          }],
        }) })
      }
    }
    if (parsed.hostname === 'maps.austintexas.gov' && parsed.pathname.endsWith('/Shared/Zoning_1/MapServer/0/query')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ features: [{ attributes: { ZONING_ZTYPE: 'SF-3-NP', ZONING_BASE: 'SF' } }] }) })
    }
    if (parsed.hostname === 'maps.austintexas.gov' && parsed.pathname.endsWith('/Shared/JurisdictionsFill/MapServer/0/query')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ features: [{ attributes: { CITY_NAME: 'City of Austin', JURISDICTION_LABEL: 'FULL PURPOSE', JURISDICTION_TYPE: 'FULL' } }] }) })
    }
    if (parsed.hostname === 'maps.austintexas.gov' && parsed.pathname.endsWith('/PropertyProfile/LongRangePlanning/MapServer/4/query')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ features: [{ attributes: { FUTURE_LAND_USE: 100 } }] }) })
    }
    if (parsed.hostname === 'maps.austintexas.gov' && parsed.pathname.endsWith('/Shared/Zoning_2/MapServer/identify')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [{ layerId: 22, layerName: 'Residential Design Standards', attributes: { ZONING_OVERLAY_SUB_NAME: 'Subchapter F' } }] }) })
    }
    // Map tiles are visual-only for this workflow; every data provider gets a
    // safe empty response so the test exercises the UI, not live API uptime.
    if (/tile\.openstreetmap\.org/.test(url)) return route.abort()
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ features: [], Table: [] }) })
  })
})

test('saves a site, compares it, and opens its report', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Map explorer/i })).toBeVisible()

  await page.getByRole('button', { name: /Site inputs/i }).click()
  await expect(page.getByText('50/50 states', { exact: true })).toBeVisible()
  await expect(page.getByText('Official parcel facts', { exact: true })).toBeVisible()
  await expect(page.getByText('$1,500,000', { exact: true })).toBeVisible()
  await expect(page.getByText('Local development profile', { exact: true })).toBeVisible()
  await expect(page.getByText('SF-3-NP · base SF-3', { exact: true })).toBeVisible()
  await page.getByTestId('proposed-use').selectOption('single_family')
  await expect(page.getByText('Permitted in base table', { exact: true })).toBeVisible()
  await expect(page.getByText('Table cell: P', { exact: true })).toBeVisible()
  await page.getByLabel('Site name').fill('E2E screening tract')
  await page.getByLabel('Acres').fill('12.5')
  await page.getByRole('button', { name: /^Yes$/ }).first().click()
  await page.getByRole('button', { name: /Save site/i }).click()
  await expect(page.getByRole('status')).toContainText('Site saved to this browser')

  await page.getByRole('button', { name: /Compare sites/i }).click()
  await expect(page.getByRole('heading', { name: 'Compare saved sites' })).toBeVisible()
  await expect(page.getByRole('button', { name: /E2E screening tract/i })).toBeVisible()
  await page.getByTitle('View report').click()
  await expect(page.getByRole('heading', { name: 'Score breakdown' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Official parcel facts' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Local development profile' })).toBeVisible()
  await expect(page.getByText('Single Family', { exact: true })).toBeVisible()
  await expect(page.getByText('Single-family home', { exact: true })).toBeVisible()
  await expect(page.getByText('Permitted in base table', { exact: true })).toBeVisible()
  await expect(page.getByText('Lot 7 Block A', { exact: true })).toBeVisible()
})
