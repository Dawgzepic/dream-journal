import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const artifacts = '/opt/cursor/artifacts'

async function enterPin(page, digits) {
  for (const digit of digits) await page.getByTestId(`pin-${digit}`).click()
}

async function saveDream(page, title, story) {
  await page.evaluate(() => { location.hash = '#/new' })
  await expect(page.getByRole('heading', { name: 'New dream' })).toBeVisible()
  await page.getByTestId('dream-title').fill(title)
  await page.getByTestId('dream-story').fill(story)
  await page.getByTestId('save-dream').click()
  await expect(page.getByRole('heading', { name: 'Dream details' })).toBeVisible()
  await page.getByTestId('skip-details').click()
  await expect(page.getByTestId('dream-title-view')).toHaveText(title)
}

test('themes overview and one item page on a phone', async ({ page }) => {
  fs.mkdirSync(artifacts, { recursive: true })
  await page.setViewportSize({ width: 412, height: 915 })
  await page.goto('/dream-journal/')
  await expect(page.getByTestId('lock-title')).toHaveText('Choose a PIN')
  await enterPin(page, '1212')
  await enterPin(page, '1212')
  await saveDream(page, 'Fleas', 'I rolled over in my bed and noticed specks on the dog bed, then threw the sheet out the window.')
  await saveDream(page, 'Puppy', 'The puppy waited by the door again.')
  await page.locator('a[href="#/patterns"]').first().click()
  await expect(page.getByTestId('themes-overview')).toBeVisible()
  await expect(page.getByTestId('theme-group-things')).toContainText(/Dog/i)
  await page.screenshot({ path: path.join(artifacts, 'themes-overview.png'), fullPage: true })
  await page.getByTestId('theme-group-things').getByRole('link', { name: /Dog/i }).click()
  await expect(page.getByTestId('theme-title')).toHaveText('Dog')
  await expect(page.getByTestId('theme-note')).toContainText(/2 dreams/)
  await expect(page.getByTestId('theme-dreams')).toContainText('Fleas')
  await expect(page.getByTestId('theme-dreams')).toContainText('Puppy')
  const hide = page.getByTestId('theme-hide')
  await hide.scrollIntoViewIfNeeded()
  const hideBox = await hide.boundingBox()
  const nav = await page.getByTestId('nav').boundingBox()
  expect(hideBox.y + hideBox.height).toBeLessThanOrEqual(nav.y + 1)
  await page.screenshot({ path: path.join(artifacts, 'theme-item.png'), fullPage: true })
})
