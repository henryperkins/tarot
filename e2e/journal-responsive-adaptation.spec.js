import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, startReading, QUESTION, NARRATIVE } from './helpers/narrativeFixtures.js';

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

async function measureJournalHeading(page, heading) {
  const text = await heading.evaluate(element => {
    const style = getComputedStyle(element);
    const probe = document.createElement('span');
    probe.style.cssText = 'display: none; color: var(--text-main);';
    element.append(probe);
    const expectedColor = getComputedStyle(probe).color;
    probe.remove();
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    const body = element.closest('[id]').getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    return {
      tag: element.tagName, text: element.textContent.trim(), color: style.color, expectedColor, opacity,
      contained: [...range.getClientRects()].every(rect => rect.left >= body.left - 1 && rect.right <= body.right + 1)
    };
  });
  // Sample the actual painted gradient/halo surface, without the text pixels.
  // Canvas decodes the screenshot in both engines; no image-library dependency.
  const originalStyle = await heading.getAttribute('style');
  let surface;
  try {
    await heading.evaluate(element => {
      element.style.setProperty('color', 'transparent', 'important');
      element.style.setProperty('text-shadow', 'none', 'important');
    });
    surface = await heading.screenshot({ animations: 'disabled', scale: 'css' });
  } finally {
    await heading.evaluate((element, original) => {
      if (original === null) element.removeAttribute('style');
      else element.setAttribute('style', original);
    }, originalStyle);
  }
  const backgrounds = await page.evaluate(async data => {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = `data:image/png;base64,${data}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return [0.1, 0.5, 0.9].map(position => [...context.getImageData(
      Math.min(image.width - 1, Math.floor(image.width * position)),
      Math.min(image.height - 1, Math.floor(image.height * position)), 1, 1
    ).data].slice(0, 3));
  }, surface.toString('base64'));
  const rgba = text.color.match(/[\d.]+/g).map(Number);
  const alpha = (rgba[3] ?? 1) * text.opacity;
  const luminance = rgb => rgb.map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const ratios = backgrounds.map(background => {
    const foreground = background.map((channel, index) => rgba[index] * alpha + channel * (1 - alpha));
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  });
  return { ...text, backgrounds, minimumContrast: Math.min(...ratios) };
}

test.describe('Journal saved Markdown themes', () => {
  test.use({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block', contextOptions: { reducedMotion: 'reduce' } });
  test.setTimeout(60000);

  for (const theme of ['light', 'dark']) {
    test(`saved Markdown headings and expanded question follow the ${theme} theme`, async ({ page }, testInfo) => {
      await page.addInitScript(value => {
        localStorage.setItem('tarot-theme', value);
        localStorage.removeItem('tarot_journal');
      }, theme);
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await startReading(page, fixture);
        const save = page.getByRole('button', { name: /^Save reading|^Save to Journal$/ }).filter({ visible: true }).first();
        await save.press('Enter');
        await expect(page.getByText('Saved to your journal.', { exact: true })).toBeVisible();
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_journal') || '[]'));
        expect(saved).toHaveLength(1);
        expect(saved[0].question).toBe(QUESTION);
        expect(saved[0].personalReading).toBe(NARRATIVE);

        await page.getByRole('button', { name: /^View (entry|Journal)$/i }).filter({ visible: true }).first().press('Enter');
        await expect(page).toHaveURL(/\/journal(?:\?|$)/);
        const title = page.getByRole('heading', { name: saved[0].spread, exact: true });
        const article = page.getByRole('article').filter({ has: title });
        await expect(article).toHaveCount(1);
        const expand = article.getByRole('button').filter({ has: title });
        await expand.focus();
        if (await expand.getAttribute('aria-expanded') === 'false') await expand.press('Enter');
        await expect(expand).toHaveAttribute('aria-expanded', 'true');
        await expect(expand).toBeFocused();
        await expect(article.getByText(`“${QUESTION}”`, { exact: true })).toBeVisible();

        const narrative = article.getByRole('button', { name: 'Reading narrative', exact: true });
        if (await narrative.getAttribute('aria-expanded') === 'false') await narrative.press('Enter');
        await expect(narrative).toHaveAttribute('aria-expanded', 'true');
        await expect(article.getByText('Choose a task that is small enough to finish without borrowing from tomorrow.', { exact: true })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await article.evaluate(async element => {
          await Promise.allSettled(element.getAnimations({ subtree: true }).map(animation => animation.finished));
        });

        const body = article.locator(`[id="${await narrative.getAttribute('aria-controls')}"]`);
        const headings = body.getByRole('heading');
        await expect(headings).toHaveCount(9);
        const measurements = [];
        for (const heading of await headings.all()) {
          await heading.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
          const measured = await measureJournalHeading(page, heading);
          measurements.push(measured);
          expect(measured.color, `${measured.tag} ${measured.text} should use the ${theme} text color`).toBe(measured.expectedColor);
          expect(measured.minimumContrast, `${measured.tag} ${measured.text} on its painted surface`).toBeGreaterThanOrEqual(4.5);
          expect(measured.contained, `${measured.tag} ${measured.text} should remain inside the narrative`).toBe(true);
        }
        expect([...new Set(measurements.map(heading => heading.tag))]).toEqual(['H2', 'H3', 'H4', 'H5', 'H6']);
        await testInfo.attach(`journal-heading-colors-${theme}`, { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
        await headings.first().screenshot({ path: testInfo.outputPath(`journal-heading-${theme}.png`), animations: 'disabled' });
      } finally {
        await fixture.close();
      }
    });
  }
});

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
