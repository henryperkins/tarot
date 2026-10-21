import { test, expect } from './helpers/frontendTest.js';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, startReading, badgeContrast, expectTarget, expectNoHorizontalOverflow, openReadingSupport, openReadingAbout, SOURCE_USAGE } from './helpers/narrativeFixtures.js';
import { analyzeSpreadThemes, analyzeThreeCard, analyzeDecision, analyzeRelationship, analyzeCelticCross } from '../functions/lib/spreadAnalysis.js';
import { retrievePassages } from '../functions/lib/graphRAG.js';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block' });

// This seed draws The Star, Temperance/Art, and Death through the real UI.
const DRAW_TIME = 1790500049291;

async function withInsights(page, { deck = 'rws-1909', fallback = false, passages, passageIndices, spreadName, analysisBuilder = analyzeThreeCard, drawTime = DRAW_TIME } = {}, check) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(drawTime);
  await page.addInitScript(deck => localStorage.setItem('tarot-deck-style', deck), deck);
  const sourceUsage = structuredClone(SOURCE_USAGE.reference);
  const fixture = await createNarrativeFixture(page, { sourceUsage });
  try {
    await startReading(page, fixture, { complete: false, spreadName });
    await expect.poll(() => fixture.requests.reading.length).toBe(1);
    if (!fallback) {
      const request = fixture.requests.reading[0];
      const themes = await analyzeSpreadThemes(request.cardsInfo, { deckStyle: deck, env: { GRAPHRAG_ENABLED: 'true' } });
      themes.knowledgeGraph.graphRAGPayload = { passages: passages ?? retrievePassages(themes.knowledgeGraph.graphKeys, { maxPassages: 2 }) };
      const candidates = themes.knowledgeGraph.graphRAGPayload.passages;
      const retained = passageIndices ?? candidates.map((_, index) => index);
      sourceUsage.graphRAG = { requested: true, used: retained.length > 0, mode: retained.length ? 'full' : 'none',
        passagesProvided: candidates.length, passagesUsedInPrompt: retained.length, passageIndices: retained };
      await fixture.emit('reading', 'meta', {
        themes,
        sourceUsage,
        spreadAnalysis: analysisBuilder(request.cardsInfo),
        requestId: 'spread-insights-test'
      });
    }
    await fixture.completeReading();
    await openReadingSupport(page);
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
  for (const title of ['More spread details', 'Archetypal patterns', 'Traditional wisdom']) {
    const button = panel.getByRole('button', { name: new RegExp(`^${title}`) });
    if (await button.count()) {
      await button.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expectTarget(button);
    }
  }
}

const partialReference = {
  id: 'partial-reference', type: 'triad', title: 'Incomplete reference',
  text: 'The Magician appears in this incomplete reference, but was not drawn.',
  isPartialPattern: true
};
const completeReference = {
  id: 'complete-reference', type: 'triad', title: 'Complete reference',
  text: 'Death, Temperance, and The Star form the complete healing arc.'
};

for (const deckStyle of ['thoth-a1', 'marseille-classic']) {
  test(`restored ${deckStyle} analysis cannot use the current RWS preference for Symbol cues`, async ({ page }) => {
    // This real draw has Five, Six, and Two of Cups, with an RWS water cue.
    await withInsights(page, { drawTime: 1790500049689 }, async (panel, fixture) => {
      await openSupportingSections(panel);
      await expect(panel).toContainText('three spilled cups');
      const cards = fixture.requests.reading[0].cardsInfo;
      expect(cards.every(card => card.suit === 'Cups')).toBe(true);
      const themes = await analyzeSpreadThemes(cards, { deckStyle });
      const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('tarot:reading-snapshot')));
      saved.analysis.themes = themes;
      saved.analysis.readingMeta.deckStyle = deckStyle;
      // Reproduce a completed reading restored under a different preference.
      // Leave the page before seeding storage so pagehide cannot overwrite it.
      await page.route('**/__reading-restore-test', route => route.fulfill({
        contentType: 'text/html', body: '<!doctype html><title>Restore fixture</title>'
      }));
      await page.goto('/__reading-restore-test');
      await page.addInitScript(value => sessionStorage.setItem('tarot:reading-snapshot', JSON.stringify(value)), saved);
      await page.goto('/');
      await openReadingSupport(page);
      const restored = page.locator('.spread-patterns-panel');
      const toggle = restored.getByRole('button', { name: /^Spread Insights/ });
      if (await toggle.count()) await toggle.click();
      await openSupportingSections(restored);
      await expect(restored).toContainText('Suit Focus:');
      await expect(restored).not.toContainText('Symbol Cue:');
      await expect(restored).not.toContainText('three spilled cups');
    });
  });
}

