import { defineConfig, devices } from '@playwright/test'

// Read-only checks against the REAL published site and database. They sign in as nobody and change nothing, so they
// are safe to run after every deploy (see the "smoke" job in .github/workflows/ci.yml).
export default defineConfig({
  testDir: 'e2e-live',
  timeout: 240_000,
  retries: 1,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' },
})
