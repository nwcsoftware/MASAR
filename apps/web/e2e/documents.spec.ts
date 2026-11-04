import { expect, test } from '@playwright/test';
import { collectErrors, signInAs } from './helpers';

// 0005 — job titles, required documents, uploads and renewal reminders (owner).

test.describe('driver documents (owner)', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'owner'));

  test('the Documents page lists what needs action, most urgent first', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/documents');
    const rows = page.getByRole('row');
    // Khalid's lapsed authorisation tops the list, then his missing insurance
    await expect(rows.nth(1)).toContainText(/Expired 5 days ago|انتهى منذ 5 أيام/);
    await expect(rows.nth(2)).toContainText(/Missing|غير موجود/);
    await expect(page.getByRole('row').filter({ hasText: /Fahad|فهد/ })).toHaveCount(0);
    await page.getByRole('button', { name: /^(All|الكل)$/ }).click();
    await expect(page.getByRole('row').filter({ hasText: /Fahad|فهد/ }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('renewing a document with a new copy and dates clears the alert', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/drivers/40000000-0000-4000-8000-000000000002');
    const row = page.locator('[data-document="Driving authorisation"]');
    await expect(row).toContainText(/Expired|انتهى/);
    await row.getByRole('button', { name: /Renew|تجديد/ }).click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('#doc-expires').fill('2026-01-01');
    await dialog.locator('#doc-issued').fill('2026-02-01');
    await dialog.getByRole('button', { name: /^(Save|حفظ)$/ }).click();
    await expect(dialog.getByText(/must be after the issue date|بعد تاريخ الإصدار/)).toBeVisible();

    const year = new Date().getFullYear();
    await dialog.locator('#doc-issued').fill(`${year}-01-01`);
    await dialog.locator('#doc-expires').fill(`${year + 2}-01-01`);
    await dialog.locator('#doc-file').setInputFiles({ name: 'authorisation.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 demo') });
    await dialog.getByRole('button', { name: /^(Save|حفظ)$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText(/Valid|ساري/);
    expect(errors).toEqual([]);
  });

  test('a new job title puts its documents on the driver', async ({ page }) => {
    await page.goto('/settings?tab=documents');
    await page.getByRole('button', { name: /Add job title|إضافة مسمى وظيفي/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#job-name').fill('Bus driver');
    await dialog.getByRole('checkbox', { name: /Heavy vehicle driving licence|رخصة قيادة عمومي ثقيل/ }).click();
    await dialog.getByRole('checkbox', { name: /Passport|جواز السفر/ }).click();
    await dialog.getByRole('button', { name: /^(Save|حفظ)$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('listitem').filter({ hasText: 'Bus driver' })).toContainText(/Passport|جواز السفر/);

    // give Fahad the job: the heavy licence becomes required (missing).
    // Navigate inside the app — a reload would reset the demo store.
    const driversLink = page.getByRole('link', { name: /^(Drivers|السائقون)$/ });
    if (!(await driversLink.isVisible())) await page.getByRole('button', { name: /^(Open menu|فتح القائمة)$/ }).click(); // phone: sidebar is a drawer
    await driversLink.click();
    await page.getByRole('link').filter({ hasText: 'D-004' }).click();
    await page.getByRole('button', { name: /^(Edit|تعديل)$/ }).click();
    await page.getByRole('dialog').locator('#drv-job').selectOption({ label: 'Bus driver' });
    await page.getByRole('dialog').getByRole('button', { name: /^(Save|حفظ)$/ }).click();
    await expect(page.locator('[data-document="Heavy vehicle driving licence"]')).toContainText(/Missing|غير موجود/);
  });

  test('renewal reminders in the bell open the driver', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /notification|إشعار|الإشعارات/i }).first().click();
    await page.getByRole('button', { name: /Document expired|مستند منتهي/ }).first().click();
    await expect(page).toHaveURL(/\/drivers\/40000000-0000-4000-8000-000000000002$/);
  });
});
