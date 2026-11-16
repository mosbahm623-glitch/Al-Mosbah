import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

/** Number of commits on this branch, or null when the history is cut short (a shallow clone) or git is missing. */
function commitCount(): number | null {
  try {
    const git = (cmd: string) =>
      execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const shallow = existsSync('.git/shallow')
      ? new Set(readFileSync('.git/shallow', 'utf8').split('\n'))
      : new Set<string>()
    if (
      git('rev-list --max-parents=0 HEAD')
        .split('\n')
        .some((root) => shallow.has(root))
    )
      return null
    return Number(git('rev-list --count HEAD')) || null
  } catch {
    return null
  }
}

/**
 * The release name shown in the side menu: version number + build time (Cairo).
 * The number is the major version from package.json plus the commit count, so it rises by itself with every merge;
 * without the full git history it falls back to the version written in package.json.
 */
function releaseName() {
  const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version
  const count = commitCount()
  const number = count ? `${version.split('.')[0]}.${count}` : version
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
  return `v${number} · ${when.replace(', ', ' ')}`
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
