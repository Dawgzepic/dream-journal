import { expect, test } from '@playwright/test'

function track(page) {
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

const APP = '/dream-journal/'

test('manifest, icons, service worker, and offline shell', async ({ page }) => {
  const errors = track(page)
  await page.goto(APP)
  await expect(page.getByTestId('lock-screen')).toBeVisible()
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready
    return Boolean(reg.active)
  })
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload()
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  }
  const swInfo = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    return { scope: reg.scope, script: reg.active?.scriptURL || '' }
  })
  expect(new URL(swInfo.scope).pathname).toBe(APP)
  expect(swInfo.script).toContain(`${APP}sw.js`)

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifestUrl = new URL(manifestHref, page.url()).toString()
  const manifest = await (await page.request.get(manifestUrl)).json()
  expect(manifest.name).toBe('Dream Journal')
  expect(manifest.display).toBe('standalone')
  expect(new URL(manifest.start_url, manifestUrl).pathname).toBe(APP)
  expect(new URL(manifest.scope, manifestUrl).pathname).toBe(APP)
  expect(new URL(manifest.id || manifest.start_url, manifestUrl).pathname).toBe(APP)
  const sizes = manifest.icons.map((icon) => icon.sizes)
  expect(sizes).toContain('192x192')
  expect(sizes).toContain('512x512')
  expect(manifest.icons.some((icon) => icon.sizes === '192x192' && String(icon.purpose).includes('any'))).toBe(true)
  expect(manifest.icons.some((icon) => icon.sizes === '512x512' && String(icon.purpose).includes('any'))).toBe(true)

  for (const size of [192, 512]) {
    const icon = manifest.icons.find((item) => item.sizes === `${size}x${size}` && String(item.purpose).includes('any'))
    const response = await page.request.get(new URL(icon.src, manifestUrl).toString())
    expect(response.status()).toBe(200)
    const buf = await response.body()
    expect(buf.readUInt32BE(16)).toBe(size)
    expect(buf.readUInt32BE(20)).toBe(size)
  }

  await page.context().setOffline(true)
  await page.reload()
  await expect(page.getByTestId('lock-screen')).toBeVisible()
  await expect(page.getByTestId('lock-title')).toContainText(/PIN|locked/i)
  await page.context().setOffline(false)
  expect(errors, errors.join('\n')).toEqual([])
})
