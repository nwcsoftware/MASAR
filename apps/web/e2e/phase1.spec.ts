import { expect, test } from '@playwright/test';
import { collectErrors, signInAs } from './helpers';

// Phase 1 setup flows in demo mode (writes go to the in-memory store, so each
// test stays inside one page load and navigates client-side).
test.describe('Phase 1 — setup (owner)', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'owner'));

  test('US-01: create a site from a pasted Maps link, pick airports, see them on the site', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/sites');
    await page.getByRole('button', { name: /New site|موقع جديد/ }).first().click();

    const sheet = page.getByRole('dialog');
    await sheet.locator('#site-name').fill('Qiddiya Site');
    await sheet.locator('#site-code').fill('qdy');
    // invalid coordinates are rejected before saving
    await sheet.locator('#site-lat').fill('123');
    await sheet.getByRole('button', { name: /Save and choose airports|حفظ واختيار المطارات/ }).click();
    await expect(sheet.getByText(/Latitude must be between|يجب أن يكون خط العرض/)).toBeVisible();

    await sheet.locator('#coords-paste').fill('https://www.google.com/maps/place/Qiddiya/@24.5833,46.3333,12z');
    await sheet.getByRole('button', { name: /^Use$|^استخدام$/ }).click();
    await expect(sheet.locator('#site-lat')).toHaveValue('24.5833');
    await sheet.getByRole('button', { name: /Save and choose airports|حفظ واختيار المطارات/ }).click();

    // airports step: suggestions arrive, the nearest (RUH) is preselected as default
    await expect(sheet.getByText(/RUH ·/)).toBeVisible();
    await sheet.getByRole('button', { name: /Save airports|حفظ المطارات/ }).click();
    await expect(sheet).toBeHidden();

    await expect(page).toHaveURL(/\/sites\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Qiddiya Site');
    await expect(page.getByRole('cell', { name: /RUH ·/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('FR-05: add a vehicle in Settings', async ({ page }) => {
    await page.goto('/settings?tab=vehicles');
    await page.getByRole('button', { name: /Add vehicle|إضافة مركبة/ }).click();
    const sheet = page.getByRole('dialog');
    await sheet.locator('#veh-plate').fill('9090 QDY');
    await sheet.locator('#veh-make').fill('Toyota');
    await sheet.locator('#veh-model').fill('Coaster');
    await sheet.locator('#veh-seats').fill('22');
    await sheet.getByRole('button', { name: /^Save$|^حفظ$/ }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: '9090 QDY' })).toContainText('Coaster');
  });

  test('FR-04: invite a driver and see them in Users', async ({ page }) => {
    await page.goto('/settings?tab=users');
    await page.getByRole('button', { name: /Invite user|دعوة مستخدم/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#inv-email').fill('Omar.Driver@Masar.dev');
    await dialog.locator('#inv-name').fill('Omar Driver');
    await dialog.locator('#inv-role').selectOption('driver');
    await dialog.getByRole('button', { name: /Send invite|إرسال الدعوة/ }).click();
    await expect(dialog.getByText('omar.driver@masar.dev')).toBeVisible();
    await dialog.getByRole('button', { name: /^Close$|^إغلاق$/ }).first().click();
    await expect(page.getByRole('row').filter({ hasText: 'Omar Driver' })).toContainText(/Driver|سائق/);
  });

  test('FR-04: add a driver, then record leave on their page', async ({ page }) => {
    await page.goto('/drivers');
    await page.getByRole('button', { name: /Add driver|إضافة سائق/ }).first().click();
    const sheet = page.getByRole('dialog');
    await sheet.locator('#drv-name').fill('Saeed Al-Mutairi');
    await sheet.locator('#drv-emp').fill('D-077');
    await sheet.getByRole('button', { name: /^Save$|^حفظ$/ }).click();

    await expect(page).toHaveURL(/\/drivers\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Saeed Al-Mutairi');
    await page.getByRole('button', { name: /^Add$|^إضافة$/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /^Add$|^إضافة$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/Annual leave|إجازة سنوية/)).toBeVisible();
  });

  test('FR-51: add and remove a holiday', async ({ page }) => {
    await page.goto('/settings?tab=holidays');
    await page.locator('#hol-date').fill('2027-03-20');
    await page.locator('#hol-name').fill('Eid al-Fitr');
    await page.getByRole('button', { name: /^Add$|^إضافة$/ }).click();
    const row = page.getByRole('listitem').filter({ hasText: 'Eid al-Fitr' });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /Remove|حذف/ }).click();
    await expect(row).toBeHidden();
  });
});

test('a dispatcher cannot reach Settings and sees no admin-only actions', async ({ page }) => {
  await signInAs(page, 'dispatcher');
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/sites');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /New site|موقع جديد/ })).toHaveCount(0);
});
