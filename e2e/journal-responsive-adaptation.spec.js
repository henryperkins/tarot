import { test, expect } from '@playwright/test';
import { createNarrativeFixture, openSetup } from './helpers/narrativeFixtures.js';

const entry = {
  id: 'responsive-reading', ts: Date.now(), spread: 'Celtic Cross', spreadKey: 'celtic',
  question: 'What should I focus on right now?',
  cards: [
    { name: 'The Fool', position: 'Present', orientation: 'Reversed' },
    { name: 'The High Priestess', position: 'Challenge', orientation: 'Upright' }
  ],
  personalReading: 'Notice what restores you and make room for reflection.'
};

async function expectReadableTitle(article) {
  const title = article.getByRole('heading', { name: 'Celtic Cross', exact: true });
  await expect(title).toBeVisible();
  const bounds = await title.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const button = element.closest('button').getBoundingClientRect();
    return {
      clippedWidth: element.scrollWidth - element.clientWidth,
      clippedHeight: element.scrollHeight - element.clientHeight,
      left: rect.left - button.left,
      right: button.right - rect.right
    };
  });
  expect(bounds.clippedWidth, 'The full title must fit horizontally').toBeLessThanOrEqual(1);
  expect(bounds.clippedHeight, 'The full title must fit vertically').toBeLessThanOrEqual(1);
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeGreaterThanOrEqual(0);
  for (const button of await article.getByRole('button', { name: /Copy summary|Open entry actions/ }).all()) {
    const box = await button.boundingBox();
    const articleBox = await article.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(articleBox.x);
    expect(box.x + box.width).toBeLessThanOrEqual(articleBox.x + articleBox.width);
  }
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Journal text adaptation — ${platform}`, () => {
    test.use({ serviceWorkers: 'block' });

    for (const width of [320, 390, 1280]) {
      test(`200% text preserves titles and entry actions at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const fixture = await createNarrativeFixture(page, { signedOut: true });
        await page.addInitScript(value => {
          localStorage.setItem('tarot-onboarding-complete', 'true');
          localStorage.setItem('tarot_journal', JSON.stringify([value]));
        }, entry);
        try {
          await page.goto('/journal');
          const article = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Celtic Cross', exact: true }) });
          await expect(article).toBeVisible();
          await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
          await page.evaluate(() => document.fonts.ready);
          await expectReadableTitle(article);
          for (const name of ['The Fool', 'The High Priestess']) {
            const chip = article.getByText(name, { exact: true });
            await expect(chip).toBeVisible();
            expect(await chip.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
          }
          const actions = article.getByRole('button', { name: 'Open entry actions', exact: true });
          await actions.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await actions.click();
          const menu = page.getByRole('menu');
          await expect(menu).toBeVisible();
          const menuBox = await menu.boundingBox();
          expect(menuBox.x).toBeGreaterThanOrEqual(0);
          expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width);
          await page.keyboard.press('Escape');
          await expect(article.getByRole('button', { name: 'Open entry actions', exact: true })).toBeFocused();

          const compact = page.getByTitle('Compact view - shows more entries', { exact: true });
          await compact.press('Enter');
          await expect(compact).toHaveAttribute('aria-pressed', 'true');
          await expectReadableTitle(article);
          const expand = article.getByRole('button', { expanded: false }).filter({ has: page.getByRole('heading', { name: 'Celtic Cross' }) });
          // Exercise keyboard activation after the layout switch, as well as pointer menu access.
          await expand.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await expand.press('Enter');
          await expect(article.getByRole('button', { expanded: true }).filter({ has: page.getByRole('heading', { name: 'Celtic Cross' }) })).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        } finally {
          await fixture.close();
        }
      });
    }
  });
}

test.describe('Spread carousel touch adaptation', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

  test('edge swipes scroll the carousel and page, then leave arrow navigation usable', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Touch synthesis uses Chromium CDP; WebKit layout has separate coverage.');
    const fixture = await createNarrativeFixture(page, { signedOut: true });
    try {
      await openSetup(page);
      const carousel = page.getByRole('radiogroup', { name: 'Spread selection' });
      await page.evaluate(() => document.fonts.ready);
      await carousel.evaluate(element => window.scrollBy(0, element.getBoundingClientRect().top - 180));
      const box = await carousel.boundingBox();
      const start = { x: box.x + box.width - 20, y: box.y + 60, id: 1 };
      const cdp = await context.newCDPSession(page);
      const swipe = async (dx, dy) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
        for (let step = 1; step <= 10; step++) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: [{ ...start, x: start.x + dx * step / 10, y: start.y + dy * step / 10 }]
          });
          await page.waitForTimeout(25);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      const selected = await carousel.getByRole('radio', { checked: true }).innerText();
      const initialPageScroll = await page.evaluate(() => scrollY);
      await swipe(-240, 0);
      await expect.poll(() => carousel.evaluate(element => element.scrollLeft)).toBeGreaterThan(100);
      expect(await page.evaluate(() => scrollY)).toBeCloseTo(initialPageScroll, 0);
      expect(await carousel.getByRole('radio', { checked: true }).innerText()).toBe(selected);

      await swipe(0, -150);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(initialPageScroll + 50);
      expect(await carousel.getByRole('radio', { checked: true }).innerText()).toBe(selected);

      await carousel.evaluate(element => {
        element.scrollTo({ left: 0, behavior: 'instant' });
        window.scrollBy(0, element.getBoundingClientRect().top - 180);
      });
      await expect.poll(() => carousel.evaluate(element => element.scrollLeft)).toBe(0);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await page.getByRole('button', { name: 'Next spread', exact: true }).tap();
      await expect.poll(() => carousel.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    } finally {
      await fixture.close();
    }
  });
});
