import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],

      // ── Web App Manifest ─────────────────────────────────────────────────
      manifest: {
        name: 'Error POS',
        short_name: 'Error POS',
        description: 'Restaurant Point of Sale System',
        theme_color: '#0d9488',
        background_color: '#1f2937',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/sell',
        scope: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },

      // ── Workbox (GenerateSW strategy) ────────────────────────────────────
      workbox: {
        // Precache all build assets
        globPatterns: ['**/*.{js,css,html,svg,ico,woff,woff2}'],
        cleanupOutdatedCaches: true,

        // Runtime caching
        runtimeCaching: [
          {
            // Menu — NetworkFirst with 5 s timeout, fall back to cache
            urlPattern: /^\/api\/menu(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-menu-v1',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24, // 24 h
              },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Tables — NetworkFirst with 5 s timeout
            urlPattern: /^\/api\/tables(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-tables-v1',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60, // 1 h
              },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },

      // Enable SW in dev so you can test the banner locally
      devOptions: {
        enabled: false, // flip to true temporarily if testing SW in dev
      },
    }),
  ],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
