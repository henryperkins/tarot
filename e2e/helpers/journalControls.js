import { expect } from './frontendTest.js';

/** Choose a list density through the journal's visible Display disclosure. */
export async function selectJournalDensity(page, label) {
  const trigger = page.locator('#journal-history-filters').getByRole('button', { name: /^Display:/ });
  await trigger.click();
  const choices = page.getByRole('listbox', { name: 'Display', exact: true });
  await expect(choices).toBeVisible();
  await choices.getByRole('option', { name: label, exact: true }).click();
  await expect(choices).toHaveCount(0);
  await expect(trigger).toHaveAccessibleName(`Display: ${label}`);
  return trigger;
}

/** Open the explicit filter surface; never rely on the retired expansion key. */
export async function openJournalFilters(page) {
  const panel = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
  if (!await panel.isVisible()) {
    await page.locator('#journal-history-filters').getByRole('button', { name: /^Filters/ }).click();
  }
  await expect(panel).toBeVisible();
  return panel;
}

/** Apply a native filter choice and return to the readings. */
export async function selectJournalFilter(page, group, label) {
  const panel = await openJournalFilters(page);
  await panel.getByRole('group', { name: group, exact: true })
    .getByRole(group === 'Timeframe' ? 'radio' : 'checkbox', { name: label, exact: true }).check();
  await panel.getByRole('button', { name: 'Show readings', exact: true }).click();
  await expect(panel).toHaveCount(0);
}
