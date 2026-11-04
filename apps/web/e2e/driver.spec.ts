import { expect, test } from '@playwright/test';
import { collectErrors, signInAs } from './helpers';

test.describe('driver PWA', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'driver'));

  test('US-07: one-tap pick-up then complete moves the trip through the state machine', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/driver$/);

    const hero = page.locator('article').first();
    await expect(hero).toContainText('Pick up Eng. Sara Al-Otaibi');

    // delayed (from en_route) → arrive
    await hero.getByRole('button', { name: /Passenger picked up|تم استلام الراكب/ }).click();
    await expect(hero.getByRole('button', { name: /^Complete$|^إنهاء$/ })).toBeVisible();

    // in_progress → complete via the Complete sheet
    await hero.getByRole('button', { name: /^Complete$|^إنهاء$/ }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel(/Odometer|عداد/).fill('38261');
    await sheet.getByRole('button', { name: /^Complete$|^إنهاء$/ }).click();

    // the hero moves on to the next task of the day
    await expect(page.locator('article').first()).toContainText('Escort Mr. Hamad to SAB Bank');
    expect(errors).toEqual([]);
  });

  test('bottom tabs reach week, hours and profile', async ({ page }) => {
    await page.goto('/driver');
    const nav = page.getByRole('navigation');
    for (const [name, url] of [
      [/Week|الأسبوع/, /\/driver\/week/],
      [/Hours|الساعات/, /\/driver\/hours/],
      [/Me|حسابي/, /\/driver\/me/],
    ] as const) {
      await nav.getByRole('link', { name }).click();
      await expect(page).toHaveURL(url);
    }
  });

  test('the PWA manifest points installs at the driver app', async ({ request }) => {
    // vite-plugin-pwa emits the manifest in production builds (`pnpm build && pnpm preview`);
    // the dev server answers with the SPA's index.html instead.
    const response = await request.get('/manifest.webmanifest');
    test.skip(!(response.headers()['content-type'] ?? '').includes('json'), 'manifest is only emitted by `vite build`');
    const manifest = await response.json();
    expect(manifest.start_url).toBe('/driver');
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });
});
