import { expect, test } from '@playwright/test';
import { collectErrors, signInAs } from './helpers';

test.describe('auth & role redirect', () => {
  test('demo login as dispatcher lands on the dashboard', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole('listitem').filter({ hasText: /Dispatcher|منسق/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Nawaf|نواف/);
    expect(errors).toEqual([]);
  });

  test('drivers are kept out of the console', async ({ page }) => {
    await signInAs(page, 'driver');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/driver$/);
  });
});

test.describe('console screens (owner)', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'owner'));

  for (const path of ['/dashboard', '/calendar', '/map', '/tasks', '/drivers', '/sites', '/reports', '/settings', '/onboarding']) {
    test(`${path} renders without errors`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      // the html dir follows the language (ar project runs with an Arabic locale)
      const lang = await page.locator('html').getAttribute('lang');
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      expect(errors).toEqual([]);
    });
  }

  test('US-03: a double booking shows as a blocking conflict in the task slide-over', async ({ page }) => {
    await page.goto('/tasks?q=XY 210');
    await page.getByRole('row').filter({ hasText: 'XY 210' }).first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('JED departure · XY 210');
    await sheet.getByRole('tab', { name: /Conflicts|التعارضات/ }).click();
    await expect(sheet).toContainText(/Overlaps Escort · Al Rajhi Bank|تتداخل مع/);
  });

  test('empty and error states render on demand', async ({ page }) => {
    await page.goto('/tasks?mock=empty');
    await expect(page.getByText(/No tasks yet|لا مهام بعد/)).toBeVisible();
    await page.goto('/drivers?mock=error');
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
