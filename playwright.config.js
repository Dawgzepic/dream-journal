import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.js/,
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8741',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 1,
    serviceWorkers: 'allow',
    actionTimeout: 15000,
    screenshot: 'only-on-failure',
    trace: 'off'
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 8741 --strictPort',
    port: 8741,
    reuseExistingServer: false,
    timeout: 180000
  }
})
