import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://localhost:4173/spool-library/'

export default defineConfig({
  testDir: 'tests/e2e',
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'iphone-webkit', use: { ...devices['iPhone 13'], baseURL } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
