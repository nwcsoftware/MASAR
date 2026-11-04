import { expect, test, type Page } from '@playwright/test';
import { collectErrors, signInAs } from './helpers';

// Phase 2 — task wizard, conflict gate, shared trips, calendar moves (demo
// mode: writes go to the in-memory store, so each test stays in one page load).

const NEXT = /^(Next|التالي)$/;

/** YYYY-MM-DD in Riyadh, `days` from today */
function riyadhDate(days: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function openWizard(page: Page, category: RegExp) {
  await page.getByRole('button', { name: /New task|مهمة جديدة/ }).click();
  const wizard = page.getByRole('dialog', { name: /New task|مهمة جديدة/ });
  await wizard.getByRole('radio', { name: category }).click();
  await wizard.getByRole('button', { name: NEXT }).click();
  return wizard;
}

test.describe('Phase 2 — task wizard (dispatcher)', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'dispatcher'));

  test('US-02: an airport pickup computes its start from the flight and saves', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/tasks');
    const wizard = await openWizard(page, /Airport trip|رحلة مطار/);

    // details: the site's default airport (RUH) is preselected
    await expect(wizard.locator('#task-airport')).not.toHaveValue('');
    await wizard.locator('#task-flight-no').fill('SV 1450');
    await wizard.locator('#task-flight-date').fill(riyadhDate(3));
    await wizard.locator('#task-flight-time').fill('14:00');
    await wizard.locator('#task-flight-no').blur();
    await expect(wizard.locator('#task-title')).toHaveValue(/SV 1450/);
    // passengers come from the staff directory (0004)
    await wizard.locator('#task-passenger-search').fill('Karim');
    await wizard.getByRole('option').filter({ hasText: 'E-1005' }).click();
    await wizard.getByRole('button', { name: NEXT }).click();

    // stops: site → airport → back to site, with legs
    await expect(wizard.locator('[id^="stop-"][id$="-label"]')).toHaveCount(3);
    await wizard.getByRole('button', { name: NEXT }).click();

    // schedule: start = flight − (drive + buffer), applied automatically
    const suggestion = wizard.getByText(/Leave at|الانطلاق الساعة/);
    await expect(suggestion).toBeVisible();
    const suggested = (await suggestion.textContent())!.match(/\d{2}:\d{2}/)![0];
    await expect(wizard.locator('#task-start')).toHaveValue(suggested);
    await expect(wizard.locator('#task-date')).toHaveValue(riyadhDate(3));
    await wizard.getByRole('button', { name: NEXT }).click();

    // assign: Fahad is free that day
    const fahad = wizard.locator('[data-driver="Fahad Al-Qahtani"]');
    await expect(fahad).toContainText(/Free|متاح/);
    await fahad.click();
    await wizard.getByRole('button', { name: NEXT }).click();

    await wizard.getByRole('button', { name: /Create task|إنشاء المهمة/ }).click();
    await expect(wizard).toBeHidden();

    // the new task opens in the slide-over, assigned
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: /SV 1450/ })).toBeVisible();
    await expect(sheet.getByText(/Assigned|مُسندة|معيّنة/).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('US-03: a double-booked driver is flagged and a dispatcher cannot save over it', async ({ page }) => {
    await page.goto('/dashboard');
    const wizard = await openWizard(page, /Staff escort|مرافقة موظف/);
    await wizard.locator('#task-title').fill('Escort auditors to the bank');
    await wizard.getByRole('button', { name: NEXT }).click();

    // the destination needs a name and a location
    await wizard.locator('#stop-1-label').fill('SAB Bank — Olaya');
    await wizard.locator('#stop-1-coords').fill('24.711, 46.6745');
    await wizard.getByRole('button', { name: /^(Use|استخدام)$/ }).click();
    await wizard.getByRole('button', { name: NEXT }).click();

    await wizard.locator('#task-date').fill(riyadhDate(0));
    await wizard.locator('#task-start').fill('13:00');
    await wizard.getByRole('button', { name: NEXT }).click();

    // Ahmed is on the delayed SV 1234 pickup → blocking overlap, inline
    const ahmed = wizard.locator('[data-driver="Ahmed Saleh"]');
    await expect(ahmed).toContainText(/Overlaps|تتداخل/);
    await ahmed.click();
    await wizard.getByRole('button', { name: NEXT }).click();

    await expect(wizard.getByRole('alert').filter({ hasText: /only an owner or admin|للمالك أو المدير فقط/ })).toBeVisible();
    await expect(wizard.getByRole('button', { name: /Create task|إنشاء المهمة/ })).toBeDisabled();
  });

  test('US-04: an unassigned airport pickup shares another site’s trip', async ({ page }) => {
    await page.goto('/tasks?q=EK 817');
    await page.getByRole('row').filter({ hasText: 'EK 817' }).first().click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: /Share trip|مشاركة الرحلة/ }).click();
    await expect(sheet.getByText(/Rides with|مع رحلة/)).toBeVisible();
    await expect(sheet.getByText(/Shared ride|رحلة مشتركة/)).toBeVisible();
  });
});

test.describe('Phase 2 — calendar (owner)', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'owner'));

  test('US-14: Shift+→ moves a task 15 minutes later', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/calendar');
    const block = page.getByRole('button', { name: /Escort Mr\. Hamad to SAB Bank/ });
    await expect(block).toHaveAccessibleName(/17:00/);
    await block.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.getByRole('button', { name: /Escort Mr\. Hamad to SAB Bank/ })).toHaveAccessibleName(/17:15/);
    expect(errors).toEqual([]);
  });
});
