import type { Page } from '@playwright/test';

/** Demo personas from supabase/seed.sql (demo mode: no Supabase keys in the env). */
export const DEMO = {
  owner: '10000000-0000-4000-8000-000000000001',
  dispatcher: '10000000-0000-4000-8000-000000000002',
  driver: '10000000-0000-4000-8000-000000000011',
} as const;

export async function signInAs(page: Page, role: keyof typeof DEMO) {
  await page.addInitScript((id) => localStorage.setItem('masar.demoUser', id), DEMO[role]);
}

/** Fail the test on any uncaught page error or console.error. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}
