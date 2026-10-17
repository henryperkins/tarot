import { test, expect } from '@playwright/test';
import { createAlignerFixture } from './helpers/readingAlignerFixture.mjs';
import { startReading, expectNoHorizontalOverflow, expectForeground } from './helpers/narrativeFixtures.js';

const question = '  Cafe\u0301 🌊 — what can I carry forward?\n';
const prose = 'The Star invites a patient pause. There is room to choose your next step.';
const cards = [
  { name: 'The Star', position: 'Past', userReflection: ' first star\n' },
  { name: 'The Star', position: 'Future', userReflection: ' second star ' }
];
const entry = overrides => ({ id: 'personal-context-saved', ts: Date.now(), spreadKey: 'twoCard',
  spread: 'Two cards', question, deckId: 'rws-1909', cards, personalReading: prose, ...overrides });
const opener = page => page.getByRole('button', { name: 'Your question and notes', exact: true }).filter({ visible: true }).first();
const dialog = page => page.getByRole('dialog', { name: 'Your question and notes', exact: true });
const noteTexts = page => dialog(page).locator('[data-personal-context-note]').evaluateAll(nodes => nodes.map(node => node.textContent));

async function openSaved(page, fixture) {
  await page.goto('/journal');
  const card = page.locator(`[id="journal-entry-${fixture.savedEntries[0].id}"] article`);
  await expect(card).toBeVisible();
  const outer = card.locator('button[aria-controls]:not([aria-haspopup])').first();
  if (await outer.getAttribute('aria-expanded') === 'false') { await expectForeground(outer); await outer.click(); }
  const toggle = card.getByRole('button', { name: 'Reading narrative' }).first();
  await expect(toggle).toBeVisible();
  if (await toggle.getAttribute('aria-expanded') === 'false') { await expectForeground(toggle); await toggle.click(); }
  await expect(opener(page)).toBeVisible();
  expect(fixture.annotationRequests).toEqual([]);
}

