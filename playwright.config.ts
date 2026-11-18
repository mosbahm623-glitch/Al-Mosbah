import { defineConfig } from '@playwright/test'

// Screen tests run the real app in a real browser against a fake database (see e2e/mockApi.ts): nothing here touches
// the live Supabase project.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    // locally the installed Chrome is used; CI installs Chromium (npx playwright install chromium)
    channel: process.env.CI ? undefined : 'chrome',
    locale: 'ar-EG',
  },
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    env: { VITE_SUPABASE_URL: 'https://mock.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-key' },
  },
})
