import { test, expect } from './helpers/frontendTest.js';

const PROMPT = 'What would you like to understand?';
const FIRST_EXAMPLE = 'What should I focus on this week to feel grounded?';
const SECOND_EXAMPLE = 'How can I navigate this relationship with clarity this month?';
const COACH_NAME = 'Shape a question with clarity';

async function seedApp(page) {
  // Anonymous storage fixtures only; no Worker or account session is needed.
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 401,
    json: { user: null }
  }));
  await page.addInitScript(() => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 1,
      hasSeenRitualNudge: true,
      hasSeenGestureCoach: true,
      hasSeenJournalNudge: true,
      journalSaveCount: 0,
      hasDismissedAccountNudge: true
    }));
  });
}

async function gotoReading(page) {
  await page.goto('/');
  await page.waitForSelector('[role="radiogroup"][aria-label="Spread selection"]', { timeout: 15000 });
}

test.describe('Question field', () => {
  test('an empty field reads as empty, and an example goes in as text', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    const field = page.getByRole('textbox', { name: PROMPT });
    await expect(field).toHaveValue('');
    // The placeholder is an instruction, not a question that looks already set.
    await expect(field).toHaveAttribute('placeholder', 'In your own words…');

    await page.getByRole('button', { name: 'Try an example' }).click();
    await expect(field).toHaveValue(FIRST_EXAMPLE);

    const another = page.getByRole('button', { name: 'Another example' });
    await another.click();
    await expect(field).toHaveValue(SECOND_EXAMPLE);

    await page.getByRole('button', { name: 'Clear example' }).click();
    await expect(field).toHaveValue('');
    // Clear leaves with the example; focus stays on the example control.
    await expect(page.getByRole('button', { name: 'Try an example' })).toBeFocused();
  });

  test('examples never replace words the person wrote', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    const field = page.getByRole('textbox', { name: PROMPT });
    await page.getByRole('button', { name: 'Try an example' }).click();
    await field.fill(`${FIRST_EXAMPLE.slice(0, -1)} at work?`);
    await expect(page.getByRole('button', { name: /example/i })).toHaveCount(0);
  });
});

test.describe('Question field hardening', () => {
  test('a yes/no question gets one ungraded nudge instead of a grade', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    const field = page.getByRole('textbox', { name: PROMPT });
    // No question mark: many people leave it off.
    await field.fill('Will I get the job at the studio');
    await expect(page.getByText(/This reads as a yes-or-no question/)).toBeVisible();
    await expect(page.getByText('Clarity check')).toHaveCount(0);
    await expect(field).toHaveAccessibleDescription(/yes-or-no question/);

    await page.getByRole('button', { name: 'Shape it with the coach' }).click();
    await expect(page.getByRole('dialog', { name: COACH_NAME })).toBeVisible();
  });

  test('an open question gets a clarity check the field describes and announces', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    const field = page.getByRole('textbox', { name: PROMPT });
    await field.fill('How can I approach the new role at work with more confidence this month?');
    await expect(page.getByText('Clarity check', { exact: true })).toBeVisible();
    await expect(field).toHaveAccessibleDescription(/Clarity check/);
    // Spoken once typing pauses.
    await expect(page.getByRole('status').filter({ hasText: 'Clarity check: Excellent.' })).toHaveCount(1);
  });

  test('Enter that confirms an IME composition keeps the field focused', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    const field = page.getByRole('textbox', { name: PROMPT });
    await field.focus();
    await field.evaluate((element) => {
      element.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 229, isComposing: true, bubbles: true, cancelable: true
      }));
    });
    await expect(field).toBeFocused();

    await field.press('Enter');
    await expect(field).not.toBeFocused();
  });

  test('a typed question survives a reload in the same tab', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    const question = 'What is asking for my attention in my friendships?';
    await page.getByRole('textbox', { name: PROMPT }).fill(question);
    await page.reload();
    await page.waitForSelector('[role="radiogroup"][aria-label="Spread selection"]', { timeout: 15000 });
    await expect(page.getByRole('textbox', { name: PROMPT })).toHaveValue(question);
  });

  test('a storage error keeps the question and allows saving again', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);
    const question = 'How can I make room for rest this month?';
    const field = page.getByRole('textbox', { name: PROMPT });
    await field.fill(question);
    await page.evaluate(() => {
      const setItem = Storage.prototype.setItem;
      window.restoreCoachStorage = () => { Storage.prototype.setItem = setItem; };
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('tarot_coach_history')) throw new DOMException('Storage is full', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
    });
    await page.clock.install();

    const save = page.getByRole('button', { name: 'Save intention', exact: true });
    await save.click();
    const error = page.getByText('We could not update your coach data. Please check storage settings and try again.', { exact: true });
    await expect(error).toBeVisible();
    await expect(page.getByText('Saved to intentions', { exact: true })).toHaveCount(0);
    await page.clock.fastForward(2500);
    await expect(error).toBeVisible();
    await expect(field).toHaveValue(question);

    await page.evaluate(() => window.restoreCoachStorage());
    await save.click();
    await expect(page.getByText('Saved to intentions', { exact: true })).toBeVisible();
  });

  test('a question advances progress with the default spread, including after reload', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    const progress = page.getByRole('navigation', { name: 'Tarot reading progress' });
    const selectedSpread = page.getByRole('radiogroup', { name: 'Spread selection' }).getByRole('radio', { checked: true });
    const spreadName = await selectedSpread.textContent();
    await expect(progress.getByRole('button')).toHaveCount(4);
    await expect(progress.getByRole('button', { name: 'Step 1: Spread', exact: true })).toHaveAttribute('aria-current', 'step');

    await page.getByRole('textbox', { name: PROMPT }).fill('What can I learn from this change at work?');
    await expect(progress.getByRole('button', { name: 'Step 2: Question', exact: true })).toHaveAttribute('aria-current', 'step');
    await expect(page.getByText('Your intention is ready', { exact: true })).toBeVisible();
    await expect(selectedSpread).toHaveText(spreadName);

    await page.reload();
    await expect(progress.getByRole('button', { name: 'Step 2: Question', exact: true })).toHaveAttribute('aria-current', 'step');
    await expect(selectedSpread).toHaveText(spreadName);
  });
});

