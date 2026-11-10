import { test, expect } from './helpers/frontendTest.js';
import AxeBuilder from '@axe-core/playwright';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { createNarrativeFixture, startReading, SOURCE_USAGE, expectNoHorizontalOverflow, expectForeground, openReadingSupport, badgeContrast } from './helpers/narrativeFixtures.js';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block' });
const panelName = 'Reading Inputs Used';

for (const width of [1440, 390, 320]) {
  for (const theme of ['light', 'dark']) {
    test(`inputs disclosure is compact and accessible at ${width}px ${theme}${width < 769 ? ' @mobile' : ''}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
      const fixture = await createNarrativeFixture(page);
      try {
        await startReading(page, fixture);
        await openReadingSupport(page);
        const region = page.getByRole('region', { name: panelName });
        const trigger = region.getByRole('button', { name: panelName, exact: true });
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect((await region.boundingBox()).height).toBeLessThan(190);
        const feedback = page.getByRole('heading', { name: /How did this reading land/ });
        expect((await region.boundingBox()).y).toBeLessThan((await feedback.boundingBox()).y);
        await region.screenshot({ path: testInfo.outputPath(`inputs-${width}-${theme}-collapsed.png`) });
        await trigger.focus();
        await trigger.press('Enter');
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(region.getByText('Included: tone and reading depth.')).toBeVisible();
        await expect(region).not.toContainText(/requested not used|Skipped|telemetry|default profile/);
        await expectNoHorizontalOverflow(page);
        const id = await region.getByRole('heading', { name: panelName, exact: true }).getAttribute('id');
        expect(id).toBeTruthy();
        const accessibility = await new AxeBuilder({ page }).include(`section[aria-labelledby="${id}"]`).analyze();
        expect(accessibility.violations).toEqual([]);
        await region.screenshot({ path: testInfo.outputPath(`inputs-${width}-${theme}-expanded.png`) });
        if (width < 769) {
          const lastRow = region.getByRole('listitem').last();
          await lastRow.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await expectForeground(lastRow);
        }
        await trigger.press('Space');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(region.getByRole('listitem')).toHaveCount(0);
      } finally {
        await fixture.close();
      }
    });
  }
}

for (const state of ['unknown', 'fallback', 'error']) {
  test(`inputs panel hides ${state} attribution`, async ({ page }) => {
    const fixture = await createNarrativeFixture(page, state === 'unknown'
      ? { sourceUsage: {} } : state === 'fallback' ? { provider: 'safe-fallback' } : {});
    try {
      await startReading(page, fixture, { complete: state !== 'error' });
      if (state !== 'error') await openReadingSupport(page);
      if (state === 'error') {
        await fixture.emit('reading', 'delta', { text: 'A reflection is starting.' });
        await expect(page.locator('.narrative-stream')).toContainText('A reflection is starting.');
        await expect(page.getByRole('region', { name: panelName })).toHaveCount(0);
        await fixture.emit('reading', 'error', { message: 'The reading provider failed. Please try again.' });
        await expect(page.getByText('The reading provider failed. Please try again.').first()).toBeVisible();
      }
      await expect(page.getByRole('region', { name: panelName })).toHaveCount(0);
    } finally {
      await fixture.close();
    }
  });
}

const MEMORY_STATES = {
  // Four memories checked, none selected: a selection decision, not lost input.
  notApplicable: {
    usage: { requested: true, used: false, candidatesProvided: 4, memoriesSelected: 0, memoriesUsedInPrompt: 0, skippedReason: 'not_relevant' },
    badge: 'Not needed', detail: 'Checked 4 saved memories; none applied to this question.', warns: false
  },
  // A selected memory that the final reading dropped is a real omission.
  leftOut: {
    usage: { requested: true, used: false, candidatesProvided: 4, memoriesSelected: 1, memoriesUsedInPrompt: 0, skippedReason: 'removed_for_budget' },
    badge: 'Not included', detail: 'Left out to keep the reading within its length limit.', warns: true
  }
};

for (const [state, theme] of [['notApplicable', 'light'], ['notApplicable', 'dark'], ['leftOut', 'light']]) {
  test(`saved memories ${state === 'notApplicable' ? 'that did not apply raise no warning' : 'left out of the reading still warn'} (${theme})`, async ({ page }, testInfo) => {
    const expected = MEMORY_STATES[state];
    await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
    const fixture = await createNarrativeFixture(page, { sourceUsage: { ...SOURCE_USAGE.reference, memories: expected.usage } });
    try {
      await startReading(page, fixture);
      await openReadingSupport(page);
      const region = page.getByRole('region', { name: panelName });
      const trigger = region.getByRole('button', { name: panelName, exact: true });
      const warning = /shortened or left out/;
      // The warning is visible and announced while the panel is still collapsed.
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      if (expected.warns) {
        await expect(region).toContainText(warning);
        await expect(trigger).toHaveAccessibleDescription(warning);
      } else {
        await expect(region).not.toContainText(warning);
        await expect(trigger).not.toHaveAccessibleDescription(warning);
      }
      await trigger.press('Enter');
      const row = region.getByRole('listitem').filter({ has: page.getByText('Saved memories', { exact: true }) });
      const badge = row.locator('span:has(> svg)');
      await expect(badge).toHaveText(new RegExp(`^\\s*${expected.badge}\\s*$`));
      await expect(row).toContainText(expected.detail);
      expect((await badgeContrast(badge)).ratio, `${theme} ${expected.badge}`).toBeGreaterThanOrEqual(4.5);
      await region.screenshot({ path: testInfo.outputPath(`memories-${state}-${theme}-expanded.png`) });
    } finally {
      await fixture.close();
    }
  });
}

for (const hasSnapshot of [false, true]) {
  test(`journal resume ${hasSnapshot ? 'restores its own' : 'clears unknown'} inputs after a different reading`, async ({ page }) => {
    const fixture = await createNarrativeFixture(page);
    const saved = [];
    let newEntry;
    const olderEntry = {
      id: 'older-entry', ts: Date.now() - 86400000, spread: 'One-Card Insight', spreadKey: 'single',
      question: 'How can I prepare for a change?', cards: [{ name: 'The Sun', number: 19, position: 'Theme', orientation: 'Upright' }],
      personalReading: '## Opening\n\nA saved reflection from yesterday.\n\n## Reflection\n\nPrepare one small next step.',
      deckId: 'rws-1909', provider: 'local-composer', sessionSeed: 'older-seed', followUps: [], context: 'general',
      ...(hasSnapshot ? { sourceUsage: SOURCE_USAGE.alternate } : {})
    };
    await page.route('**/api/journal**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/journal' && route.request().method() === 'POST') {
        const payload = route.request().postDataJSON();
        saved.push(payload);
        newEntry = { ...payload, id: 'new-entry', ts: Date.now() };
        return route.fulfill({ json: { success: true, entry: newEntry } });
      }
      if (pathname === '/api/journal') return route.fulfill({ json: {
        entries: [...(newEntry ? [newEntry] : []), olderEntry], pagination: { hasMore: false, total: newEntry ? 2 : 1 }
      } });
      if (pathname === '/api/journal/new-entry' && newEntry) return route.fulfill({ json: { entry: newEntry } });
      if (pathname === '/api/journal/older-entry') return route.fulfill({ json: { entry: olderEntry } });
      return route.fallback();
    });
    try {
      await startReading(page, fixture);
      await openReadingSupport(page);
      await expect(page.getByRole('region', { name: panelName })).toBeVisible();
      await page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true }).click();
      await expect.poll(() => saved.length).toBe(1);
      expect(saved[0].sourceUsage.userContext.usedInputs).toContain('cardReflections');
      await page.getByRole('button', { name: 'View saved entry', exact: true }).filter({ visible: true }).click();
      const entry = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'One-Card Insight', exact: true }) });
      await entry.locator('button[title="Expand entry"]').click();
      await expect(entry.getByRole('button', { name: 'Ask a follow-up', exact: true })).toBeVisible();
      await entry.getByRole('button', { name: 'Ask a follow-up', exact: true }).click();
      await page.getByRole('button', { name: 'Close follow-up chat', exact: true }).click();
      await expect(page.locator('.narrative-stream')).toContainText('A saved reflection from yesterday.');
      await openReadingSupport(page);
      const region = page.getByRole('region', { name: panelName });
      if (hasSnapshot) {
        await region.getByRole('button', { name: panelName }).click();
        await expect(region.getByText('Uploaded images', { exact: true })).toBeVisible();
        await expect(region).not.toContainText('Traditional wisdom');
      } else {
        await expect(region).toHaveCount(0);
      }
    } finally {
      await fixture.close();
    }
  });
}

for (const explicit of [false, true]) {
  test(`journal saves preserve ${explicit ? 'explicit default choices' : 'absence of chosen preferences'}`, async ({ page }) => {
    if (explicit) await page.addInitScript(() => {
      localStorage.setItem('tarot-personalization:fixture-pro-user', JSON.stringify({ readingTone: 'balanced' }));
      localStorage.setItem('tarot-personalization:fixture-pro-user:explicit-fields', JSON.stringify(['readingTone']));
    });
    const fixture = await createNarrativeFixture(page);
    try {
      await startReading(page, fixture);
      await page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true }).click();
      await expect.poll(() => fixture.requests.journal.length).toBe(1);
      expect(fixture.requests.journal[0].userPreferences).toEqual(explicit
        ? { readingTone: 'balanced', _explicitFields: ['readingTone'] }
        : { _explicitFields: [] });
    } finally { await fixture.close(); }
  });
}


test('retained detected patterns are a separate source through reload and journal save', async ({ page }) => {
  const sourceUsage = buildEnhancedClaudePrompt({ spreadInfo: { key: 'single', name: 'One card' },
    cardsInfo: [{ card: 'The Sun', number: 19, orientation: 'Upright', position: 'Theme' }],
    themes: { knowledgeGraph: { narrativeHighlights: [{ text: 'The Sun connects vitality with renewed confidence.' }] } }
  }).promptMeta.sourceUsage;
  const fixture = await createNarrativeFixture(page, { sourceUsage });
  try {
    await startReading(page, fixture);
    for (const reload of [false, true]) {
      if (reload) await page.reload();
      await openReadingSupport(page);
      const region = page.getByRole('region', { name: panelName });
      await region.getByRole('button', { name: panelName, exact: true }).click();
      await expect(region).toContainText('Detected patterns');
      await expect(region).toContainText('1 card pattern supplied as reading context.');
      await expect(region).not.toContainText('Traditional wisdom');
    }
    await page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true }).click();
    await expect.poll(() => fixture.requests.journal.length).toBe(1);
    expect(fixture.requests.journal[0].sourceUsage.patterns.patternsUsedInPrompt).toBe(1);
  } finally { await fixture.close(); }
});

// Traditional wisdom is additional context, so its failure must not read as lost personal input.
for (const theme of ['light', 'dark']) {
  test(`a reference retrieval error is shown as missing context, not lost input (${theme})`, async ({ page }, testInfo) => {
    await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
    const fixture = await createNarrativeFixture(page, { sourceUsage: {
      ...SOURCE_USAGE.reference,
      graphRAG: { requested: true, used: false, mode: 'none', skippedReason: 'retrieval_error', passagesProvided: 0, passagesUsedInPrompt: 0, passageIndices: [] }
    } });
    try {
      await startReading(page, fixture);
      await openReadingSupport(page);
      const region = page.getByRole('region', { name: panelName });
      const trigger = region.getByRole('button', { name: panelName, exact: true });
      const warning = /Some additional context could not be included\./;
      // Visible and announced while collapsed.
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(region).toContainText(warning);
      await expect(trigger).toHaveAccessibleDescription(warning);
      await expect(region).not.toContainText('Some of your input');
      await trigger.press('Enter');
      const row = region.getByRole('listitem').filter({ has: page.getByText('Traditional wisdom', { exact: true }) });
      await expect(row.locator('span:has(> svg)')).toHaveText(/^\s*Not included\s*$/);
      await expect(row).toContainText('Reference passages could not be loaded for this reading.');
      expect((await badgeContrast(row.locator('span:has(> svg)'))).ratio, `${theme} Not included`).toBeGreaterThanOrEqual(4.5);
      await region.screenshot({ path: testInfo.outputPath(`retrieval-error-${theme}-expanded.png`) });
    } finally {
      await fixture.close();
    }
  });
}
