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

test('varied dreams make a non-repeating profile on a phone', async ({ page }) => {
  fs.mkdirSync(artifacts, { recursive: true })
  await page.setViewportSize({ width: 412, height: 915 })
  await page.goto('/dream-journal/')
  await expect(page.getByTestId('lock-title')).toHaveText('Choose a PIN')
  await enterPin(page, '1212')
  await enterPin(page, '1212')

  await saveDream(page, 'Fleas', 'I rolled over in my bed and locked eyes with Maple\'s dog bed right beside mine, which had a linen sheet on top. As I looked at her bed, I noticed a few black specks running around; soon there were more and more, and they started to form into a pile. At that point, I gathered the linen together and tossed it out the window.')
  await saveDream(page, 'Train Ride', 'I got on a boxcar train, ontop not inside, just to go around town, but didn\'t realize until it was too late that it went coast to coast, and I was stuck for the ride. I remember thinking I had to wait for water or for the train to slow down so I could jump off as safely as possible and start the long journey home.')
  await saveDream(page, 'Cars in a Park', 'Cars in a park were crashing into each other while people argued and shouted. I escaped through the trees before another one could reach me.')
  await saveDream(page, 'Garden night', 'My grandmother walked with me in a garden where a huge tree held the moon.')
  await saveDream(page, 'Old school', 'I was late for an exam in my old school and my teeth kept crumbling as I tried to speak.')

  await page.locator('a[href="#/self"]').click()
  await expect(page.getByTestId('self-profile')).toBeVisible()
  const shape = await page.getByTestId('self-shape').innerText()
  expect(shape).not.toMatch(/In the Fleas dream/)
  expect(shape.length).toBeLessThan(500)
  const profile = await page.getByTestId('self-profile').innerText()
  const tallies = new Map()
  for (const sentence of profile.split(/(?<=[.!?])\s+/)) {
    const clean = sentence.replace(/\s+/g, ' ').trim()
    if (clean.length <= 40) continue
    tallies.set(clean, (tallies.get(clean) || 0) + 1)
  }
  for (const [sentence, count] of tallies) expect(count, sentence).toBeLessThanOrEqual(2)
  expect(profile).not.toMatch(/\((?:peaceful|confused|anxious|scared|sad|happy)\b/i)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const status = await page.getByTestId('quiz-status').boundingBox()
  const nav = await page.getByTestId('nav').boundingBox()
  expect(status.y + status.height).toBeLessThanOrEqual(nav.y + 1)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(artifacts, 'self.png'), fullPage: true })
})
