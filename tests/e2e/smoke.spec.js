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
  await expect(page.getByLabel('Nozzle min')).toHaveAttribute('placeholder', '230')
  await page.getByLabel('Colour name').fill('Jade White')
  await page.getByLabel('Hex', { exact: true }).fill('#F0F0E8')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Bambu PETG Jade White' })).toBeVisible()

  // Weigh the spool
  await page.getByRole('button', { name: 'Spool #1' }).click()
  const scale = page.getByLabel('Filament on scale (g)')
  await scale.fill('850')
  await scale.press('Enter')
  await expect(page.getByText('850 g left')).toBeVisible()

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
  const tile = page.getByRole('link', { name: 'Bambu PETG Jade White' })
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
