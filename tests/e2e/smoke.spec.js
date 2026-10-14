import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Force the download fallback; a share sheet cannot be driven headlessly
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
  })
})

test('add, weigh, archive, filter and export', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Add to Home Screen' })).toBeVisible()
  await page.getByRole('button', { name: 'Use in browser anyway' }).click()

  // Add a product
  await page.getByRole('link', { name: 'Add filament' }).click()
  await page.getByLabel('Brand').fill('Bambu')
  await page.getByLabel('Material').selectOption('PETG')
  // Preset values show as hints under empty boxes, not as look-alike values inside them
  await expect(page.getByLabel('Nozzle min')).toHaveValue('')
  await expect(page.getByText('PETG preset: 230', { exact: true })).toBeVisible()
  await page.getByLabel('Category').selectOption('HF')
  await expect(page.getByText('PETG HF preset: 230', { exact: true })).toBeVisible()
  // Spool size is a picker; 1 kg is the default, 500 g can be chosen
  const sizes = page.getByRole('group', { name: 'Spool size' })
  await expect(sizes.getByRole('button', { name: '1 kg' })).toHaveAttribute('aria-pressed', 'true')
  await sizes.getByRole('button', { name: '500 g' }).click()
  await expect(sizes.getByRole('button', { name: '500 g' })).toHaveAttribute('aria-pressed', 'true')
  await sizes.getByRole('button', { name: '1 kg' }).click()
  await page.getByLabel('Colour name').fill('Jade White')
  await page.getByLabel('Hex', { exact: true }).fill('#F0F0E8')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Bambu PETG HF Jade White' })).toBeVisible()

  // Enter grams left, read off the spool's markings
  await page.getByRole('button', { name: 'Spool #1' }).click()
  await expect(page.getByText('of 1000 g')).toBeVisible()
  const left = page.getByLabel('Grams left')
  await left.fill('850')
  await left.press('Enter')
  await expect(page.getByRole('button', { name: 'Spool #1' })).toContainText('850 g')

  // Location then a level tap must not undo each other
  await page.getByLabel('Location').fill('Box A')
  await page.getByRole('button', { name: '1/2', exact: true }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Spool #1' }).click()
  await expect(page.getByLabel('Location')).toHaveValue('Box A')
  await expect(page.getByRole('button', { name: '1/2', exact: true })).toHaveAttribute('aria-pressed', 'true')

  // Archive it
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Show archived (1)' })).toBeVisible()

  // Filter on the grid
  await page.getByRole('link', { name: 'Back' }).click()
  const tile = page.getByRole('link', { name: 'Bambu PETG HF Jade White' })
  await expect(tile).toHaveCount(0)
  await page.getByRole('button', { name: 'Show archived', exact: true }).click()
  await expect(tile).toBeVisible()
  const material = page.getByRole('group', { name: 'Material' })
  await material.getByRole('button', { name: 'PLA', exact: true }).click()
  await expect(tile).toHaveCount(0)
  await material.getByRole('button', { name: 'PLA', exact: true }).click()
  await material.getByRole('button', { name: 'PETG', exact: true }).click()
  await expect(tile).toBeVisible()

  // Export
  await page.getByRole('link', { name: 'Settings' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  expect((await download).suggestedFilename()).toMatch(/^spool-library-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await expect(page.getByText('Last backup: 0 days ago')).toBeVisible()
})