test('question-only live reading has exact context before any authored cue', async ({ page }, testInfo) => {
  const fixture = await createAlignerFixture(page, { question, narrative: prose });
  try {
    await startReading(page, fixture, { complete: false });
    await fixture.emit('reading', 'delta', { text: 'A quiet invitation without a card cue.' });
    await expect(dialog(page)).toHaveCount(0);
    if (testInfo.project.name.includes('-phone-')) {
      const inlineQuestion = page.locator('.reading-question p');
      await expect(inlineQuestion).toBeVisible();
      expect(await inlineQuestion.textContent()).toBe(question);
      await expect(page.locator('.reading-options')).toHaveCount(0);
      expect(fixture.annotationRequests).toEqual([]);
      return;
    }
    await opener(page).click();
    await expect(dialog(page)).toBeVisible();
    expect(await dialog(page).locator('[data-personal-context-question]').textContent()).toBe(question);
    expect(await noteTexts(page)).toEqual([]);
    await expect(dialog(page).getByText('No notes')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(opener(page)).toBeFocused();
    expect(fixture.annotationRequests).toEqual([]);
  } finally { await fixture.close(); }
});

test('general saved note stays separate from duplicate occurrence notes and restores statically', async ({ page }) => {
  const general = '  Whole-reading context\nwith a second line. ';
  const fixture = await createAlignerFixture(page, { tier: 'pro', initialEntries: [entry({
    reflections: { Overall: general, 0: ' first star\n', 1: ' second star ', 'Legacy label': ' legacy\t' }
  })] });
  try {
    await openSaved(page, fixture);
    await opener(page).click();
    expect(await dialog(page).locator('[data-personal-context-question]').textContent()).toBe(question);
    expect(await noteTexts(page)).toEqual([general, ' first star\n', ' second star ', ' legacy\t']);
    await expect(dialog(page).getByRole('heading', { name: 'Whole reading', exact: true })).toBeVisible();
    await expect(dialog(page).getByRole('heading', { name: 'Past · The Star', exact: true })).toBeVisible();
    await expect(dialog(page).getByRole('heading', { name: 'Future · The Star', exact: true })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Close question and notes' }).click();
    await expect(opener(page)).toBeFocused();
    await page.reload();
    await openSaved(page, fixture);
    await expect(dialog(page)).toHaveCount(0);
    await opener(page).click();
    expect(await noteTexts(page)).toEqual([general, ' first star\n', ' second star ', ' legacy\t']);
    await expect(page.locator('[data-gesture-window]')).not.toHaveAttribute('data-phase', /active|settling/);
    expect(fixture.annotationRequests).toEqual([]);
  } finally { await fixture.close(); }
});

test('general string note is never copied onto a saved card', async ({ page }) => {
  const general = '\n  My context for the whole reading.\t';
  const fixture = await createAlignerFixture(page, { tier: 'pro', initialEntries: [entry({
    cards: cards.map(({ userReflection: _note, ...card }) => card), reflections: general
  })] });
  try {
    await openSaved(page, fixture);
    await opener(page).click();
    expect(await noteTexts(page)).toEqual([general]);
    await expect(dialog(page).getByRole('heading', { name: 'Whole reading', exact: true })).toBeVisible();
    await expect(dialog(page).getByRole('heading', { name: /Past|Future/ })).toHaveCount(0);
  } finally { await fixture.close(); }
});

test('bounded long context preserves Unicode at 320px and 200 percent text with native dismissal', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const long = `\n ${'é e\u0301 🧭  '.repeat(2000)}\t\r\n`;
  const fixture = await createAlignerFixture(page, { tier: 'pro', initialEntries: [entry({ reflections: { Overall: long } })] });
  try {
    await openSaved(page, fixture);
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await opener(page).focus();
    await page.keyboard.press('Enter');
    expect(await noteTexts(page)).toEqual([long, ' first star\n', ' second star ']);
    await expectNoHorizontalOverflow(page, '.reading-personal-context__dialog');
    const scroll = dialog(page).locator('[data-personal-context-scroll]');
    const bounds = await scroll.evaluate(node => ({ height: node.clientHeight, total: node.scrollHeight }));
    expect(bounds.total).toBeGreaterThan(bounds.height);
    await scroll.focus();
    await page.keyboard.press('End');
    await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    const exposed = await dialog(page).evaluate(element => new Promise((resolve, reject) => {
      const startedAt = performance.now(); let previous = ''; let unchangedSince = startedAt;
      const sample = () => {
        const at = performance.now(); const region = element.querySelector('[data-personal-context-scroll]'); const note = [...element.querySelectorAll('[data-personal-context-note]')].at(-1);
        const dialogBox = element.getBoundingClientRect(); const regionBox = region.getBoundingClientRect();
        const clip = { left: Math.max(0, dialogBox.left, regionBox.left), top: Math.max(0, dialogBox.top, regionBox.top), right: Math.min(innerWidth, dialogBox.right, regionBox.right), bottom: Math.min(innerHeight, dialogBox.bottom, regionBox.bottom) };
        const range = document.createRange(); range.selectNodeContents(note); const fragments = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0).map(rect => {
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, foreground: Boolean(hit && note.contains(hit)), fullyWithinClip: rect.left >= clip.left && rect.right <= clip.right && rect.top >= clip.top && rect.bottom <= clip.bottom };
        });
        const geometry = { rootScroll: { x: scrollX, y: scrollY, html: document.documentElement.scrollTop, body: document.body.scrollTop },
          viewport: { width: innerWidth, height: innerHeight, offsetTop: visualViewport?.offsetTop, offsetLeft: visualViewport?.offsetLeft, scale: visualViewport?.scale },
          rootFontSize: getComputedStyle(document.documentElement).fontSize, dialog: dialogBox.toJSON(), scroll: { top: region.scrollTop, height: region.clientHeight, total: region.scrollHeight, box: regionBox.toJSON() },
          finalNote: note.textContent, clip, fragments };
        const signature = JSON.stringify(geometry); if (signature !== previous) { previous = signature; unchangedSince = at; }
        if (at - unchangedSince >= 250) return resolve({ startedAt, settledAt: at, unchangedSince, geometry });
        if (at - startedAt > 5000) return reject(new Error('Native End viewport and scroll geometry did not settle'));
        requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    }));
    await testInfo.attach('personal-context-native-End-exposure', { body: JSON.stringify({ setup: '320 by 700 CSS viewport; html font-size 200%; unchanged native focus and End', measurement: 'stable DOM geometry and actual text-fragment hit ownership before screenshot', exposed }, null, 2), contentType: 'application/json' });
    expect(exposed.geometry.dialog.top).toBeGreaterThanOrEqual(0); expect(exposed.geometry.dialog.bottom).toBeLessThanOrEqual(exposed.geometry.viewport.height);
    expect(exposed.geometry.dialog.left).toBeGreaterThanOrEqual(0); expect(exposed.geometry.dialog.right).toBeLessThanOrEqual(exposed.geometry.viewport.width);
    expect(exposed.geometry.finalNote).toBe(' second star '); expect(exposed.geometry.fragments.length).toBeGreaterThan(0);
    expect(exposed.geometry.fragments.every(fragment => fragment.foreground && fragment.fullyWithinClip)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('personal-context-320-text200.png') });
    const captured = await scroll.evaluate(node => ({ rootY: scrollY, innerTop: node.scrollTop, dialog: node.closest('[role="dialog"]').getBoundingClientRect().toJSON() }));
    expect(captured.rootY).toBe(exposed.geometry.rootScroll.y); expect(captured.innerTop).toBe(exposed.geometry.scroll.top); expect(captured.dialog).toEqual(exposed.geometry.dialog);
    await testInfo.attach('personal-context-settled-screenshot-alignment', { body: JSON.stringify({ measurement: 'screenshot after native scrolling settles', exposed, captured }, null, 2), contentType: 'application/json' });
    await page.keyboard.press('Escape');
    await expect(opener(page)).toBeFocused();
    if (testInfo.project.use.hasTouch) await opener(page).tap();
    else await opener(page).click();
    await expect(dialog(page)).toBeVisible();
    const outside = { x: 2, y: 2 };
    if (testInfo.project.use.hasTouch) await page.touchscreen.tap(outside.x, outside.y);
    else await page.mouse.click(outside.x, outside.y);
    await expect(dialog(page)).toHaveCount(0);
    await expect(opener(page)).toBeFocused();
  } finally { await fixture.close(); }
});

