import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const artifacts = '/opt/cursor/artifacts'

function track(page) {
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

const APP = '/dream-journal/'

async function enterPin(page, digits) {
  for (const digit of digits) await page.getByTestId(`pin-${digit}`).click()
}

async function unlockFresh(page) {
  await page.goto(APP)
  await expect(page.getByTestId('lock-screen')).toBeVisible()
  await expect(page.getByTestId('lock-title')).toHaveText('Choose a PIN')
  await enterPin(page, '1212')
  await expect(page.getByTestId('lock-title')).toHaveText('Confirm your PIN')
  await enterPin(page, '1212')
  await expect(page.getByTestId('greeting')).toContainText('Timothy')
}

function localValue(offsetDays) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T07:30`
}

async function openNew(page) {
  await page.evaluate(() => { location.hash = '#/new' })
}

async function saveFull(page, dream) {
  await openNew(page)
  await expect(page.getByRole('heading', { name: 'New dream' })).toBeVisible()
  if (dream.when) await page.getByTestId('dream-when').fill(dream.when)
  await page.getByTestId('dream-title').fill(dream.title)
  await page.getByTestId('dream-story').fill(dream.story)
  if (dream.during) await page.getByTestId(`during-${dream.during}`).click()
  if (dream.after) await page.getByTestId(`after-${dream.after}`).click()
  if (dream.tag) await page.getByTestId(`tag-${dream.tag}`).click()
  if (dream.stress) await page.getByTestId(`stress-${dream.stress}`).click()
  if (dream.substance) await page.getByTestId(`substance-${dream.substance}`).click()
  if (dream.screen) await page.getByTestId(`screen-${dream.screen}`).click()
  await page.getByTestId('save-dream').click()
  await expect(page.getByTestId('dream-title-view')).toHaveText(dream.title)
}

test('journal flow, exports, and mobile screens', async ({ page }) => {
  fs.mkdirSync(artifacts, { recursive: true })
  const errors = track(page)
  await unlockFresh(page)

  const stored = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('dream-journal')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const settings = await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly')
      const get = tx.objectStore('kv').get('settings')
      get.onsuccess = () => resolve(get.result)
      get.onerror = () => reject(get.error)
    })
    db.close()
    return settings
  })
  expect(stored.pinHash).toMatch(/^[a-f0-9]{64}$/)
  expect(stored.pinSalt).toMatch(/^[a-f0-9]{32}$/)
  expect(JSON.stringify(stored)).not.toContain('1212')
  await expect(page.getByTestId('greeting')).toHaveText(/Good morning|Good afternoon|Good evening|Good night|Still night/)
  await expect(page.getByTestId('sample-note')).toBeVisible()
  await expect(page.getByTestId('stat-dreams').locator('strong')).toHaveText('0')
  await expect(page.getByTestId('reminder-banner')).toContainText(/best-effort/i)
  await expect(page.getByTestId('nav')).toHaveCount(1)

  await page.getByTestId('new-dream').click()
  await expect(page.getByTestId('voice-button')).toHaveCount(await page.evaluate(() => (window.SpeechRecognition || window.webkitSpeechRecognition) ? 1 : 0))
  await page.getByTestId('prompt-button').click()
  await expect(page.getByTestId('prompt-text')).not.toHaveText('')
  await page.getByTestId('dream-title').fill('Glass station')
  await page.getByTestId('dream-story').fill('I stood on a glass platform while a silver train passed under the sea. The doors opened onto black water and a white horse waited on the far side. I felt strangely peaceful.')
  await page.getByTestId('during-Peaceful').click()
  await page.getByTestId('stress-2').click()
  await page.getByTestId('substance-None').click()
  await page.getByTestId('screen-light').click()
  await expect(page.getByTestId('save-status')).toHaveText(/Draft saved/, { timeout: 5000 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(artifacts, 'new-entry.png'), animations: 'disabled' })
  await page.getByTestId('save-dream').click()
  await expect(page.getByTestId('dream-title-view')).toHaveText('Glass station')

  await page.reload()
  await expect(page.getByTestId('lock-title')).toHaveText('The journal is locked')
  await page.screenshot({ path: path.join(artifacts, 'lock-screen.png'), animations: 'disabled' })
  await enterPin(page, '0000')
  await expect(page.getByTestId('pin-error')).toContainText(/does not match/i)
  await enterPin(page, '1212')
  await expect(page.getByTestId('dream-title-view')).toHaveText('Glass station')
  await page.locator('a[href="#/home"]').first().click()
  await expect(page.getByTestId('greeting')).toContainText('Timothy')

  await page.locator('a[href="#/journal"]').first().click()
  await expect(page.locator('[data-id]').filter({ hasText: 'Glass station' })).toBeVisible()
  await page.getByTestId('search').fill('strangely peaceful')
  await expect(page.getByTestId('dream-item')).toHaveCount(1)
  await page.getByTestId('search').fill('zzzz-not-a-dream')
  await expect(page.getByTestId('search-empty')).toBeVisible()
  await page.getByTestId('search').fill('')

  await saveFull(page, {
    title: 'The exam in the old school',
    when: localValue(-2),
    story: 'I was late for an exam in my old school and my teeth kept crumbling as I tried to speak. The clock in the hall had no hands. I woke anxious and the classroom would not let me leave.',
    during: 'Anxious',
    tag: 'Nightmare',
    stress: 5,
    substance: 'Caffeine',
    screen: 'heavy'
  })
  await saveFull(page, {
    title: 'The garden and the moon',
    when: localValue(-1),
    story: 'My grandmother walked with me in a garden where a huge tree held up the moon. She handed me an apple and said I was lucid, and I knew she was right. It was quiet and kind.',
    during: 'Happy',
    after: 'Peaceful',
    tag: 'Lucid',
    stress: 1,
    substance: 'None',
    screen: 'none'
  })
  await saveFull(page, {
    title: 'Under the station again',
    story: 'Again I stood on the glass platform. A silver train passed under the sea and the doors opened onto black water. The white horse was still waiting. I could not step through.',
    during: 'Confused',
    stress: 4,
    substance: 'Caffeine',
    screen: 'medium'
  })
  await saveFull(page, {
    title: 'Falling over the red door',
    story: 'I was flying over my childhood house, low enough to see the key still in the red door, then I started falling toward the garden and woke scared.',
    during: 'Scared',
    stress: 3,
    substance: 'Alcohol',
    screen: 'light'
  })

  await page.locator('a[href="#/home"]').first().click()
  await expect(page.getByTestId('stat-dreams').locator('strong')).toHaveText('5')
  await expect(page.getByTestId('streak')).toContainText('3-night streak')
  await expect(page.getByTestId('backup-nag')).toBeVisible()
  await expect(page.getByTestId('random-dream')).toBeVisible()
  await expect(page.getByTestId('tip')).toBeVisible()
  await expect(page.locator('.toast')).toHaveCount(0)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(artifacts, 'home.png'), animations: 'disabled' })

  await page.locator('a[href="#/journal"]').first().click()
  await page.getByTestId('filter-nightmares').click()
  await expect(page.getByText('The exam in the old school')).toBeVisible()
  await expect(page.getByText('Glass station')).toHaveCount(0)
  await page.getByTestId('filter-all').click()
  await expect(page.getByText('Likely recurring').first()).toBeVisible()

  await page.locator('[data-id="sample-library-sea"]').click()
  await expect(page.getByTestId('sample-banner')).toBeVisible()
  await page.getByTestId('open-meaning').click()
  await expect(page.getByTestId('full-interpretation')).toBeVisible()
  await expect(page.getByTestId('full-interpretation')).toContainText('Putting it together')
  await expect(page.getByTestId('full-interpretation')).toContainText('reflection')
  await expect(page.locator('button.symbol')).toHaveCount(0)
  await page.getByTestId('highlight-symbols').click()
  await expect(page.locator('button.symbol').first()).toBeVisible()
  await page.getByTestId('symbol-notes').locator('summary').click()
  await expect(page.getByTestId('symbol-card').first()).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(artifacts, 'dream-meaning.png'), animations: 'disabled' })
  await page.getByTestId('depth-detailed').click()
  const prompt = await page.getByTestId('ai-prompt').inputValue()
  expect(prompt.toLowerCase()).toContain('psychology')
  expect(prompt.toLowerCase()).toContain('folklore')
  expect(prompt).toContain('detailed')
  expect(prompt).toContain('library')
  await expect(page.getByRole('heading', { name: 'Want a deeper AI reading?' })).toBeVisible()
  await expect(page.getByText('not the reading itself')).toBeVisible()
  await expect(page.getByText('Paste this to Grokel')).toHaveCount(1)
  await page.getByTestId('copy-interpretation').click()
  await expect(page.getByTestId('copy-interpretation')).toHaveText(/Copied|Select the text/)
  const picture = await page.getByTestId('image-prompt').inputValue()
  expect(picture).toContain('No words')

  await page.locator('a[href="#/patterns"]').first().click()
  await expect(page.getByTestId('pattern-summary')).toContainText(/logged/)
  await expect(page.getByTestId('mood-chart')).toBeVisible()
  await expect(page.getByTestId('word-cloud').locator('span').first()).toBeVisible()
  await expect(page.getByTestId('recurring')).toContainText('Glass station')
  await expect(page.getByTestId('recurring')).toContainText('Under the station again')
  await expect(page.getByTestId('month-recap')).toContainText(/logged/)
  const box = await page.getByTestId('mood-chart').boundingBox()
  expect(box.height).toBeGreaterThan(40)
  await page.screenshot({ path: path.join(artifacts, 'patterns.png'), animations: 'disabled' })

  await page.locator('a[href="#/lucid"]').first().click()
  await expect(page.getByTestId('lucid-count')).toHaveText('1')

  await page.locator('a[href="#/settings"]').first().click()
  await expect(page.getByTestId('work-day-0')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('work-day-1')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('work-day-2')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('work-day-6')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('work-start')).toHaveValue('08:00')
  await expect(page.getByTestId('work-end')).toHaveValue('16:30')
  await page.getByTestId('work-day-2').click()
  await expect(page.getByTestId('work-day-2')).toHaveAttribute('aria-pressed', 'true')

  const textDownload = page.waitForEvent('download')
  await page.getByTestId('export-text').click()
  const textFile = await textDownload
  const textPath = path.join(artifacts, 'journal.txt')
  await textFile.saveAs(textPath)
  const text = fs.readFileSync(textPath, 'utf8')
  expect(text).toContain('Glass station')
  expect(text).toContain('Dream Journal')
  expect(text).not.toContain('1212')

  const jsonDownload = page.waitForEvent('download')
  await page.getByTestId('export-json').click()
  const jsonFile = await jsonDownload
  const jsonPath = path.join(artifacts, 'backup.json')
  await jsonFile.saveAs(jsonPath)
  const backup = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  expect(backup.app).toBe('Dream Journal')
  expect(backup.dreams.some((dream) => dream.title === 'Glass station')).toBe(true)
  expect(backup.preferences.workDays).toContain(2)
  expect(JSON.stringify(backup)).not.toContain('1212')

  const pdfDownload = page.waitForEvent('download')
  await page.getByTestId('export-pdf').click()
  const pdfFile = await pdfDownload
  const pdfPath = path.join(artifacts, 'journal.pdf')
  await pdfFile.saveAs(pdfPath)
  const pdf = fs.readFileSync(pdfPath)
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')

  await page.locator('a[href="#/home"]').first().click()
  await expect(page.getByTestId('backup-nag')).toHaveCount(0)

  await page.locator('a[href="#/journal"]').first().click()
  await page.getByText('Glass station', { exact: true }).click()
  await page.getByTestId('delete-dream').click()
  await page.getByTestId('confirm-delete').click()
  await expect(page.getByText('Glass station')).toHaveCount(0)

  await page.locator('a[href="#/settings"]').first().click()
  await page.getByTestId('work-day-2').click()
  await page.getByTestId('import-json').setInputFiles(jsonPath)
  await page.getByTestId('confirm-import').click()
  await expect(page.getByTestId('greeting')).toBeVisible()
  await page.locator('a[href="#/journal"]').first().click()
  await expect(page.getByText('Glass station')).toBeVisible()
  await page.locator('a[href="#/settings"]').first().click()
  await expect(page.getByTestId('work-day-2')).toHaveAttribute('aria-pressed', 'true')

  await openNew(page)
  await page.getByTestId('mode-quick').click()
  await page.getByTestId('dream-story').fill('bell tower stairs')
  await expect(page.getByTestId('save-status')).toHaveText(/Draft saved/)
  await page.getByTestId('save-jot').click()
  await expect(page.getByText('bell tower stairs')).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
  expect(overflow).toBe(true)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.locator('a[href="#/home"]').first().click()
  const wide = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
  expect(wide).toBe(true)
  await expect(page.getByTestId('nav-new')).toBeVisible()
  await page.setViewportSize({ width: 412, height: 915 })

  await page.locator('a[href="#/settings"]').first().click()
  await page.getByTestId('morning-time').fill('07:45')
  await page.getByTestId('morning-time').blur()
  await page.reload()
  await enterPin(page, '1212')
  await page.locator('a[href="#/settings"]').first().click()
  await expect(page.getByTestId('morning-time')).toHaveValue('07:45')

  expect(errors, errors.join('\n')).toEqual([])
})

test('six digit PIN can be chosen', async ({ page }) => {
  const errors = track(page)
  await page.goto(APP)
  await page.getByTestId('pin-length-6').click()
  await enterPin(page, '1234')
  await expect(page.getByTestId('lock-title')).toHaveText('Choose a PIN')
  await enterPin(page, '56')
  await expect(page.getByTestId('lock-title')).toHaveText('Confirm your PIN')
  await enterPin(page, '654321')
  await expect(page.getByTestId('lock-title')).toHaveText('Choose a PIN')
  await enterPin(page, '123456')
  await expect(page.getByTestId('lock-title')).toHaveText('Confirm your PIN')
  await enterPin(page, '123456')
  await expect(page.getByTestId('greeting')).toContainText('Timothy')
  expect(errors, errors.join('\n')).toEqual([])
})
