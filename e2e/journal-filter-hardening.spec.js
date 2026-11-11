import { test, expect } from './helpers/frontendTest.js';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';
import { openJournalFilters } from './helpers/journalControls.js';

const entry = {
  id: 'filter-hardening', ts: Date.now(), spread: 'Three-Card Story', spreadKey: 'threeCard',
  context: 'self', deckId: 'rws-1909', question: 'What supports a steady practice? 🌿 安心',
  cards: [{ name: 'The Fool', position: 'Present', orientation: 'Upright' }],
  personalReading: 'Make room for a small, useful reflection.'
};

async function openFilters(page, theme = 'dark') {
  const fixture = await createNarrativeFixture(page, { signedOut: true });
  await page.addInitScript(({ value, theme }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot_journal', JSON.stringify([value]));
    localStorage.setItem('tarot-theme', theme);
  }, { value: entry, theme });
  await page.goto('/journal');
  await openJournalFilters(page);
  return fixture;
}

for (const width of [320, 1440]) {
  test(`journal filters have named native groups and keyboard selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await openFilters(page);
    try {
      const trigger = page.locator('#journal-history-filters').getByRole('button', { name: /^Filters/ });
      const panel = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
      const group = panel.getByRole('group', { name: 'Timeframe', exact: true });
      const allTime = group.getByRole('radio', { name: 'All time', exact: true });
      const thirtyDays = group.getByRole('radio', { name: 'Last 30 days', exact: true });
      const ninetyDays = group.getByRole('radio', { name: 'Last 90 days', exact: true });
      await expect(group).toBeVisible();
      await expect(allTime).toBeChecked();
      await allTime.focus();
      // Native radios follow arrow-key selection rather than custom listbox Home/End rules.
      await page.keyboard.press('ArrowDown');
      await expect(thirtyDays).toBeFocused();
      await expect(thirtyDays).toBeChecked();
      await expect(allTime).not.toBeChecked();
      await page.keyboard.press('ArrowDown');
      await expect(ninetyDays).toBeFocused();
      await expect(ninetyDays).toBeChecked();
      await page.keyboard.press('ArrowUp');
      await expect(thirtyDays).toBeFocused();
      await expect(thirtyDays).toBeChecked();
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toHaveAccessibleName('Filters, 1 active');
      await expect(page.getByRole('region', { name: 'Journal filters', exact: true })
        .getByRole('button', { name: 'Remove Last 30 days filter', exact: true })).toBeVisible();
      await trigger.press('Enter');
      await expect(thirtyDays).toBeChecked();
      await panel.getByRole('button', { name: 'Close filters', exact: true }).click();
      await expect(trigger).toBeFocused();
    } finally {
      await fixture.close();
    }
  });
}

test('journal multi-select preserves its choices and desktop popover closes when focus leaves', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await openFilters(page);
  try {
    const panel = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
    const group = panel.getByRole('group', { name: 'Context', exact: true });
    const love = group.getByRole('checkbox', { name: 'Love', exact: true });
    const career = group.getByRole('checkbox', { name: 'Career', exact: true });
    await love.press('Space');
    await expect(love).toBeChecked();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(career).toBeFocused();
    await page.keyboard.press('Space');
    await expect(career).toBeChecked();
    await expect(love).toBeChecked();
    await expect(panel).toBeVisible();
    const search = page.getByRole('searchbox', { name: 'Search journal entries' });
    await search.focus();
    await expect(panel).toHaveCount(0);
    await expect(search).toBeFocused();
    const chip = page.getByRole('region', { name: 'Journal filters', exact: true })
      .getByRole('button', { name: 'Remove 2 contexts filter', exact: true });
    await expect(chip).toBeVisible();
    await openJournalFilters(page);
    await expect(love).toBeChecked();
    await expect(career).toBeChecked();
    await page.keyboard.press('Escape');
    await chip.click();
    await openJournalFilters(page);
    await expect(love).not.toBeChecked();
    await expect(career).not.toBeChecked();
  } finally {
    await fixture.close();
  }
});

for (const theme of ['dark', 'light']) {
  test(`journal filter contrast follows the ${theme} surfaces`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const fixture = await openFilters(page, theme);
    try {
      await page.evaluate(() => document.fonts.ready);
      const measureContrast = (surface, selector) => surface.evaluate((node, selector) => {
        const rgb = value => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d'); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
          const color = [...context.getImageData(0, 0, 1, 1).data]; return [...color.slice(0, 3), color[3] / 255];
        };
        const composite = (front, back) => front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3])).concat(1);
        const lum = color => color.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
        const root = getComputedStyle(document.documentElement);
        // Composite translucent selection/overlay fills against every theme
        // gradient endpoint beneath them, including both selected and idle text.
        const panelColors = ['--panel-dark-1', '--panel-dark-2', '--panel-dark-3'].map(name => rgb(root.getPropertyValue(name).trim()));
        const surfaceBackground = rgb(getComputedStyle(node).backgroundColor);
        return [...node.querySelectorAll(selector)].flatMap(choice => panelColors.map(panel => {
          const style = getComputedStyle(choice);
          const background = composite(rgb(style.backgroundColor), composite(surfaceBackground, panel));
          return ratio(composite(rgb(style.color), background), background);
        }));
      }, selector);
      const panel = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
      const ratios = await measureContrast(panel, 'label');
      expect(ratios.length).toBeGreaterThan(0);
      expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
      const filterResult = await new AxeBuilder({ page }).include('[role="dialog"]')
        .withRules(['aria-dialog-name', 'label']).analyze();
      expect(filterResult.violations).toEqual([]);
      await panel.getByRole('button', { name: 'Close filters', exact: true }).click();
      await page.getByRole('button', { name: /^View:/ }).click();
      const display = page.getByRole('listbox', { name: 'View', exact: true });
      const displayRatios = await measureContrast(display, '[role="option"]');
      expect(displayRatios.length).toBeGreaterThan(0);
      expect(Math.min(...displayRatios)).toBeGreaterThanOrEqual(4.5);
      const displayResult = await new AxeBuilder({ page }).include('[role="listbox"]')
        .withRules(['aria-input-field-name']).analyze();
      expect(displayResult.violations).toEqual([]);
    } finally {
      await fixture.close();
    }
  });
}
