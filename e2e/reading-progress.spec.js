import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './helpers/frontendTest.js';
import { prepareNavigation, settleNavigation, expectCanvasProgressGeometry } from './helpers/navigationFixtures.js';

// The reading progress is a thread of four steps: lit as far as the reading has
// reached, with the candlelight and a short live note on the step in view. A
// skipped ritual keeps a Skipped note, and its step opens a note in the canvas.
test.use({ serviceWorkers: 'block' });

const QUESTION = 'How can I make space for rest this week?';
const progress = page => page.getByRole('navigation', { name: 'Tarot reading progress', exact: true });
const step = (page, number) => progress(page).locator('.step-progress-canvas__item').nth(number - 1);
const stepButton = (page, number) => step(page, number).getByRole('button');
const ritualNote = page => page.locator('#ritual-skipped-note');
const thread = page => progress(page).locator('.step-progress-canvas__item')
  .evaluateAll(items => items.map(item => item.dataset.thread));
const ritualPreference = page => page.evaluate(() => JSON.parse(localStorage.getItem('tarot-personalization:guest') || '{}').showRitualSteps);

async function openSetup(page, options = {}) {
  await prepareNavigation(page, { rituals: true, ...options });
  await page.goto('/');
  await settleNavigation(page);
  await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible({ timeout: 15000 });
}