test('only retained references appear and survive a completed-reading reload', async ({ page }) => {
  const dropped = { id: 'dropped', text: 'This retrieved reference was removed for budget.' };
  await withInsights(page, { passages: [dropped, completeReference, partialReference], passageIndices: [1, 2] }, async panel => {
    await openSupportingSections(panel);
    await expect(panel.locator('blockquote')).toHaveCount(1);
    await expect(panel.locator('blockquote')).toContainText(completeReference.text);
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('tarot:reading-snapshot') || 'null')?.analysis?.readingMeta?.sourceUsage?.graphRAG?.passageIndices)).toEqual([1, 2]);
    await page.reload();
    await openReadingSupport(page);
    const restored = page.locator('.spread-patterns-panel');
    const toggle = restored.getByRole('button', { name: /^Spread Insights/ });
    if (await toggle.count()) await toggle.click();
    await openSupportingSections(restored);
    await expect(restored.locator('blockquote')).toHaveCount(1);
    await expect(restored.locator('blockquote')).toContainText(completeReference.text);
  });
});

test('unused references leave no empty Traditional wisdom section', async ({ page }) => {
  await withInsights(page, { passages: [completeReference], passageIndices: [] }, async panel => {
    await expect(panel.getByRole('button', { name: /^Traditional wisdom/ })).toHaveCount(0);
    await expect(panel.locator('blockquote')).toHaveCount(0);
  });
});

