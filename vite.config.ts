import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'CRM',
        short_name: 'CRM',
        description: 'Kontakte, Firmen, Pipeline und Termine an einem Ort.',
        lang: 'de',
        start_url: '/',
        scope: '/',
        // Ohne Browserleiste — das ist der Unterschied zwischen Website
        // und App auf dem Startbildschirm.
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Android beschneidet Icons je nach Gerät zu Kreis oder Squircle;
          // die maskable-Variante hat dafür Rand eingeplant.
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Deals', url: '/deals' },
          { name: 'Kontakte', url: '/kontakte' },
          { name: 'Aufgaben', url: '/aufgaben' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Datenabfragen dürfen NICHT aus dem Cache kommen — ein CRM, das
        // veraltete Kundendaten zeigt, ist schlimmer als eines, das offline
        // ehrlich nichts anzeigt.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Schriften ruhig lange vorhalten, die ändern sich nie
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'schriften',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase bewusst nie cachen
            urlPattern: /supabase\.co\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Die schweren Abhängigkeiten in eigene Chunks legen: Recharts wird
        // nur auf der Berichtsseite gebraucht und muss den ersten Aufruf
        // nicht ausbremsen.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
});
