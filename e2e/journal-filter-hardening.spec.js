import { test, expect } from './helpers/frontendTest.js';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';

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
    localStorage.setItem('journal_filters_advanced_v1', 'true');
  }, { value: entry, theme });
  await page.goto('/journal');
  await expect(page.getByRole('button', { name: 'Timeframe', exact: true })).toBeVisible();
  return fixture;
}

for (const width of [320, 1440]) {
  test(`journal filters have a named listbox and keyboard selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await openFilters(page);
    try {
      const trigger = page.getByRole('button', { name: 'Timeframe', exact: true });
      await trigger.press('Enter');
      const listbox = page.getByRole('listbox', { name: 'Timeframe', exact: true });
      await expect(listbox).toBeVisible();
      await expect(listbox.getByRole('option', { name: 'All time', exact: true })).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(listbox.getByRole('option', { name: '30 days', exact: true })).toBeFocused();
      await page.keyboard.press('End');
      await expect(listbox.getByRole('option', { name: 'This year', exact: true })).toBeFocused();
      await page.keyboard.press('Home');
      await expect(listbox.getByRole('option', { name: 'All time', exact: true })).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(listbox).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(trigger).toContainText('30 days');
      await trigger.press('ArrowUp');
      await expect(listbox.getByRole('option', { name: '30 days', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    } finally {
      await fixture.close();
    }
  });
}

test('journal multi-select preserves its open list and closes on focus leaving', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await openFilters(page);
  try {
    const trigger = page.getByRole('button', { name: 'Context', exact: true });
    await trigger.press('Enter');
    const listbox = page.getByRole('listbox', { name: 'Context', exact: true });
    await expect(listbox).toBeVisible();
    const option = listbox.getByRole('option').first();
    await option.press('Space');
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await expect(listbox).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(listbox).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Spread', exact: true })).toBeFocused();
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
      const anyDate = page.getByText('Any date', { exact: true }).filter({ visible: true }).first();
      const ratios = await anyDate.evaluate(node => {
        const rgb = value => {
          if (value.startsWith('#')) return [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16)).concat(1);
          const parts = value.match(/[\d.]+/g).map(Number);
          return parts.length === 3 ? [...parts, 1] : parts;
        };
        const composite = (front, back) => front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3])).concat(1);
        const lum = color => color.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
        const root = getComputedStyle(document.documentElement);
        const cardBackground = rgb(root.getPropertyValue('--bg-surface').trim());
        const group = document.querySelector('[aria-label="List view mode"]');
        // Test the text against each actual theme gradient endpoint beneath the group.
        const panelColors = ['--panel-dark-1', '--panel-dark-2', '--panel-dark-3'].map(name => rgb(root.getPropertyValue(name).trim()));
        const groupBackground = rgb(getComputedStyle(group).backgroundColor);
        return [ratio(rgb(getComputedStyle(node).color), cardBackground), ...[...group.querySelectorAll('button')].flatMap(button => panelColors.map(panel => {
          const background = composite(rgb(getComputedStyle(button).backgroundColor), composite(groupBackground, panel));
          return ratio(rgb(getComputedStyle(button).color), background);
        }))];
      });
      expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
      await page.getByRole('button', { name: 'Timeframe', exact: true }).press('Enter');
      const result = await new AxeBuilder({ page }).include('[role="listbox"]').withRules(['aria-input-field-name']).analyze();
      expect(result.violations).toEqual([]);
    } finally {
      await fixture.close();
    }
  });
}
