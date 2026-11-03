import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/Al-Mosbah/',
  // the tests never reach a real server: placeholders keep them runnable without a local .env file
  test: { env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-key' } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: { importScripts: ['push-sw.js'] },
      manifest: {
        name: 'المصباح',
        short_name: 'المصباح',
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
