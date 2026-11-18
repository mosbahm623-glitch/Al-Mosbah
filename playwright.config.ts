import { defineConfig, devices } from '@playwright/test'

// Screen tests run the real app in a real browser against a fake database (see e2e/mockApi.ts): nothing here touches
// the live Supabase project.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', locale: 'ar-EG' },
  // locally the installed Chrome is used; CI installs the browsers and runs Chrome, Firefox and Safari's engine
  projects: process.env.CI
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ]
    : [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    env: { VITE_SUPABASE_URL: 'https://mock.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-key' },
  },
})
