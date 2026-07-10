import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear())
  await page.route(/https:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const url = route.request().url()
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
})