test.describe('Question card @mobile', () => {
  test('an example goes in as text and can be cleared', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    const field = page.getByRole('textbox', { name: PROMPT });
    await expect(field).toHaveAttribute('placeholder', 'In your own words…');
    await expect(field).toHaveAccessibleDescription('Optional. How and what questions work best.');

    await page.getByRole('button', { name: 'Try an example' }).click();
    await expect(field).toHaveValue(FIRST_EXAMPLE);
    await expect(page.getByText('Next: tap Draw cards below')).toBeVisible();

    await page.getByRole('button', { name: 'Clear example' }).click();
    await expect(field).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Try an example' })).toBeVisible();
  });
});

test.describe('Question card hardening @mobile', () => {
  test('the draw action keeps its name while preparation progresses', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    const actions = page.getByRole('navigation', { name: 'Primary mobile actions' });
    const draw = actions.getByRole('button', { name: /^Draw cards/ });
    await expect(draw).toHaveText('Draw cards');
    await expect(draw).toHaveAccessibleName('Draw cards');

    await page.getByRole('textbox', { name: PROMPT }).fill('How can I make space for rest this week?');
    await expect(draw).toHaveText('Draw cards');
    await expect(draw).toHaveAccessibleName('Draw cards');
    await expect(page.getByRole('navigation', { name: 'Tarot reading progress' }).getByRole('button')).toHaveCount(4);

    await page.getByRole('button', { name: 'More reading settings' }).click();
    const drawer = page.getByRole('dialog', { name: 'Prepare your reading' });
    const drawerDraw = drawer.getByRole('button', { name: /^Draw cards/ });
    await expect(drawerDraw).toHaveText('Draw cards');
    await expect(drawerDraw).toHaveAccessibleName('Draw cards');
    await drawerDraw.click();
    await expect(page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first()).toBeVisible();
  });

  test('the card nudges a yes/no question and saves the question', async ({ page }) => {
    const start = Date.now();
    await page.clock.install({ time: start });
    await seedApp(page);
    await gotoReading(page);

    const field = page.getByRole('textbox', { name: PROMPT });
    await field.fill('Will I get the job?');
    await expect(page.getByText(/This reads as a yes-or-no question/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shape it with the coach' })).toBeVisible();

    await field.fill('How can I prepare for the interview this week?');
    await expect(page.getByText(/This reads as a yes-or-no question/)).toHaveCount(0);
    // Observe the brief confirmation without a busy browser expiring it
    // between the click and the assertion.
    await page.clock.pauseAt(start + 60000);
    await page.getByRole('button', { name: 'Save intention' }).click();
    await expect(page.getByText('Saved to intentions')).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tarot_coach_history_anon'))?.[0]?.question))
      .toBe('How can I prepare for the interview this week?');
  });

  test('More opens deck and ritual settings, not a second question field', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    await page.getByRole('button', { name: 'More reading settings' }).click();
    const drawer = page.getByRole('dialog', { name: 'Prepare your reading' });
    await expect(drawer).toBeVisible();
    const tabs = drawer.getByRole('tablist', { name: 'Preparation settings' }).getByRole('tab');
    await expect(tabs).toHaveText(['Deck', 'Ritual']);
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await expect(drawer.getByRole('textbox', { name: PROMPT })).toHaveCount(0);
  });

  test('the Question step brings the card into view instead of a drawer', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    await page.getByRole('button', { name: 'Step 2: Question' }).click();
    await expect(page.locator('#quick-intention')).toBeInViewport();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the question prompt stays below the sticky header on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await seedApp(page);
    await page.addInitScript(() => localStorage.setItem('tarot-theme', 'light'));
    await gotoReading(page);
    await page.evaluate(() => document.fonts.ready);

    const field = page.getByRole('textbox', { name: PROMPT });
    await page.getByRole('button', { name: 'Step 2: Question', exact: true }).click();
    await field.fill('What can I learn from this change at work?');
    await expect(page.locator('.header-sticky')).toHaveClass(/header-sticky--compact/);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const promptOffset = () => page.evaluate(() => {
      const prompt = document.querySelector('label[for="quick-intention"]').getBoundingClientRect();
      const header = document.querySelector('.header-sticky').getBoundingClientRect();
      return prompt.top - header.bottom;
    });
    await expect.poll(promptOffset).toBeGreaterThanOrEqual(0);
    await field.focus();
    await expect.poll(promptOffset).toBeGreaterThanOrEqual(0);
  });

  test('a typed question survives a reload', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    await page.getByRole('textbox', { name: PROMPT }).fill('What do I need to hear this week?');
    await page.reload();
    await page.waitForSelector('[role="radiogroup"][aria-label="Spread selection"]', { timeout: 15000 });
    await expect(page.getByRole('textbox', { name: PROMPT })).toHaveValue('What do I need to hear this week?');
  });

  test('in landscape the compact bar edits the question in place', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await seedApp(page);
    await gotoReading(page);

    await page.getByRole('button', { name: 'Add a question' }).click();
    const field = page.getByRole('textbox', { name: PROMPT });
    await expect(field).toBeFocused();
    await field.fill('What is asking for my attention in my friendships?');
    await field.press('Enter');

    await expect(page.getByText('What is asking for my attention in my friendships?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit your question' })).toBeFocused();
  });
});
