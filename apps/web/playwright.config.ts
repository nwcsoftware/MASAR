import { defineConfig, devices } from '@playwright/test';

// CLAUDE.md: `pnpm e2e` runs every screen in English and Arabic.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'en',
      use: { ...devices['Desktop Chrome'], locale: 'en-US' },
    },
    {
      name: 'ar',
      use: { ...devices['Desktop Chrome'], locale: 'ar-SA' },
    },
    {
      name: 'driver-pwa',
      use: { ...devices['Pixel 7'], locale: 'en-US' },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
