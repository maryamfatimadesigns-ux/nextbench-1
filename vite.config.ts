import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
            },
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'unsplash-images', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 } }
            },
            {
              urlPattern: /^https:\/\/cdn-icons-png\.flaticon\.com\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'flaticon-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
            },
          ]
        },
        manifest: {
          name: 'NextBench — Verified Student Marketplace',
          short_name: 'NextBench',
          description: 'Exclusive, hype-driven marketplace for verified students. Buy, sell, and trade safely within your campus.',
          theme_color: '#091A1D',
          background_color: '#FAF9F6',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          categories: ['shopping', 'education', 'social'],
          icons: [
            {
              src: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          screenshots: [],
          shortcuts: [
            {
              name: 'Marketplace',
              short_name: 'Shop',
              url: '/marketplace',
              description: 'Browse available items'
            },
            {
              name: 'Sell Item',
              short_name: 'Sell',
              url: '/sell',
              description: 'List a new item for sale'
            },
            {
              name: 'Messages',
              short_name: 'Chat',
              url: '/messages',
              description: 'View your conversations'
            }
          ]
        }
      })
    ],
  };
});
