import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Protect the menu-only live baseline. These checks exercise reads and reconnect only.
  await page.route('**/rest/v1/**', async route => {
    if (['POST','PATCH','DELETE','PUT'].includes(route.request().method())&&!route.request().url().endsWith('/rnl_pos_staff_directory')) await route.abort('blockedbyclient')
    else await route.continue()
  })
})

test('tablet POS loads the real menu and reconciles on reconnect', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const errors: string[] = []
  let productReads = 0
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.url().includes('/rest/v1/products?')) productReads++ })
  await page.goto('/pos.html', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await expect(page.locator('.menu-card')).toHaveCount(67, { timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Refresh POS data' })).toHaveCount(0)
  const initialReads = productReads
  await context.setOffline(true)
  await expect(page.getByText('Offline', { exact: true })).toBeVisible()
  await context.setOffline(false)
  await expect.poll(() => productReads).toBeGreaterThan(initialReads)
  await expect(page.locator('.menu-card')).toHaveCount(67)
  await page.getByRole('searchbox', { name: 'Search menu items' }).fill('no-such-synthetic-dish')
  await expect(page.getByText('No menu items found', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('phone admin opens without runtime errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true }).first()).toBeVisible({ timeout: 30000 })
  expect(errors).toEqual([])
})
