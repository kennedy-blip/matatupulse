import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['matatupulse-mark.svg', 'matatupulse-icon-192.png', 'matatupulse-icon-512.png'],
      manifest: {
        name: 'MatatuPulse · Fleet Command OS',
        short_name: 'MatatuPulse',
        description: 'Offline-first fleet remittance, stage dispatch and compliance OS.',
        theme_color: '#090a0f',
        background_color: '#090a0f',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/matatupulse-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/matatupulse-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/matatupulse-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,png,ico}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
      }
    })
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1100
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true
  }
})
