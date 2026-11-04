import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';

const host = process.env.TAURI_DEV_HOST;
const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM);

/**
 * Demo mode has no Edge Functions, so the dev server reads tickets itself
 * (FR-18, src/dev/read-ticket.ts) when ANTHROPIC_API_KEY is in .env.local or
 * the environment. The key stays server-side; without one the app shows the
 * sample ticket and says so.
 */
function devTicketReader(): Plugin {
  return {
    name: 'masar-dev-ticket-reader',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/ai-parse-ticket', (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return send(405, { code: 'errors.methodNotAllowed' });
        const apiKey = process.env.ANTHROPIC_API_KEY || loadEnv(server.config.mode, server.config.envDir || process.cwd(), '').ANTHROPIC_API_KEY;
        // 200, not an error status: the app falls back to its sample ticket without a console error
        if (!apiKey) return send(200, { unavailable: true, code: 'ticketImport.errors.devNoKey' });

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const mod = (await server.ssrLoadModule('/src/dev/read-ticket.ts')) as typeof import('./src/dev/read-ticket');
            try {
              send(200, await mod.readTicket(JSON.parse(Buffer.concat(chunks).toString('utf8')), apiKey));
            } catch (error) {
              if (error instanceof mod.TicketReadError) return send(error.status, { code: error.code, message: error.message });
              throw error;
            }
          } catch (error) {
            server.config.logger.error(`[ai-parse-ticket] ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
            send(500, { code: 'ticketImport.errors.aiFailed' });
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    devTicketReader(),
    // Driver PWA (PRD §3.1) — same build; Tauri ships its own shell, so no SW there.
    VitePWA({
      disable: isTauri,
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/lib/pwa.ts (skips Tauri)
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/driver',
        name: 'Masar — Driver & trip management',
        short_name: 'Masar',
        description: 'Trips, reminders and one-tap status updates for company drivers.',
        start_url: '/driver',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'en',
        background_color: '#f6f7fb',
        theme_color: '#2f5ff5',
        categories: ['business', 'productivity', 'navigation'],
        icons: [
          { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Web Push: show + open notifications (public/push-sw.js)
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@design': path.resolve(import.meta.dirname, '../../design'),
      // contracts shared with the Edge Functions (supabase/functions/_shared)
      '@shared': path.resolve(import.meta.dirname, '../../supabase/functions/_shared'),
      // one zod instance for app code and the shared schemas
      zod: path.resolve(import.meta.dirname, './node_modules/zod'),
    },
  },
  // Tauri expects a fixed port and fails if it is not available.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
    fs: { allow: ['..', '../..'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
