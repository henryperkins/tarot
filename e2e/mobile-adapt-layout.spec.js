import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, startReading } from './helpers/narrativeFixtures.js';

const LONG_QUESTION = ('I keep saying yes to everything at work because I am afraid of disappointing people, '
  + 'and then I come home too tired to be present with my partner or to do the slow creative things that used to restore me. ').repeat(3).trim();

async function drawWithQuestion(page, question) {
  await openSetup(page);
  await page.locator('#quick-intention').filter({ visible: true }).first().fill(question);
  await page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first().click();
}

// Words split across lines inside one element (e.g. "Pentacle" / "s").
async function splitWords(locator) {
  return locator.evaluateAll(elements => elements.flatMap(element => {
    const split = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const match of node.data.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const lines = new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top)));
        if (lines.size > 1) split.push(match[0]);
      }
    }
    return split;
  }));
}

async function expectClampedQuestion(scope) {
  const toggle = scope.getByRole('button', { name: 'Show full question', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const question = scope.locator(`[id="${await toggle.getAttribute('aria-controls')}"]`);
  // Clamping is visual only: assistive technology keeps the whole question.
  await expect(question).toHaveText(LONG_QUESTION);
  const clamped = await question.evaluate(element => element.getBoundingClientRect().height);
  await toggle.click();
  const less = scope.getByRole('button', { name: 'Show less', exact: true });
  await expect(less).toHaveAttribute('aria-expanded', 'true');
  const expanded = await question.evaluate(element => element.getBoundingClientRect().height);
  expect(expanded).toBeGreaterThan(clamped * 1.5);
  await less.click();
  await expect(scope.getByRole('button', { name: 'Show full question', exact: true })).toBeVisible();
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Phone reading layout — ${platform}`, () => {
    test.use({ serviceWorkers: 'block' });

    test('three-card readings keep one ordered row on 360–430px phones and wrap evenly below', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const fixture = await createNarrativeFixture(page);
      try {
        await startReading(page, fixture);
        await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeVisible();
        const cards = page.locator('[data-reading-overview] .reading-card');
        const measure = () => cards.evaluateAll(elements => elements.map(card => {
          const bounds = card.getBoundingClientRect();
          const row = card.parentElement.getBoundingClientRect();
          return {
            top: Math.round(bounds.top),
            width: Math.round(bounds.width),
            offCentre: Math.abs(bounds.left + bounds.width / 2 - (row.left + row.width / 2))
          };
        }));
        for (const width of [360, 390, 430]) {
          await page.setViewportSize({ width, height: 844 });
          const tops = (await measure()).map(card => card.top);
          expect(tops, `${width}px`).toHaveLength(3);
          expect(new Set(tops).size, `${width}px keeps Past, Present and Future in one row`).toBe(1);
        }
        await page.setViewportSize({ width: 320, height: 844 });
        const wrapped = await measure();
        expect(new Set(wrapped.map(card => card.top)).size, '320px wraps to two rows').toBe(2);
        expect(new Set(wrapped.map(card => card.width)).size, 'the wrapped card matches the pair above it').toBe(1);
        expect(wrapped[2].offCentre, 'the wrapped card sits centred').toBeLessThanOrEqual(1);
      } finally {
        await fixture.close();
      }
    });

    test('a long question shows four lines and offers the rest on the table, preparation and reading', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const fixture = await createNarrativeFixture(page, { question: LONG_QUESTION });
      try {
        await drawWithQuestion(page, LONG_QUESTION);
        await expectClampedQuestion(page.locator('.reading-table'));
        await page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first().click();
        await page.getByRole('button', { name: /^Reveal all cards/ }).filter({ visible: true }).first().click();
        await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().press('Enter');
        await expectClampedQuestion(page.locator('.reading-screen--preparing'));
        await fixture.completeReading();
        await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeVisible();
        await expectClampedQuestion(page.locator('.reading-question'));
      } finally {
        await fixture.close();
      }
    });

    test('a short question has no expand control', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const fixture = await createNarrativeFixture(page);
      try {
        await drawWithQuestion(page, 'How can I rest more?');
        await expect(page.locator('.reading-table').getByText('How can I rest more?', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Show full question', exact: true })).toHaveCount(0);
      } finally {
        await fixture.close();
      }
    });

    for (const [height, pinned] of [[664, 'false'], [844, 'true']]) {
      test(`the preparation status ${pinned === 'true' ? 'stays pinned' : 'returns to the page'} at 390×${height}`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height });
        const fixture = await createNarrativeFixture(page);
        try {
          await startReading(page, fixture, { complete: false });
          const panel = page.locator('.reading-preparation__waiting');
          await expect(panel).toHaveAttribute('data-chrome-pinned', pinned);
          await expect(panel).toHaveCSS('position', pinned === 'true' ? 'sticky' : 'relative');
          await expect(panel.getByRole('button', { name: 'Cancel generation', exact: true })).toBeVisible();
        } finally {
          await fixture.close();
        }
      });
    }

    test('preparation card names keep whole words at 320px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 740 });
      const fixture = await createNarrativeFixture(page);
      try {
        await startReading(page, fixture, { complete: false });
        await expect(page.locator('.reading-preparation__draw .reading-card__name')).toHaveCount(3);
        await page.evaluate(() => document.fonts.ready);
        expect(await splitWords(page.locator('.reading-preparation__draw .reading-card__name'))).toEqual([]);
      } finally {
        await fixture.close();
      }
    });

    test.describe('touch landscape', () => {
      // Compact landscape applies to touch-first phones, not short desktop windows.
      test.use({ hasTouch: true, isMobile: true });

      test('short landscape offers a jump to Draw cards; portrait keeps it pinned instead', async ({ page }) => {
        await page.setViewportSize({ width: 750, height: 340 });
        await openSetup(page);
        const jump = page.getByRole('button', { name: 'Go to Draw cards', exact: true });
        await expect(jump).toBeInViewport();
        await jump.click();
        const draw = page.locator('[data-app-bottom-actions] [data-chrome-action="draw"]');
        await expect(draw).toBeFocused();
        await expect(draw).toBeInViewport();
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(jump).toBeHidden();
      });
    });

    test('phones introduce spreads with the step line alone; wide screens keep the panel heading', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openSetup(page);
      const panelHeading = page.locator('.spread-selector-panel').getByText('Spread Selection', { exact: true });
      await expect(panelHeading).toHaveCount(0);
      await expect(page.getByText('Pick a spread', { exact: true })).toBeVisible();
      // Taller than the handset query's 960px, so touch devices leave handset layout too.
      await page.setViewportSize({ width: 1280, height: 1000 });
      await expect(panelHeading).toBeVisible();
    });

    test('spread details wrap instead of clipping at 200% zoom', async ({ page }) => {
      await page.setViewportSize({ width: 195, height: 422 });
      await openSetup(page);
      await page.evaluate(() => document.fonts.ready);
      const clipped = await page.locator('.spread-card').evaluateAll(cards =>
        cards.filter(card => card.scrollWidth > card.clientWidth + 1).map(card => card.getAttribute('aria-label') || card.innerText.split('\n')[0]));
      expect(clipped).toEqual([]);
    });
  });
}