test('original context and explicit card inspection survive incoming prose and Escape', async ({ page }, testInfo) => {
  const fixture = await createAlignerFixture(page, { narrative: prose });
  try {
    await startReading(page, fixture, { complete: false });
    await fixture.emit('reading', 'delta', { text: 'A patient pause. ' });
    if (testInfo.project.name.includes('-phone-')) {
      const originalQuestion = await page.locator('.reading-question p').textContent();
      const card = page.locator('[data-reading-overview]').getByRole('button', { name: /Open card/ }).first();
      const selectedName = fixture.requests.reading[0].cardsInfo[0].card;
      await card.click();
      const inspection = page.getByRole('dialog').filter({ visible: true });
      await expect(inspection).toHaveCount(1);
      await expect(inspection.getByRole('heading', { level: 2 })).toContainText(selectedName);
      await fixture.emit('reading', 'delta', { text: 'The next paragraph keeps arriving during card inspection.' });
      await expect(page.locator('.narrative-stream')).toContainText('keeps arriving');
      await expect(inspection.getByRole('heading', { level: 2 })).toContainText(selectedName);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(card).toBeFocused();
      expect(await page.locator('.reading-question p').textContent()).toBe(originalQuestion);
      expect(fixture.annotationRequests).toEqual([]);
      return;
    }
    const shelf = page.locator('[data-gesture-shelf] button:not(:disabled)').first();
    await expect(shelf).toBeVisible();
    await shelf.click();
    const stage = page.locator('[data-gesture-window]');
    await expect(stage).toHaveAttribute('data-held', 'true');
    const held = await stage.getAttribute('data-association');
    await opener(page).click();
    await fixture.emit('reading', 'delta', { text: 'The next paragraph keeps arriving while you read your original context.' });
    await expect(page.locator('.narrative-stream')).toContainText('keeps arriving');
    await expect(stage).toHaveAttribute('data-association', held);
    await expect(stage).toHaveAttribute('data-held', 'true');
    await page.screenshot({ path: testInfo.outputPath('personal-context-held-streaming.png') });
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(stage).toHaveAttribute('data-association', held);
    await expect(stage).toHaveAttribute('data-held', 'true');
    await expect(opener(page)).toBeFocused();
    expect(fixture.annotationRequests).toEqual([]);
  } finally { await fixture.close(); }
});

test('source replacement refreshes prose and closes any open personal context', async ({ page }, testInfo) => {
  const fixture = await createAlignerFixture(page, { narrative: prose });
  try {
    await startReading(page, fixture, { complete: false });
    await fixture.emit('reading', 'delta', { text: 'The first source arrives.' });
    if (testInfo.project.name.includes('-phone-')) await expect(page.locator('.reading-question p')).toBeVisible();
    else await opener(page).click();
    await fixture.emit('reading', 'snapshot', { fullText: 'Replacement source arrives without borrowing prior cues.' });
    await expect(page.locator('.narrative-stream')).toContainText('Replacement source');
    await expect(dialog(page)).toHaveCount(0);
    expect(fixture.annotationRequests).toEqual([]);
  } finally { await fixture.close(); }
});

test('authentication refresh on reload mounts a fresh journal without the former owner context', async ({ page }) => {
  const fixture = await createAlignerFixture(page, { tier: 'pro', userId: 'context-owner-a',
    initialEntries: [entry({ reflections: { Overall: 'Private owner A context' } })] });
  try {
    await openSaved(page, fixture);
    await opener(page).click();
    await fixture.setTier('pro', { userId: 'context-owner-b' });
    fixture.setEntries([]);
    // Controlled account identity changes, then a real route reload rechecks auth.
    // This establishes fresh-owner mounting, not an in-place AuthContext transition.
    await page.reload();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText('Private owner A context', { exact: true })).toHaveCount(0);
    expect(fixture.annotationRequests).toEqual([]);
  } finally { await fixture.close(); }
});
