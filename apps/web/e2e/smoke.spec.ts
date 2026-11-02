import { expect, test } from '@playwright/test';

test('app boots with design tokens applied', async ({ page }) => {
  await page.goto('/');

  // `/` redirects to /login when signed out; the wordmark appears in the brand panel and the form column
  await expect(page.getByText(/Masar|مسار/).filter({ visible: true }).first()).toBeVisible();

  // tokens.css must be live: the body background is a token, not transparent.
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');

  const brand = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--brand-500').trim(),
  );
  expect(brand).toBe('#2f5ff5');
});

test('language toggle flips document direction both ways', async ({ page }) => {
  await page.goto('/');

  const html = page.locator('html');
  // The ar project runs with an Arabic browser locale, so the starting
  // direction depends on the project — assert the flip, not the start state.
  const initialDir = await html.getAttribute('dir');
  const flippedDir = initialDir === 'rtl' ? 'ltr' : 'rtl';
  const toggle = page.getByRole('button', { name: /language|اللغة/i });

  await toggle.click();
  await expect(html).toHaveAttribute('dir', flippedDir);
  await expect(html).toHaveAttribute('lang', flippedDir === 'rtl' ? 'ar' : 'en');

  await toggle.click();
  await expect(html).toHaveAttribute('dir', initialDir!);
});

test('theme toggle switches dark tokens on and off', async ({ page }) => {
  await page.goto('/');

  const html = page.locator('html');
  const toggle = page.getByRole('button', { name: /theme|المظهر/i });

  // Cycle is light → dark → system and starts wherever the stored theme
  // left off, so step through it until dark is reached.
  for (let i = 0; i < 3; i += 1) {
    if ((await html.getAttribute('data-theme')) === 'dark') break;
    await toggle.click();
  }
  await expect(html).toHaveAttribute('data-theme', 'dark');

  const darkBg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  );
  expect(darkBg).toBe('#0b1020');
});
