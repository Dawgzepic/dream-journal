import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const artifacts = '/opt/cursor/artifacts'

async function enterPin(page, digits) {
  for (const digit of digits) await page.getByTestId(`pin-${digit}`).click()
}

test('a fragments night on a phone', async ({ page }) => {
  fs.mkdirSync(artifacts, { recursive: true })
  await page.setViewportSize({ width: 412, height: 915 })
  await page.goto('/dream-journal/')
  await expect(page.getByTestId('lock-title')).toHaveText('Choose a PIN')
  await enterPin(page, '1212')
  await enterPin(page, '1212')
  await page.evaluate(() => { location.hash = '#/new' })
  await expect(page.getByRole('heading', { name: 'New dream' })).toBeVisible()
  const toggle = page.getByTestId('fragments-toggle')
  await expect(toggle).toHaveText(/Fragments — jumbled night/)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('dream-story')).toHaveAttribute('placeholder', 'Optional: anything you caught')
  await expect(page.getByTestId('save-dream')).toBeEnabled()
  await page.screenshot({ path: path.join(artifacts, 'new-entry-fragments.png') })
  await page.getByTestId('dream-story').fill('a blue door, then water')
  await page.getByTestId('save-dream').click()
  await expect(page.getByRole('heading', { name: 'Dream details' })).toHaveCount(0)
  await expect(page.getByTestId('fragments-note')).toHaveText('A night of fragments — lots of dreaming, little to hold onto.')
  await expect(page.getByTestId('fragments-badge')).toContainText('Fragments')
  await expect(page.getByTestId('dream-story-view')).toHaveText('a blue door, then water')
  await expect(page.getByTestId('open-meaning')).toHaveCount(0)
  await expect(page.getByTestId('add-details')).toHaveCount(0)
  await page.screenshot({ path: path.join(artifacts, 'fragments-entry.png') })
  await page.locator('a[href="#/journal"]').first().click()
  await expect(page.getByTestId('dream-item').filter({ hasText: 'Fragments' })).toBeVisible()
  await expect(page.getByTestId('fragments-badge')).toContainText('Fragments')
  const labels = await page.locator('#nav a span').allTextContents()
  expect(labels).toEqual(['Home', 'Journal', 'Patterns', 'You', 'Settings'])
  await page.screenshot({ path: path.join(artifacts, 'journal-fragments.png') })
})
