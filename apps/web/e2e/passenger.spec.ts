import { expect, test } from '@playwright/test';
import { collectErrors, signInAs } from './helpers';

// Passenger module, phase 1 (0006): trips, driver card, documents, rating,
// registration + approval, staff documents and the ratings dashboard.

test.describe('passenger app (Sara)', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'passenger'));

  test('sees her trips, the driver card without a phone number, and her documents', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/passenger');
    await expect(page.locator('[data-trip]')).toHaveCount(3);
    await page.locator('[data-trip="60000000-0000-4000-8000-000000000016"]').click();

    await expect(page.locator('[data-ticket]')).toContainText('SV 1043');
    const card = page.locator('[data-driver-card]');
    await expect(card).toContainText(/Saudi|سعودي/);
    await expect(card).toContainText(/Light vehicle driving licence|رخصة قيادة خاصة/);
    await expect(card).not.toContainText('+966');
    await expect(page.locator('[data-document]')).toHaveCount(2);
    await expect(page.getByText('Travel approval (internal)')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('rates yesterday’s ride (single and multiple choices, comment)', async ({ page }) => {
    await page.goto('/passenger');
    await page.getByRole('link', { name: /Rate now|قيّم الآن/ }).first().click();
    await expect(page).toHaveURL(/\/passenger\/rate\//);

    await page.getByRole('button', { name: /Submit rating|إرسال التقييم/ }).click();
    await expect(page.getByRole('alert').filter({ hasText: /1 to 5 stars|من نجمة إلى 5/ })).toBeVisible();

    await page.getByRole('radio', { name: /^(4 stars|4 نجوم)$/ }).click();
    const driving = page.locator('[data-category="driving"]');
    await driving.getByRole('radio', { name: /Smooth and safe|قيادة سلسة/ }).click();
    await driving.getByRole('radio', { name: /^(Speeding|سرعة زائدة)$/ }).click();
    await expect(driving.getByRole('radio', { checked: true })).toHaveCount(1);
    const clean = page.locator('[data-category="cleanliness"]');
    await clean.getByRole('checkbox', { name: /Clean and tidy|نظيفة ومرتبة/ }).click();
    await clean.getByRole('checkbox', { name: /Dirty exterior|الهيكل الخارجي متسخ/ }).click();
    await expect(clean.getByRole('checkbox', { checked: true })).toHaveCount(2);
    await page.locator('#rating-comment').fill('A bit fast on the ring road.');
    await page.getByRole('button', { name: /Submit rating|إرسال التقييم/ }).click();

    await expect(page).toHaveURL(/\/passenger\/trips\//);
    await expect(page.getByText('A bit fast on the ring road.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Edit until|يمكن التعديل حتى/ })).toBeVisible();
  });

  test('stays out of the staff console', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/passenger$/);
  });
});

test.describe('registration', () => {
  test('a new employee signs up and waits for approval', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /Register as a passenger|سجّل كراكب/ }).click();
    await page.locator('#reg-name').fill('Omar New');
    await page.locator('#reg-email').fill('omar.new@gmail.com');
    await page.locator('#reg-password').fill('secret-123');
    await page.getByRole('button', { name: /Create account|إنشاء الحساب/ }).click();
    await expect(page.getByRole('alert').filter({ hasText: /domain isn’t registered|نطاق بريدك غير مسجل/ })).toBeVisible();

    await page.getByRole('radio', { name: /Employee ID|الرقم الوظيفي/ }).click();
    await page.locator('#reg-employee').fill('E-1005');
    await page.locator('#reg-code').fill('masar-2026');
    await page.getByRole('button', { name: /Create account|إنشاء الحساب/ }).click();
    await expect(page.getByText(/Waiting for approval|بانتظار الموافقة/)).toBeVisible();
    await expect(page.locator('[data-trip]')).toHaveCount(0);
  });

  test('the owner approves a pending sign-up from Staff', async ({ page }) => {
    await signInAs(page, 'owner');
    await page.goto('/staff');
    const row = page.locator('[data-registration="laila@masar.dev"]');
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /Approve|موافقة/ }).click();
    await expect(row).toHaveCount(0);
  });
});

test.describe('staff side', () => {
  test('a dispatcher attaches a hotel booking for the passengers', async ({ page }) => {
    await signInAs(page, 'dispatcher');
    await page.goto('/tasks?task=60000000-0000-4000-8000-000000000016&range=all');
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('tab', { name: /Documents|المستندات/ }).click();
    await expect(sheet.locator('[data-trip-document]')).toHaveCount(3);
    await sheet.getByRole('button', { name: /Attach document|إرفاق مستند/ }).click();
    const dialog = page.getByRole('dialog', { name: /Attach document|إرفاق مستند/ });
    await dialog.locator('#trip-doc-file').setInputFiles({ name: 'gate-pass-jeddah.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 demo') });
    await expect(dialog.locator('#trip-doc-title')).toHaveValue('gate-pass-jeddah');
    await dialog.locator('#trip-doc-type').selectOption('gate_pass');
    await dialog.getByRole('button', { name: /^(Save|حفظ)$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(sheet.locator('[data-trip-document]')).toHaveCount(4);
  });

  test('the owner sees low ratings with the passenger; dispatchers cannot open the page', async ({ page }) => {
    await signInAs(page, 'owner');
    await page.goto('/ratings?low=true');
    const rating = page.locator('[data-rating]').first();
    await expect(rating).toContainText(/Hamad|حمد/);
    await expect(rating).toContainText(/Harsh braking|فرملة أو تسارع/);
  });

  test('dispatchers are kept out of the ratings dashboard', async ({ page }) => {
    await signInAs(page, 'dispatcher');
    await page.goto('/ratings');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
