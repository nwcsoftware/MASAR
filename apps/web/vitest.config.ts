import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    css: false,
  },
});
