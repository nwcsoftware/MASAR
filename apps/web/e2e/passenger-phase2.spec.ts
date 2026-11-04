import { expect, test, type Page } from '@playwright/test';
import { collectErrors, signInAs } from './helpers';

// Passenger module, phase 2 (0007): live trip + share link, SOS, check-in,
// trip requests. The clock is fixed at 13:30 Riyadh time, while Sara's RUH
// pickup (T2) is under way.

const T2 = '60000000-0000-4000-8000-000000000002';
const riyadhToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
const AT_1330 = new Date(`${riyadhToday}T13:30:00+03:00`);

test.use({ permissions: ['geolocation'], geolocation: { latitude: 24.95, longitude: 46.69 } });

async function at1330(page: Page) {
  await page.clock.setFixedTime(AT_1330);
}

test.describe('passenger: live trip', () => {
  test.beforeEach(async ({ page }) => {
    await at1330(page);
    await signInAs(page, 'passenger');
  });

  test('follows the driver, shares a link that strangers can open without names', async ({ page, context }) => {
    const errors = collectErrors(page);
    await page.goto('/passenger');
    await expect(page.locator(`[data-trip="${T2}"] [data-live-badge]`)).toBeVisible();
    await page.locator(`[data-trip="${T2}"]`).click();
    await expect(page.locator('[data-live]')).toContainText(/RUH Terminal 1/);
    await expect(page.locator('[data-eta]')).toContainText(/Arriving now|يصل الآن/);
    await expect(page.locator('[data-checkin-code]')).toHaveText(/^\d{6}$/);

    await page.getByRole('button', { name: /Share my trip|مشاركة رحلتي/ }).click();
    const url = await page.locator('[data-share-url]').innerText();
    expect(url).toMatch(/\/track\/[0-9a-f]{64}$/);

    const stranger = await context.newPage();
    await stranger.clock.setFixedTime(AT_1330);
    await stranger.goto(url);
    await expect(stranger.locator('[data-shared-trip]')).toContainText(/Al Yasmin Site office/);
    await expect(stranger.locator('[data-shared-trip]')).not.toContainText(/Sara|\+966/);
    await stranger.goto('/track/not-a-token');
    await expect(stranger.getByText(/isn’t valid|غير صالح/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('raises an SOS and gets the emergency options', async ({ page }) => {
    await page.goto(`/passenger/trips/${T2}`);
    await page.locator('[data-sos]').click();
    await page.locator('#sos-message').fill('Car stopped on the ring road');
    await page.locator('[data-sos-send]').click();
    const result = page.locator('[data-sos-result]');
    await expect(result.getByRole('link', { name: /911/ })).toHaveAttribute('href', 'tel:911');
    await expect(result.locator('[data-sos-contact]')).toContainText(/Faisal/);
    await expect(result.locator('[data-sos-contact] a').first()).toHaveAttribute('href', /^sms:\+966559991234\?&body=.*maps/);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-open-sos]')).toBeVisible();
  });
});

test.describe('passenger: requests', () => {
  test('asks for a new trip and withdraws it', async ({ page }) => {
    await at1330(page);
    await signInAs(page, 'passenger');
    await page.goto('/passenger/requests');
    await page.locator('[data-request="new"]').click();
    await page.getByRole('button', { name: /Send request|إرسال الطلب/ }).click();
    await expect(page.getByRole('alert').filter({ hasText: /pickup place|مكان الالتقاء/ })).toBeVisible();

    await page.locator('#req-date').fill(new Date(AT_1330.getTime() + 2 * 86_400_000).toISOString().slice(0, 10));
    await page.locator('#req-time').fill('08:00');
    await page.locator('#req-pickup').fill('Riyadh HQ');
    await page.locator('#req-dropoff').fill('Jeddah Tower site');
    await page.locator('#req-notes').fill('Quarterly review');
    await page.getByRole('button', { name: /Send request|إرسال الطلب/ }).click();

    const mine = page.locator('[data-my-request="new"]').filter({ hasText: 'Jeddah Tower site' });
    await expect(mine).toContainText(/Pending|قيد الانتظار/);
    await mine.getByRole('button', { name: /Withdraw|سحب الطلب/ }).click();
    await expect(mine).toContainText(/Withdrawn|مسحوب/);
  });
});

test.describe('driver: check-in', () => {
  test('wrong codes are refused; the passenger’s code starts the pickup; drop-off completes', async ({ page, context }) => {
    // the passenger reads her code (demo codes are stable across page loads)
    await at1330(page);
    await signInAs(page, 'passenger');
    await page.goto(`/passenger/trips/${T2}`);
    const code = await page.locator('[data-checkin-code]').innerText();

    const driver = await context.newPage();
    await at1330(driver);
    await signInAs(driver, 'driver');
    await driver.goto(`/driver/tasks/${T2}`);
    const rider = driver.locator('[data-rider]');
    await expect(rider).toContainText(/Waiting for pickup|بانتظار الالتقاء/);

    await rider.locator('[data-picked-up]').click();
    await expect(driver.getByRole('alert').filter({ hasText: /pickup code|رمز الالتقاء/ })).toBeVisible();

    await driver.locator('[data-checkin-open]').click();
    await driver.locator('#checkin-code').fill('000000');
    await driver.getByRole('button', { name: /^(Check in|تسجيل الركوب)$/ }).click();
    await expect(driver.locator('[data-checkin-result="false"]')).toBeVisible();
    await driver.locator('#checkin-code').fill(code);
    await driver.getByRole('button', { name: /^(Check in|تسجيل الركوب)$/ }).click();
    await expect(driver.locator('[data-checkin-result="true"]')).toBeVisible();
    await driver.keyboard.press('Escape');

    await expect(rider).toContainText(/On board|على متن/);
    await rider.getByRole('button', { name: /Drop off|إنزال/ }).click();
    await expect(rider).toContainText(/Dropped off|نزل/);
    await expect(driver.getByText(/Completed|مكتملة/).first()).toBeVisible();
  });
});

test.describe('dispatch: requests inbox', () => {
  test('a rejection needs a reason; the request leaves the pending list', async ({ page }) => {
    await at1330(page);
    await signInAs(page, 'dispatcher');
    await page.goto('/requests');
    const card = page.locator('[data-request]').filter({ hasText: /Site inspection with the consultant/ });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /Decline|رفض/ }).click();
    await page.locator('[data-decide-confirm]').click();
    await expect(page.getByRole('alert').filter({ hasText: /reason|السبب|سبب/ })).toBeVisible();
    await page.locator('#decide-note').fill('No car free at 07:30 — please take the 08:00 shuttle');
    await page.locator('[data-decide-confirm]').click();
    await expect(card).toHaveCount(0);
  });

  test('“Plan trip” opens the wizard with the passenger', async ({ page }) => {
    await at1330(page);
    await signInAs(page, 'dispatcher');
    await page.goto('/requests');
    await page.locator('[data-plan-request]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
