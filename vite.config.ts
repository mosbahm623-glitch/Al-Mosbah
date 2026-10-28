import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/Al-Mosbah/',
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
