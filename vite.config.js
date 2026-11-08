import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project site is /dream-journal/. Set VITE_BASE=/ to build for a domain root.
const base = process.env.VITE_BASE || '/dream-journal/'

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: [
        'favicon.png',
        'OFL-EBGaramond.txt',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-192.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png'
      ],
      manifest: {
        name: 'Dream Journal',
        short_name: 'Dreams',
        description: 'A private dream journal that stays on this device.',
        theme_color: '#140c22',
        background_color: '#100c18',
        display: 'standalone',
        start_url: base,
        scope: base,
        id: base,
        lang: 'en',
        categories: ['lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          {
            name: 'New dream',
            url: `${base}#/new`,
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
          }
        ]
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/assets\//, /\/icons\//, /\/[^/?]+\.[^/]+$/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest,txt}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ],
  server: { host: '0.0.0.0', port: 8741, strictPort: true, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 8741, strictPort: true, allowedHosts: true },
  build: { outDir: 'dist', sourcemap: false }
})
