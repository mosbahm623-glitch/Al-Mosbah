import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

/** The release name shown in the side menu, so anyone can tell which build he is on: build time (Cairo) + commit. */
function releaseName() {
  let sha = (process.env.GITHUB_SHA ?? '').slice(0, 7)
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim()
    } catch {
      sha = 'dev'
    }
  }
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
  return `نسخة ${when.replace(', ', ' ')} · ${sha}`
}

// https://vite.dev/config/
export default defineConfig({
  base: '/Al-Mosbah/',
  define: { __APP_VERSION__: JSON.stringify(releaseName()) },
  // the tests never reach a real server: placeholders keep them runnable without a local .env file
  test: { env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-key' } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        importScripts: ['push-sw.js'],
        // the Excel library is big and rarely needed: it is cached the first time someone exports, not at install
        globIgnores: ['**/exceljs*.js', '**/xlsx*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/(exceljs|xlsx)[^/]*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'heavy-libs', expiration: { maxEntries: 4 } },
          },
        ],
      },
      manifest: {
        name: 'Legacy ERP',
        short_name: 'Legacy ERP',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/Al-Mosbah/',
        scope: '/Al-Mosbah/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#17160f',
        theme_color: '#17160f',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