for (const mobile of [false, true]) {
  test(`partial-pattern quotations are excluded while complete references remain${mobile ? ' @mobile' : ''}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await withInsights(page, { passages: [partialReference, completeReference] }, async (panel, fixture) => {
      expect(fixture.requests.reading[0].cardsInfo.map(card => card.card)).not.toContain('The Magician');
      await openSupportingSections(panel);
      const passages = panel.getByRole('list', { name: 'Traditional wisdom passages' });
      await expect(passages.getByRole('listitem')).toHaveCount(1);
      await expect(passages).toContainText(completeReference.text);
      await expect(panel.locator('blockquote').filter({ hasText: partialReference.text })).toHaveCount(0);
      if (mobile) {
        await expect(panel.getByRole('button', { name: /^Spread Insights/ })).toHaveCount(0);
        await expect(panel.getByRole('heading', { name: 'Spread Insights', exact: true })).toBeVisible();
      }
    });
  });
}

test('partial-pattern quotations alone leave no empty Traditional wisdom disclosure', async ({ page }) => {
  await withInsights(page, { passages: [partialReference] }, async panel => {
    await expect(panel.getByRole('list', { name: 'Spread highlights' })).toBeVisible();
    await expect(panel.getByRole('button', { name: /^Traditional wisdom/ })).toHaveCount(0);
    await expect(panel.locator('blockquote')).toHaveCount(0);
  });
});

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
        for (const locator of [panel.locator('h2'), panel.locator('h3').first(), summary, passages.locator('blockquote').first()]) {
          expect((await badgeContrast(locator)).ratio).toBeGreaterThanOrEqual(4.5);
        }
        await expectNoHorizontalOverflow(page, '.spread-patterns-panel');
        if (mobile) {
          await page.setViewportSize({ width: 320, height: 844 });
          await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
          await expectNoHorizontalOverflow(page, '.spread-patterns-panel');
          const disclosure = page.locator('.reading-support > summary');
          await disclosure.press(' ');
          expect(await page.locator('.reading-support').evaluate(element => element.open)).toBe(false);
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
    await openReadingAbout(page);
    await page.getByRole('button', { name: 'Hide extra panels: off', exact: true }).press('Enter');
    await expect(page.locator('.spread-patterns-panel')).toBeHidden();
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole('button', { name: 'Hide extra panels: on', exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Hide extra panels: on', exact: true }).press('Enter');
    await expect(page.getByRole('button', { name: 'Hide extra panels: off', exact: true })).toBeFocused();
    await expect(page.getByRole('list', { name: 'Spread highlights' })).toBeVisible();
    await expectNoHorizontalOverflow(page, '.spread-patterns-panel');
  });
});

test('completion stays available and optional tools keep their order, column and focus style', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await withInsights(page, {}, async panel => {
    const inputs = page.getByRole('region', { name: 'Reading Inputs Used' });
    await expect(inputs).toBeVisible();
    // The shared-panel layout intentionally puts feedback before conversation/media.
    const expectReadingOrder = async () => {
      const tops = [];
      const completion = page.locator('[data-reading-completion]').filter({ visible: true });
      await expect(completion).toBeVisible();
      const handset = page.viewportSize().width < 769;
      if (handset) await expect(completion).toBeInViewport();
      for (const locator of [
        ...(!handset ? [completion] : []),
        panel,
        inputs,
        page.getByRole('heading', { name: /How did this reading land/, level: 2 }),
        page.getByRole('heading', { name: 'Recent media', exact: true, level: 2 }),
        page.getByRole('button', { name: 'Start a new reading and reset this spread', exact: true })
      ]) tops.push((await locator.boundingBox()).y);
      expect(tops).toEqual([...tops].sort((a, b) => a - b));
    };
    await expectReadingOrder();
    const focusRing = async button => {
      await button.press('Enter');
      return button.evaluate(async element => {
        // The global focus rule transitions outline-offset; compare settled values.
        await Promise.all(element.getAnimations().map(animation => animation.finished));
        const { outlineStyle, outlineWidth, outlineColor, outlineOffset } = getComputedStyle(element);
        return { focusVisible: element.matches(':focus-visible'), outlineStyle, outlineWidth, outlineColor, outlineOffset };
      });
    };
    const insightsRing = await focusRing(panel.getByRole('button', { name: /^More spread details/ }));
    expect(insightsRing.focusVisible).toBe(true);
    expect(insightsRing).toEqual(await focusRing(page.getByRole('button', { name: 'Reading Inputs Used', exact: true })));
    for (const width of [1440, 900, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expectReadingOrder();
      const columns = await Promise.all([panel, inputs].map(locator => locator.evaluate(node => {
        const box = node.getBoundingClientRect();
        return `${Math.round(box.x)}+${Math.round(box.width)}`;
      })));
      expect(columns).toHaveLength(2);
      expect(new Set(columns).size, `${width}px panels: ${columns.join(', ')}`).toBe(1);
    }
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
    await expect(panel.getByRole('button', { name: /^Archetypal patterns|^Traditional wisdom/ })).toHaveCount(0);
    await panel.getByRole('button', { name: /^More spread details/ }).press('Enter');
    await expect(panel).toContainText('Deck scope:');
  });
});


test('one reversed card has one singular orientation insight', async ({ page }) => {
  await withInsights(page, { fallback: true, spreadName: 'One-Card Insight' }, async (panel, fixture) => {
    expect(fixture.requests.reading[0].cardsInfo).toHaveLength(1);
    expect(fixture.requests.reading[0].cardsInfo[0].orientation).toBe('Reversed');
    await openSupportingSections(panel);
    await expect(panel).not.toContainText('A majority of reversed cards');
    await expect(panel).toContainText('Reversed card (1):');
    await expect(panel.getByRole('listitem').filter({ hasText: /Revers/ })).toHaveCount(1);
  });
});


for (const [spreadName, analysisBuilder, labels] of [
  ['Decision / Two-Path', analyzeDecision, ['Decision Guidance']],
  ['Relationship Snapshot', analyzeRelationship, ['Shared Connection']],
  ['Celtic Cross', analyzeCelticCross, ['Advice ↔ Outcome']]
]) {
  test(`${spreadName} relationships have accurate labels and no repeated advice connection`, async ({ page }) => {
    await withInsights(page, { spreadName, analysisBuilder }, async (panel, fixture) => {
      await openSupportingSections(panel);
      for (const label of labels) await expect(panel).toContainText(label);
      if (spreadName.startsWith('Decision')) await expect(panel).not.toContainText('Story Flow');
      if (spreadName.startsWith('Relationship')) await expect(panel.getByRole('listitem').filter({ hasText: /^Pattern / })).toHaveCount(0);
      if (spreadName.startsWith('Celtic')) {
        const analysis = analysisBuilder(fixture.requests.reading[0].cardsInfo);
        const repeated = analysis.relationships.find(rel => rel.key === 'adviceVsOutcome');
        await expect(panel).not.toContainText(repeated.summary);
        const other = analysis.relationships.find(rel => rel.key === 'subconsciousVsHopesFears');
        await expect(panel).toContainText(other.summary);
      }
    });
  });
}
