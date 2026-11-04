import { expect, test, type Page } from '@playwright/test';
import { collectErrors, signInAs } from './helpers';

// 0004 — staff directory, Excel import, grade groups and the "same group only" rule.

const NEXT = /^(Next|التالي)$/;

async function escortWizard(page: Page) {
  await page.getByRole('button', { name: /New task|مهمة جديدة/ }).click();
  const wizard = page.getByRole('dialog', { name: /New task|مهمة جديدة/ });
  await wizard.getByRole('radio', { name: /Staff escort|مرافقة موظف/ }).click();
  await wizard.getByRole('button', { name: NEXT }).click();
  return wizard;
}

async function addStaff(wizard: ReturnType<Page['getByRole']>, query: string, employeeNo: string) {
  await wizard.locator('#task-passenger-search').fill(query);
  await wizard.getByRole('option').filter({ hasText: employeeNo }).click();
}

test.describe('staff directory (dispatcher)', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'dispatcher'));

  test('imports staff from a spreadsheet, updating by employee number', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/staff');
    await page.getByRole('button', { name: /Import from Excel|استيراد من Excel/ }).first().click();
    const dialog = page.getByRole('dialog');
    const csv = '\uFEFFالرقم الوظيفي,Name,Grade,Site\r\nE-1001,Eng. Sara Al-Otaibi,15,YAS\r\nE-3001,Eng. Laila Hassan,14,RHQ\r\nE-3002,,9,\r\n';
    await dialog.locator('#import-file').setInputFiles({ name: 'staff.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
    await expect(dialog.locator('#map-employee_no')).not.toHaveValue('');
    await expect(dialog.getByText(/2 rows ready|صفان جاهزان/)).toBeVisible();
    await dialog.getByRole('button', { name: /Import 2 people|استيراد شخصين/ }).click();
    await expect(dialog.getByText(/1 added · 1 updated|تمت إضافة 1 · تم تحديث 1/)).toBeVisible();
    await dialog.getByRole('button', { name: /^(Close|إغلاق)$/ }).first().click();
    await expect(page.getByRole('row').filter({ hasText: 'E-3001' })).toContainText('B');
    expect(errors).toEqual([]);
  });

  test('an A and a C in one car is flagged, and a dispatcher cannot save it', async ({ page }) => {
    await page.goto('/dashboard');
    const wizard = await escortWizard(page);
    await wizard.locator('#task-title').fill('Finance review at the bank');
    await addStaff(wizard, 'Saad', 'E-1007');
    await addStaff(wizard, 'Noura', 'E-1008');
    await expect(wizard.getByRole('alert').filter({ hasText: /Different grade groups|مجموعات درجات مختلفة/ })).toBeVisible();

    await wizard.getByRole('button', { name: NEXT }).click();
    await wizard.locator('#stop-1-label').fill('Riyad Bank');
    await wizard.locator('#stop-1-coords').fill('24.7136, 46.6753');
    await wizard.getByRole('button', { name: /^(Use|استخدام)$/ }).click();
    await wizard.getByRole('button', { name: NEXT }).click();
    await wizard.getByRole('button', { name: NEXT }).click();
    await wizard.getByRole('button', { name: NEXT }).click();
    await expect(wizard.getByText(/Different grade groups|مجموعات درجات مختلفة/).first()).toBeVisible();
    await expect(wizard.getByRole('button', { name: /Create task|إنشاء المهمة/ })).toBeDisabled();
  });

  test('a new person is registered from the wizard; a visitor needs only a group', async ({ page }) => {
    await page.goto('/dashboard');
    const wizard = await escortWizard(page);
    await wizard.locator('#task-passenger-search').fill('Huda Kamal');
    await wizard.getByRole('button', { name: /Register new person|تسجيل شخص جديد/ }).click();
    const register = page.getByRole('dialog', { name: /Add person|إضافة شخص/ });
    await expect(register.locator('#person-name')).toHaveValue('Huda Kamal');
    await register.getByRole('button', { name: /Save and add to trip|حفظ وإضافة إلى الرحلة/ }).click();
    await expect(register.getByText(/Grade must be|يجب أن تكون الدرجة/)).toBeVisible();
    await register.locator('#person-grade').fill('8');
    await register.getByRole('button', { name: /Save and add to trip|حفظ وإضافة إلى الرحلة/ }).click();
    await expect(register).toBeHidden();
    await expect(wizard.getByRole('listitem').filter({ hasText: 'Huda Kamal' })).toContainText('C');

    await wizard.locator('#task-passenger-search').fill('Mr. Visitor');
    await wizard.getByRole('button', { name: /One-time visitor|زائر لمرة واحدة/ }).click();
    const visitor = page.getByRole('dialog', { name: /One-time visitor|زائر لمرة واحدة/ });
    await visitor.getByRole('button', { name: /Add visitor|إضافة الزائر/ }).click();
    await expect(visitor.getByText(/Choose the group|اختر المجموعة التي/)).toBeVisible();
    await visitor.locator('#visitor-group').selectOption({ index: 3 }); // '' · A · B · C
    await visitor.getByRole('button', { name: /Add visitor|إضافة الزائر/ }).click();
    await expect(wizard.getByRole('listitem').filter({ hasText: 'Mr. Visitor' })).toContainText(/Visitor|زائر/);
    await expect(wizard.getByRole('alert').filter({ hasText: /Different grade groups|مجموعات درجات مختلفة/ })).toHaveCount(0);
  });
});

test.describe('grade groups (owner)', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'owner'));

  test('the company defines its groups in Settings → Grades', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/settings?tab=grades');
    await expect(page.locator('#grp-0-code')).toHaveValue('A');
    await expect(page.locator('#grp-0-min')).toHaveValue('16');
    await page.getByRole('button', { name: /01 is most senior|01 هي الأعلى/ }).click();
    await expect(page.locator('#grp-0-max')).toHaveValue('5');
    await page.locator('#grp-1-min').fill('3');
    await page.getByRole('button', { name: /^(Save|حفظ)$/ }).click();
    await expect(page.getByText(/overlaps another group|يتداخل مع مجموعة أخرى/)).toBeVisible();
    await page.locator('#grp-1-min').fill('6');
    await page.getByRole('button', { name: /^(Save|حفظ)$/ }).click();
    await expect(page.getByText(/^(Saved|تم الحفظ)$/)).toBeVisible();
    expect(errors).toEqual([]);
  });
});
