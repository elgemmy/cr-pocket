/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'CR Pocket',
        short_name: 'CR Pocket',
        description: 'More decks. Less deck management.',
        theme_color: '#14183a',
        background_color: '#0d1030',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/api/cards',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'cr-catalog', expiration: { maxEntries: 2 } },
          },
          {
            urlPattern: ({ url }) => /clashroyale\.com$|royaleapi\.com$/.test(url.hostname) && /\.(png|webp|jpg)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'cr-card-art',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // `npm run dev:api` serves Pages Functions via wrangler on :8788
      '/api': 'http://127.0.0.1:8788',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'functions/**/*.test.ts'],
    exclude: ['tests/rules/**', 'node_modules/**'],
  },
});
