import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, startReading, badgeContrast, expectTarget, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';
import { analyzeSpreadThemes, analyzeThreeCard } from '../functions/lib/spreadAnalysis.js';
import { retrievePassages } from '../functions/lib/graphRAG.js';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block' });

// This seed draws The Star, Temperance/Art, and Death through the real UI.
const DRAW_TIME = 1790500049291;

async function withInsights(page, { deck = 'rws-1909', fallback = false } = {}, check) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(DRAW_TIME);
  await page.addInitScript(deck => localStorage.setItem('tarot-deck-style', deck), deck);
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false });
    await expect.poll(() => fixture.requests.reading.length).toBe(1);
    if (!fallback) {
      const request = fixture.requests.reading[0];
      const themes = await analyzeSpreadThemes(request.cardsInfo, { deckStyle: deck, env: { GRAPHRAG_ENABLED: 'true' } });
      themes.knowledgeGraph.graphRAGPayload = { passages: retrievePassages(themes.knowledgeGraph.graphKeys, { maxPassages: 2 }) };
      await fixture.emit('reading', 'meta', {
        themes,
        spreadAnalysis: analyzeThreeCard(request.cardsInfo),
        requestId: 'spread-insights-test'
      });
    }
    await fixture.completeReading();
    const panel = page.locator('.spread-patterns-panel');
    const disclosure = panel.getByRole('button', { name: /^Spread Insights/ });
    if (await disclosure.count()) {
      await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
      await disclosure.press('Enter');
      await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    }
    await check(panel, fixture);
    expect(errors).toEqual([]);
    expect(fixture.requests.reading).toHaveLength(1);
  } finally {
    await fixture.close();
  }
}

async function openSupportingSections(panel) {
  for (const title of ['More spread details', 'Archetypal Patterns', 'Traditional Wisdom']) {
    const button = panel.getByRole('button', { name: new RegExp(`^${title}`) });
    if (await button.count()) {
      await button.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expectTarget(button);
    }
  }
}

for (const mobile of [false, true]) {
  for (const theme of ['dark', 'light']) {
    test(`insights readability, progressive disclosure, and lists: ${theme}${mobile ? ' @mobile' : ''}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
      await page.addInitScript(theme => localStorage.setItem('tarot-theme', theme), theme);
      await withInsights(page, {}, async panel => {
        const summary = panel.getByRole('list', { name: 'Spread highlights' });
        await expect(summary.getByRole('listitem')).toHaveCount(3);
        await expect(summary).toContainText('Healing Arc');
        await expect(summary).toContainText('Story Flow');
        await expect(summary).not.toContainText('Deck scope:');
        expect(await panel.locator('article').first().isVisible()).toBe(false);
        await openSupportingSections(panel);
        const passages = panel.getByRole('list', { name: 'Traditional wisdom passages' });
        await expect(passages.getByRole('listitem')).toHaveCount(2);
        await expect(panel).toContainText('Deck scope:');
        const axe = await new AxeBuilder({ page }).include('.spread-patterns-panel')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(axe.violations).toEqual([]);
        for (const locator of [panel.locator('h2 .font-serif'), panel.locator('h3').first(), summary, passages.locator('blockquote').first()]) {
          expect((await badgeContrast(locator)).ratio).toBeGreaterThanOrEqual(4.5);
        }
        await expectNoHorizontalOverflow(page, '.spread-patterns-panel');
        if (mobile) {
          await page.setViewportSize({ width: 320, height: 844 });
          await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
          await expectNoHorizontalOverflow(page, '.spread-patterns-panel');
          const disclosure = panel.getByRole('button', { name: /^Spread Insights/ });
          await disclosure.press(' ');
          await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
          await expect(disclosure).toBeFocused();
          await expect(panel.getByRole('list')).toHaveCount(0);
        }
      });
    });
  }
}

test('insights remain recoverable when focus mode crosses the handset breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await withInsights(page, {}, async () => {
    await page.getByRole('button', { name: 'Focus on narrative', exact: true }).press('Enter');
    await expect(page.locator('.spread-patterns-panel')).toHaveCount(0);
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole('button', { name: 'Show insight panels', exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Show insight panels', exact: true }).press('Enter');
    await expect(page.getByRole('button', { name: 'Focus on narrative', exact: true })).toBeFocused();
    const disclosure = page.getByRole('button', { name: /^Spread Insights/ });
    await disclosure.press('Enter');
    await expect(page.getByRole('list', { name: 'Spread highlights' })).toBeVisible();
    await expectNoHorizontalOverflow(page, '.spread-patterns-panel');
  });
});

for (const { deck, mobile } of [
  { deck: 'rws-1909' }, { deck: 'thoth-a1' }, { deck: 'marseille-classic' },
  { deck: 'thoth-a1', mobile: true }
]) {
  test(`reference provenance and card-detail actions match the selected deck: ${deck}${mobile ? ' @mobile' : ''}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await withInsights(page, { deck }, async panel => {
      await openSupportingSections(panel);
      const passages = panel.getByRole('list', { name: 'Traditional wisdom passages' });
      await expect(passages).toContainText('Rider-Waite-Smith reference');
      if (deck !== 'rws-1909') await expect(panel).toContainText('imagery');
      const name = deck === 'thoth-a1' ? 'Art' : deck === 'marseille-classic' ? 'La Mort' : 'Death';
      const mention = panel.getByRole('button', { name: new RegExp(`^View ${name}`) }).first();
      if (mobile) await mention.tap();
      else await mention.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(name);
      const artwork = dialog.locator('img').first();
      const deckPath = deck === 'thoth-a1' ? '/thoth/' : deck === 'marseille-classic' ? '/marseille/' : '/RWS1909_';
      await expect(artwork).toHaveAttribute('src', new RegExp(deckPath));
      await expect.poll(() => artwork.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      await expect(dialog.getByRole('button', { name: 'Previous card', exact: true })).toBeEnabled();
      const next = dialog.getByRole('button', { name: 'Next card', exact: true });
      if (deck === 'thoth-a1') {
        await expect(next).toBeEnabled();
        await expect(dialog).toContainText('2 of 3');
        await next.press('Enter');
        await expect(dialog.getByRole('heading', { level: 2 })).toContainText('Death');
        await expect(next).toBeDisabled();
      } else {
        await expect(next).toBeDisabled();
        await expect(dialog).toContainText('3 of 3');
      }
      await dialog.getByRole('button', { name: 'Previous card', exact: true }).press('Enter');
      await dialog.getByRole('button', { name: 'Previous card', exact: true }).press('Enter');
      await expect(dialog.getByRole('button', { name: 'Previous card', exact: true })).toBeDisabled();
      await expect(dialog).toContainText('1 of 3');
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(mention).toBeFocused();
    });
  });
}

test('local fallback keeps all highlights reachable without empty sections', async ({ page }) => {
  await withInsights(page, { fallback: true }, async panel => {
    await expect(panel.getByRole('list', { name: 'Spread highlights' }).getByRole('listitem')).toHaveCount(3);
    await expect(panel.getByRole('button', { name: /^Archetypal Patterns|^Traditional Wisdom/ })).toHaveCount(0);
    await panel.getByRole('button', { name: /^More spread details/ }).press('Enter');
    await expect(panel).toContainText('Deck scope:');
  });
});