async function draw(page) {
  await page.getByRole('button', { name: 'Draw cards', exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole('button', { name: 'Deal spread', exact: true }).filter({ visible: true }).first()).toBeVisible();
}

async function deal(page) {
  await page.getByRole('button', { name: 'Deal spread', exact: true }).filter({ visible: true }).first().click();
  await expect(step(page, 4)).toHaveAttribute('data-step-state', 'current');
}

for (const layout of ['desktop', 'mobile']) {
  test.describe(`Reading navigation @${layout}`, () => {
    test.use({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 800 } });

    test('setup navigation marks the step in view and both reading shortcuts focus Draw', async ({ page }) => {
      await openSetup(page);
      const question = page.locator(layout === 'mobile' ? '#quick-intention' : '#question-input');
      await stepButton(page, 2).click();
      await expect(stepButton(page, 2)).toHaveAttribute('aria-current', 'step');
      await expect(stepButton(page, 2)).toHaveAccessibleDescription('Optional');
      await question.fill(QUESTION);
      await stepButton(page, 1).click();
      await expect(stepButton(page, 1)).toHaveAttribute('aria-current', 'step');
      await expect(page.locator('#step-spread')).toBeFocused();
      await question.focus();
      await expect(stepButton(page, 2)).toHaveAccessibleDescription('Ready');
      const drawButton = page.getByRole('button', { name: 'Draw cards', exact: true });
      await stepButton(page, 4).click();
      await expect(drawButton).toBeFocused();
      await expect(drawButton).toBeInViewport({ ratio: 1 });
      const skip = page.getByRole('link', { name: 'Skip to reading', exact: true });
      await skip.focus();
      await page.keyboard.press('Enter');
      await expect(drawButton).toBeFocused();
      await expect(drawButton).toBeInViewport({ ratio: 1 });
      await page.keyboard.press('Enter');
      await expect(stepButton(page, 3)).toHaveAttribute('aria-current', 'step');
    });

    test('Deck opens the chooser in place and returns focus to its opener', async ({ page }) => {
      await openSetup(page);
      const openers = [page.getByRole('button', { name: 'Choose deck', exact: true })];
      if (layout === 'mobile') openers.push(page.getByRole('button', { name: 'Change deck', exact: true }));
      for (const opener of openers) {
        await opener.click();
        const dialog = page.getByRole('dialog', { name: 'Choose your deck' });
        await expect(dialog.getByRole('radiogroup', { name: 'Choose your deck style' })).toBeVisible();
        await dialog.getByRole('radio', { name: /Thoth/ }).click();
        await dialog.getByRole('button', { name: 'Done', exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
        await expect(opener).toBeInViewport();
        await expect(page).toHaveURL(/\/$/);
      }
      if (layout === 'mobile') {
        const actions = page.locator('[data-app-bottom-actions]');
        await expect(actions.getByRole('button')).toHaveCount(1);
        await expect(actions.getByRole('button', { name: 'Draw cards', exact: true })).toBeVisible();
        await openers[0].click();
        const chooser = page.getByRole('dialog', { name: 'Choose your deck' });
        await chooser.getByRole('button', { name: 'Draw cards', exact: true }).click();
        await expect(chooser).toBeHidden();
        await expect(page.getByRole('button', { name: 'Knock on the deck, 1 of 3' })).toBeVisible();
        await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('#step-reading')))).toBe(true);
      }
    });

    test('a skipped ritual discloses its options and can be performed on the drawn deck', async ({ page }) => {
      await openSetup(page, { rituals: false });
      await draw(page);
      const ritual = stepButton(page, 3);
      const disclosure = step(page, 3).locator('.step-progress-canvas__note--skipped');
      await expect(disclosure).toHaveCSS('text-decoration-line', 'underline');
      await disclosure.scrollIntoViewIfNeeded();
      const box = await disclosure.boundingBox();
      const point = [box.x + box.width / 2, box.y + box.height / 2];
      if (layout === 'mobile') await page.touchscreen.tap(...point);
      else await page.mouse.click(...point);
      await expect(ritualNote(page)).toBeFocused();
      await ritual.click();
      await expect(ritualNote(page)).toHaveCount(0);
      await expect(ritual).toBeFocused();
      await ritual.click();
      await ritualNote(page).getByRole('button', { name: 'Bring the ritual back', exact: true }).click();
      await expect(ritual).toBeFocused();
      await expect(ritual).toHaveAttribute('aria-current', 'step');
      for (const number of [1, 2, 3]) {
        await page.getByRole('button', { name: `Knock on the deck, ${number} of 3`, exact: true }).click();
      }
      await expect(ritual).toHaveAccessibleName(/completed$/);
      await deal(page);
      await expect(ritual).toHaveAccessibleName(/completed$/);
    });

    for (const theme of ['dark', 'light']) {
      test(`the thread and open ritual note pass axe in ${theme}`, async ({ page }) => {
        await openSetup(page, { rituals: false, theme });
        await draw(page);
        await page.getByRole('button', { name: 'Deal spread', exact: true }).filter({ visible: true }).first().click();
        await expect(step(page, 4)).toHaveAttribute('data-step-state', 'current');
        await stepButton(page, 3).click();
        await ritualNote(page).getByRole('button', { name: 'Learn about the ritual', exact: true }).click();
        await expect(ritualNote(page)).toContainText('a reading without it is just as complete');
        const results = await new AxeBuilder({ page }).include('.canvas-progress').analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
}

test.describe('The reading thread @desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the thread is lit as far as the reading has reached, and the step in view carries a live note', async ({ page }) => {
    await openSetup(page);
    // Setup: the spread in view says how many cards it draws; nothing lies ahead yet.
    await expect(stepButton(page, 1)).toHaveAccessibleName('Step 1: Spread');
    await expect(stepButton(page, 1)).toHaveAccessibleDescription(/^\d+ cards?$/);
    expect(await thread(page)).toEqual(['lit', 'unlit', 'unlit', 'unlit']);
    await expect(progress(page).locator('.step-progress-canvas__note')).toHaveCount(1);

    await page.locator('#question-input').fill(QUESTION);
    await expect(stepButton(page, 1)).toHaveAccessibleName('Step 1: Spread, completed');
    await expect(stepButton(page, 1)).toHaveAccessibleDescription('');
    await expect(stepButton(page, 2)).toHaveAccessibleName('Step 2: Intent (question)');
    await expect(stepButton(page, 2)).toHaveAccessibleDescription('Ready');
    expect(await thread(page)).toEqual(['lit', 'lit', 'unlit', 'unlit']);

    await draw(page);
    await expect(stepButton(page, 3)).toHaveAccessibleName('Step 3: Ritual (optional)');
    await expect(stepButton(page, 3)).toHaveAccessibleDescription('Optional');
    await expect(stepButton(page, 3)).not.toHaveAttribute('aria-expanded', /.*/);
    expect(await thread(page)).toEqual(['lit', 'lit', 'lit', 'unlit']);

    await deal(page);
    // Skipped is part of the step's name; its visible note is not read twice.
    await expect(stepButton(page, 3)).toHaveAccessibleName('Step 3: Ritual (optional), skipped');
    await expect(stepButton(page, 3)).toHaveAccessibleDescription('');
    await expect(step(page, 3).locator('.step-progress-canvas__note')).toHaveText('Skipped');
    await expect(step(page, 3).locator('.step-progress-canvas__note')).toHaveAttribute('aria-hidden', 'true');
    await expect(stepButton(page, 4)).toHaveAccessibleName('Step 4: Reading');
    await expect(stepButton(page, 4)).toHaveAccessibleDescription(/^0 of \d+ revealed$/);
    expect(await thread(page)).toEqual(['lit', 'lit', 'lit', 'lit']);

    await page.getByRole('button', { name: /^Reveal next:/ }).filter({ visible: true }).first().click();
    await expect(stepButton(page, 4)).toHaveAccessibleDescription(/^1 of \d+ revealed$/);

    // Revisiting a step moves the light and its note; the way back stays lit.
    await stepButton(page, 1).click();
    await expect(step(page, 1)).toHaveAttribute('data-step-state', 'current');
    await expect(stepButton(page, 1)).toHaveAccessibleDescription(/^\d+ cards?$/);
    await expect(stepButton(page, 4)).toHaveAccessibleDescription('');
    expect(await thread(page)).toEqual(['lit', 'lit', 'lit', 'lit']);
    await stepButton(page, 4).click();
    await expect(step(page, 4)).toHaveAttribute('data-step-state', 'current');
  });

  test('every step keeps one height and one marker slot through its states', async ({ page }) => {
    await openSetup(page);
    const shape = () => progress(page).locator('.step-progress-canvas__item').evaluateAll(items => items.map(item => ({
      height: Math.round(item.getBoundingClientRect().height),
      marker: Math.round(item.querySelector('.step-progress-canvas__marker').getBoundingClientRect().width),
      labelLeft: Math.round(item.querySelector('.step-progress-canvas__label > span:last-child').getBoundingClientRect().left
        - item.getBoundingClientRect().left)
    })));
    const atSetup = await shape();
    expect(new Set(atSetup.map(item => item.height)).size).toBe(1);
    expect(new Set(atSetup.map(item => item.marker)).size).toBe(1);
    await page.locator('#question-input').fill(QUESTION);
    await draw(page);
    await deal(page);
    // Numeral, check and dot share a slot: no label moved within its step.
    expect(await shape()).toEqual(atSetup);
    await expectCanvasProgressGeometry(page);
  });

  test('a completed step draws its check and the light settles, only with motion allowed', async ({ page }) => {
    await openSetup(page);
    const fresh = () => progress(page).locator('.step-progress-canvas__item')
      .evaluateAll(items => items.map(item => item.dataset.fresh ?? null));
    // The suite's default motion profile is reduced: nothing is marked to play.
    await page.locator('#question-input').fill('How');
    await expect(step(page, 2)).toHaveAttribute('data-step-state', 'current');
    expect(await fresh()).toEqual([null, null, null, null]);
    expect(await step(page, 1).locator('.step-progress-canvas__check path')
      .evaluate(path => getComputedStyle(path).animationName)).toBe('none');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // The steps change as the cards are drawn, before the shuffle has finished.
    await page.getByRole('button', { name: 'Draw cards', exact: true }).filter({ visible: true }).first().click();
    await expect(step(page, 2)).toHaveAttribute('data-fresh', 'completed');
    await expect(step(page, 3)).toHaveAttribute('data-fresh', 'current');
    expect(await step(page, 2).locator('.step-progress-canvas__check path')
      .evaluate(path => getComputedStyle(path).animationName)).toBe('step-check-draw');
    expect(await step(page, 3).evaluate(item => getComputedStyle(item, '::after').animationName)).toBe('step-candle-settle');
    // The feedback is a moment, not a loop: it clears and the step rests.
    await expect(step(page, 2)).not.toHaveAttribute('data-fresh', /.*/);
    await expect(step(page, 3)).not.toHaveAttribute('data-fresh', /.*/);
    expect(await step(page, 3).evaluate(item => getComputedStyle(item, '::after').animationName)).toBe('none');
  });
});

test.describe('A skipped ritual has somewhere to go @desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('dealing without the ritual: its step opens a note, and closing it returns to the step', async ({ page }) => {
    await openSetup(page);
    await draw(page);
    await deal(page);
    const ritual = stepButton(page, 3);
    await expect(ritual).toHaveAttribute('aria-expanded', 'false');
    await ritual.click();
    const note = ritualNote(page);
    await expect(note).toBeFocused();
    await expect(note).toHaveAccessibleName('Ritual skipped for this reading');
    await expect(note).toHaveAccessibleDescription('Your reading continues as usual. The ritual will be waiting at the table next time, before you deal.');
    await expect(ritual).toHaveAttribute('aria-expanded', 'true');
    await expect(ritual).toHaveAttribute('aria-controls', 'ritual-skipped-note');
    // Ritual steps are already on: there is nothing to switch, so no such action.
    await expect(note.getByRole('button', { name: 'Use ritual next time' })).toHaveCount(0);
    await expect(note.getByRole('alert')).toHaveCount(0);

    const learn = note.getByRole('button', { name: 'Learn about the ritual', exact: true });
    await expect(learn).toHaveAttribute('aria-expanded', 'false');
    await learn.click();
    await expect(learn).toHaveAttribute('aria-expanded', 'true');
    await expect(note).toContainText('knock three times on the deck and cut it where it feels right');

    // The reading is untouched, and the step is the way back out.
    await expect(page.getByRole('button', { name: /^Reveal next:/ }).filter({ visible: true }).first()).toBeEnabled();
    await note.getByRole('button', { name: 'Close ritual note', exact: true }).click();
    await expect(note).toHaveCount(0);
    await expect(ritual).toBeFocused();
    await expect(ritual).toHaveAttribute('aria-expanded', 'false');

    // The step toggles its note, Escape closes it, and another step puts it away.
    await ritual.click();
    await expect(note).toBeVisible();
    await ritual.click();
    await expect(note).toHaveCount(0);
    await ritual.click();
    await page.keyboard.press('Escape');
    await expect(note).toHaveCount(0);
    await expect(ritual).toBeFocused();
    await ritual.click();
    await stepButton(page, 4).click();
    await expect(note).toHaveCount(0);
  });

  test('hidden ritual steps can be brought back before Deal, for the reading on the table', async ({ page }) => {
    await openSetup(page, { rituals: false });
    const ritual = stepButton(page, 3);
    await expect(ritual).toHaveAccessibleName('Step 3: Ritual (optional), skipped');
    await ritual.click();
    const note = ritualNote(page);
    await expect(note).toHaveAccessibleName('Ritual steps are hidden');
    await note.getByRole('button', { name: 'Bring the ritual back', exact: true }).click();
    await expect(note).toHaveCount(0);
    await expect(ritual).toBeFocused();
    await expect(ritual).toHaveAccessibleName('Step 3: Ritual (optional)');
    await expect(step(page, 3)).toHaveAttribute('data-step-state', 'upcoming');
    await expect(ritual).not.toHaveAttribute('aria-expanded', /.*/);
    await expect.poll(() => ritualPreference(page)).toBe(true);

    await draw(page);
    await expect(step(page, 3)).toHaveAttribute('data-step-state', 'current');
    await expect(page.getByRole('button', { name: /^Knock on the deck/ })).toBeVisible();
  });

  test('after Deal, hidden ritual steps can be turned on for next time without touching this reading', async ({ page }) => {
    await openSetup(page, { rituals: false });
    await draw(page);
    await deal(page);
    const ritual = stepButton(page, 3);
    await ritual.click();
    const note = ritualNote(page);
    await expect(note).toHaveAccessibleName('Ritual skipped for this reading');
    await expect(note).toContainText('Ritual steps are hidden, so the deck went straight to Deal.');
    await note.getByRole('button', { name: 'Use ritual next time', exact: true }).click();
    await expect(note.getByRole('status')).toHaveText('Ritual steps are back on.');
    await expect(note).toBeFocused();
    await expect(note.getByRole('button', { name: 'Use ritual next time' })).toHaveCount(0);
    await expect(note).toContainText('The ritual will be waiting at the table next time, before you deal.');
    await expect.poll(() => ritualPreference(page)).toBe(true);
    // This reading keeps its skipped ritual and its cards.
    await expect(ritual).toHaveAccessibleName('Step 3: Ritual (optional), skipped');
    await expect(page.getByRole('button', { name: /^Reveal next:/ }).filter({ visible: true }).first()).toBeEnabled();
  });
});

test.describe('The reading thread on a phone @mobile', () => {
  for (const width of [320, 390]) {
    test(`four steps share one row with their notes at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await openSetup(page);
      await draw(page);
      await page.locator('[data-app-bottom-actions]').getByRole('button', { name: 'Deal spread', exact: true }).click();
      await expect(step(page, 4)).toHaveAttribute('data-step-state', 'current');
      await expect(step(page, 3).locator('.step-progress-canvas__note')).toHaveText('Skipped');
      // Narrow phones show the count; the description keeps the full wording.
      await expect(stepButton(page, 4)).toHaveAccessibleDescription(/^0 of \d+ revealed$/);
      const geometry = await expectCanvasProgressGeometry(page);
      const steps = geometry.slice(0, 4).map(target => target.box);
      expect(Math.min(...steps.map(box => box.bottom)) - Math.max(...steps.map(box => box.top)), 'one row').toBeGreaterThan(0);
      expect(new Set(steps.map(box => Math.round(box.height))).size, 'one height').toBe(1);

      await stepButton(page, 3).click();
      const note = ritualNote(page);
      await expect(note).toBeFocused();
      await expect(note).toBeInViewport({ ratio: 1 });
      for (const control of await note.getByRole('button').all()) {
        const box = await control.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});
