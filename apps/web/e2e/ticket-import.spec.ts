import { expect, test } from '@playwright/test';
import { collectErrors, signInAs } from './helpers';

// FR-18 — ticket import in the wizard flight card. Demo mode with no
// ANTHROPIC_API_KEY on the dev server (pinned below): the sample ticket from
// mocks/ticket.ts, flagged as a sample.

test.describe('FR-18 — import a flight from a ticket', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'dispatcher'));

  test('reads the ticket, lets the dispatcher pick the flight and fills the card', async ({ page }) => {
    const errors = collectErrors(page);
    await page.route('**/__dev/ai-parse-ticket', (route) => route.fulfill({ json: { unavailable: true, code: 'ticketImport.errors.devNoKey' } }));
    await page.goto('/tasks');
    await page.getByRole('button', { name: /New task|مهمة جديدة/ }).click();
    const wizard = page.getByRole('dialog', { name: /New task|مهمة جديدة/ });
    await wizard.getByRole('radio', { name: /Airport trip|رحلة مطار/ }).click();
    await wizard.getByRole('button', { name: /^(Next|التالي)$/ }).click();

    await wizard.locator('input[type=file]').setInputFiles({ name: 'ticket.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sample') });

    const review = page.getByRole('dialog', { name: /Check the ticket details|راجع بيانات التذكرة/ });
    await expect(review).toBeVisible();
    await expect(review.getByRole('alert').filter({ hasText: /sample ticket|تذكرة نموذجية/ })).toBeVisible();
    // return ticket JED ⇄ RUH: the RUH arrival (site airport) is preselected
    const options = review.getByRole('radio');
    await expect(options).toHaveCount(4);
    await expect(options.first()).toBeChecked();
    // Hamad is in the staff directory; the other passenger comes as a visitor in his group
    await expect(review.getByRole('checkbox')).toHaveCount(2);
    await expect(review.getByText(/BAKER\/JAMES/)).toBeVisible();
    await expect(review.getByRole('combobox')).not.toHaveValue('');
    await review.getByRole('button', { name: /Fill in the flight|تعبئة بيانات الرحلة/ }).hover();
    await page.screenshot({ path: `test-results/ticket-review-${test.info().project.name}.png` });

    await review.getByRole('button', { name: /Fill in the flight|تعبئة بيانات الرحلة/ }).click();
    await expect(review).toBeHidden();

    await expect(wizard.locator('#task-flight-no')).toHaveValue('SV 1023');
    await expect(wizard.locator('#task-flight-time')).toHaveValue('14:55');
    await expect(wizard.locator('#task-terminal')).toHaveValue('5');
    await expect(wizard.locator('#task-airline')).toHaveValue('Saudia');
    await expect(wizard.locator('#task-title')).toHaveValue(/SV 1023/);
    // the other end of the flight and the booking
    await expect(wizard.locator('#task-other-iata')).toHaveValue('JED');
    await expect(wizard.locator('#task-other-date')).not.toHaveValue('');
    await expect(wizard.locator('#task-other-time')).toHaveValue('13:10');
    await expect(wizard.locator('#task-booking-ref')).toHaveValue('K7Q2XD');
    await expect(wizard.getByText(/Hamad Al-Mutairi|حمد المطيري/)).toBeVisible();
    await expect(wizard.getByText('BAKER/JAMES MR')).toBeVisible();
    await expect(wizard.getByRole('status').filter({ hasText: /Sample data|بيانات نموذجية/ })).toBeVisible();
    await wizard.locator('#task-other-time').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/ticket-applied-${test.info().project.name}.png` });

    expect(errors).toEqual([]);
  });
});
