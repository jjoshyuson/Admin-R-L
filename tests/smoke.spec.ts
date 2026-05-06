import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const screenshotDir = path.resolve(process.cwd(), 'debug-screenshots')

async function ensureScreenshotDir() {
  await fs.mkdir(screenshotDir, { recursive: true })
}

async function capture(page: Page, fileName: string) {
  await ensureScreenshotDir()
  await page.screenshot({
    path: path.join(screenshotDir, fileName),
    fullPage: true,
  })
}

async function openMenuSettings(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /menu settings/i }).click()
  await page.waitForTimeout(800)
}

async function openRecipes(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /recipes & cost management/i }).click()
  await page.waitForTimeout(800)
}

function attachErrorTracking(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const mutationStatuses: Array<{ method: string; status: number; url: string }> = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack || error.message)
  })

  page.on('response', (response) => {
    const request = response.request()
    if (!response.url().includes('supabase')) {
      return
    }
    if (!['POST', 'PATCH', 'DELETE'].includes(request.method())) {
      return
    }
    mutationStatuses.push({
      method: request.method(),
      status: response.status(),
      url: response.url(),
    })
  })

  return { consoleErrors, pageErrors, mutationStatuses }
}

test('menu settings supports create, edit, delete, and refresh persistence', async ({ page }) => {
  const { consoleErrors, pageErrors, mutationStatuses } = attachErrorTracking(page)
  const itemName = `Smoke Menu ${Date.now()}`

  await openMenuSettings(page)
  await capture(page, '01-menu-settings-load.png')
  await capture(page, '10-mobile-menu-settings.png')

  await page.locator('.floating-add-button').click()
  await page.waitForTimeout(500)
  await capture(page, '02-menu-add-modal.png')

  await page.getByLabel('Menu / Product Name').fill(itemName)
  await page.getByLabel('Default Price').fill('123')
  const categorySelect = page.getByLabel('Category')
  if (await categorySelect.count()) {
    await categorySelect.selectOption({ index: 0 }).catch(() => {})
  }
  await page.getByRole('button', { name: /^Add Menu Item$/ }).click()
  await page.waitForTimeout(2500)
  await expect(page.getByText(itemName).first()).toBeVisible()
  await capture(page, '03-menu-after-save.png')

  await openMenuSettings(page)
  const createdCard = page.locator('.menu-item-card').filter({ hasText: itemName }).first()
  await createdCard.getByRole('button', { name: new RegExp(`Edit ${itemName}`) }).click()
  await page.waitForTimeout(500)
  await page.getByLabel('Default Price').fill('129')
  const halfPriceInput = page.getByLabel('Half Order Price')
  if (await halfPriceInput.count()) {
    await halfPriceInput.fill('64')
  } else {
    await expect(page.getByLabel('Menu item editor').getByText(/half-order pricing is unavailable/i)).toBeVisible()
  }
  await page.getByRole('button', { name: /Hidden/i }).click()
  await page.getByRole('button', { name: /^Save Changes$/ }).click()
  await page.waitForTimeout(2500)
  await capture(page, '04-menu-after-edit.png')

  await openMenuSettings(page)
  const editedCard = page.locator('.menu-item-card').filter({ hasText: itemName }).first()
  await editedCard.getByRole('button', { name: new RegExp(`Edit ${itemName}`) }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: /Remove Item/i }).click()
  await page.waitForTimeout(2500)
  await capture(page, '05-menu-after-delete.png')

  await openMenuSettings(page)
  await expect(page.getByText(itemName)).toHaveCount(0)

  expect(mutationStatuses.length).toBeGreaterThanOrEqual(3)
  expect(mutationStatuses.every((response) => response.status < 400)).toBe(true)
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('daily log and recipes open without runtime crashes', async ({ page }) => {
  const { consoleErrors, pageErrors } = attachErrorTracking(page)
  const ingredientName = `Smoke Ingredient ${Date.now()}`

  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /daily log/i }).click()
  await page.waitForTimeout(800)
  await capture(page, '06-daily-log.png')

  await page.getByRole('button', { name: /create daily log/i }).click()
  await page.waitForTimeout(500)
  await expect(page.getByRole('button', { name: /add ingredient/i })).toBeVisible()
  await page.getByRole('button', { name: /add ingredient/i }).click()
  await page.waitForTimeout(300)
  const ingredientInputs = page.getByLabel('Ingredient')
  await ingredientInputs.last().fill(ingredientName)
  await page.getByLabel('Price').last().fill('88')
  await page.getByLabel('Unit').last().fill('kg')
  await page.getByRole('button', { name: /save daily log/i }).click()
  await page.waitForTimeout(2500)
  const savedLogCard = page.locator('.record-card-button').first()
  await expect(savedLogCard).toBeVisible()
  await savedLogCard.click()
  await page.waitForTimeout(500)
  await expect(page.getByLabel('Daily log editor')).toBeVisible()
  await page.getByRole('button', { name: /close/i }).click()
  await page.waitForTimeout(400)

  await openRecipes(page)
  await capture(page, '07-recipe-tab-load.png')

  await page.getByRole('button', { name: /create recipe|manage recipe/i }).first().click()
  await page.waitForTimeout(800)
  await capture(page, '08-recipe-editor.png')
  await page.getByRole('button', { name: /close/i }).click()
  await page.waitForTimeout(400)

  await page.getByRole('button', { name: /add prep product/i }).first().click()
  await page.waitForTimeout(800)
  await capture(page, '09-prep-product-modal.png')

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('reset data modal exposes Android-style actions without crashing', async ({ page }) => {
  const { consoleErrors, pageErrors } = attachErrorTracking(page)

  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /reset data/i }).click()
  await page.waitForTimeout(500)

  await expect(page.getByRole('dialog', { name: /reset system data/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Testing Reset$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Empty Everything$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Safe State$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Clear Orders$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Clear Menu$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Clear Recipes$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Clear Logs$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Clear Inventory$/ })).toBeVisible()
  await page.getByRole('button', { name: /^Close$/ }).click()
  await page.waitForTimeout(300)

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test.describe('tablet layout', () => {
  test.use({ viewport: { width: 834, height: 1112 } })

  test('menu settings and recipes render on tablet width', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachErrorTracking(page)

    await openMenuSettings(page)
    await capture(page, '11-tablet-menu-settings.png')

    await openRecipes(page)
    await capture(page, '12-tablet-recipes.png')

    expect(consoleErrors).toEqual([])
    expect(pageErrors).toEqual([])
  })
})
