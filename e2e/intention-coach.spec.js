import { test, expect } from '@playwright/test';

// These tests mock API responses; service workers can bypass page.route.
test.use({ serviceWorkers: 'block' });

const COACH_NAME = 'Shape a question with clarity';
const TOPIC_PROMPT = 'What area do you want to explore?';

const TEMPLATE = {
  id: 'template-e2e',
  label: 'Sunday check-in',
  topic: 'wellbeing',
  timeframe: 'week',
  depth: 'guided',
  customFocus: '',
  useCreative: false,
  savedQuestion: 'What does my energy need from me this week?',
  updatedAt: 1
};

// The free plan cannot select the Decision spread, so its tests sign in.
const PLUS_USER = {
  id: 'user-e2e-plus',
  email: 'plus@example.com',
  username: 'plus-reader',
  subscription_tier: 'plus',
  subscription_status: 'active',
  subscription_provider: 'stripe'
};
const STAYS_AS_WRITTEN = 'The question already in place stays as written until you Remix or change a setting.';
// Every Decision template weighs the paths; no generic template names one.
const DECISION_SHAPED = /\bpaths?\b/;

async function seedApp(page, { templates = [], recommendation = null, focusAreas = [], user = null } = {}) {
  // Storage fixtures only; no Worker is needed. Anonymous unless a user is
  // given, which stands in for a signed-in account with storage of its own.
  await page.route('**/api/auth/me', (route) => route.fulfill(user
    ? { status: 200, json: { user } }
    : { status: 401, json: { user: null } }));

  await page.addInitScript(({ seededTemplates, seededRecommendation, seededFocusAreas, ownerId }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 1,
      hasSeenRitualNudge: true,
      hasSeenGestureCoach: true,
      hasSeenJournalNudge: true,
      journalSaveCount: 0,
      hasDismissedAccountNudge: true
    }));
    const coachScope = ownerId || 'anon';
    if (seededTemplates.length > 0) {
      localStorage.setItem(`tarot_coach_templates_${coachScope}`, JSON.stringify(seededTemplates));
    }
    if (seededRecommendation) {
      localStorage.setItem(`tarot_coach_recommendation_${coachScope}`, JSON.stringify({
        ...seededRecommendation,
        updatedAt: Date.now()
      }));
    }
    if (seededFocusAreas.length > 0) {
      localStorage.setItem(`tarot-personalization:${ownerId || 'guest'}`, JSON.stringify({
        focusAreas: seededFocusAreas
      }));
    }
  }, {
    seededTemplates: templates,
    seededRecommendation: recommendation,
    seededFocusAreas: focusAreas,
    ownerId: user?.id || null
  });
}

async function gotoReading(page) {
  await page.goto('/');
  await page.waitForSelector('[role="radiogroup"][aria-label="Spread selection"]', { timeout: 15000 });
}

async function openCoachWithShortcut(page) {
  // The spread can render before passive effects register the shortcut.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.keyboard.press('Shift+G');
  const coach = page.getByRole('dialog', { name: COACH_NAME });
  await expect(coach).toBeVisible();
  return coach;
}

async function openCoachWithButton(page) {
  await page.getByRole('button', { name: /^Open guided (?:intention )?coach/ }).filter({ visible: true }).first().press('Enter');
  const coach = page.getByRole('dialog', { name: COACH_NAME });
  await expect(coach).toBeVisible();
  return coach;
}

async function selectSpread(page, name) {
  const spread = page.getByRole('radio', { name });
  // A spread outside the plan opens an upgrade prompt instead, so wait for a
  // signed-in account's plan to unlock it before choosing it.
  await expect(spread).not.toContainText('Requires Plus');
  await spread.click();
  await expect(spread).toHaveAttribute('aria-checked', 'true');
}

// The topic step's note on how the spread shapes the question.
function spreadNote(coach) {
  return coach.getByText('Shaped for your spread', { exact: true }).locator('../..');
}

function reviewQuestion(coach) {
  return coach.getByRole('textbox', { name: 'Your Question', exact: true, includeHidden: true });
}

// A review chip on the current step, read as "Type:" then its label.
function contextChip(coach, type) {
  return coach.getByRole('tabpanel').getByText(`${type}:`, { exact: true }).locator('..');
}

for (const platform of ['desktop', 'handset @mobile']) {
  test.describe(`Guided intention coach question editing — ${platform}`, () => {
    test('edited wording survives reopening and reaches the reading and recent questions', async ({ page }) => {
      await seedApp(page);
      await gotoReading(page);
      let coach = await openCoachWithButton(page);
      await coach.getByRole('tab', { name: 'Depth' }).click();
      const question = 'How can I make room for rest this week?\nWhat can I change in my daily routine?';
      const field = coach.getByRole('textbox', { name: 'Your Question', exact: true });
      await expect(field).not.toHaveValue('');
      await field.fill(question);
      await expect(field).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(coach).toHaveCount(0);
      coach = await openCoachWithButton(page);
      await expect(coach.getByRole('textbox', { name: 'Your Question', exact: true })).toHaveValue(question);
      await coach.getByRole('button', { name: 'Use question', exact: true }).click();

      await expect(coach).toHaveCount(0);
      await expect(page.locator('#quick-intention,#question-input').filter({ visible: true }).first()).toHaveValue(question);
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tarot_coach_history_anon'))?.[0]?.question))
        .toBe(question);
    });

    test('clearing the question leaves it empty until the user writes or remixes', async ({ page }) => {
      await seedApp(page);
      await gotoReading(page);
      let coach = await openCoachWithButton(page);
      await coach.getByRole('tab', { name: 'Depth' }).click();
      let field = coach.getByRole('textbox', { name: 'Your Question', exact: true });
      const useQuestion = coach.getByRole('button', { name: 'Use question', exact: true });
      await field.fill('');
      await expect(field).toHaveValue('');
      await expect(useQuestion).toBeDisabled();
      await field.fill('   ');
      await expect(useQuestion).toBeDisabled();
      await field.fill('');

      await page.keyboard.press('Escape');
      await expect(coach).toHaveCount(0);
      coach = await openCoachWithButton(page);
      field = coach.getByRole('textbox', { name: 'Your Question', exact: true });
      await expect(field).toHaveValue('');
      await expect(coach.getByRole('button', { name: 'Use question', exact: true })).toBeDisabled();

      await coach.getByRole('button', { name: 'Remix', exact: true }).click();
      await expect(field).not.toHaveValue('');
      await expect(coach.getByRole('button', { name: 'Use question', exact: true })).toBeEnabled();
    });

    test('saving a template uses the edited question and rejects an empty one', async ({ page }) => {
      await seedApp(page);
      await gotoReading(page);
      const coach = await openCoachWithButton(page);
      await coach.getByRole('tab', { name: 'Depth' }).click();
      const field = coach.getByRole('textbox', { name: 'Your Question', exact: true });
      const library = page.getByRole('dialog', { name: 'Template library' });
      await field.fill('');
      await coach.getByRole('button', { name: 'Save as template' }).click();
      await library.getByRole('textbox', { name: 'Template name' }).fill('My own wording');
      await library.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(library.getByRole('status')).toHaveText('Add or generate a question before saving.');
      await library.getByRole('button', { name: 'Close template panel' }).click();

      const question = 'What would help me feel grounded while I change roles at work?';
      await field.fill(question);
      await coach.getByRole('button', { name: 'Save as template' }).click();
      await library.getByRole('textbox', { name: 'Template name' }).fill('My own wording');
      await library.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(library.getByRole('status')).toHaveText('Template saved');
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tarot_coach_templates_anon'))?.[0]?.savedQuestion))
        .toBe(question);
    });

    test('editing during AI generation cancels the response and keeps the typed question', async ({ page }) => {
      await seedApp(page, { user: PLUS_USER });
      await page.addInitScript(() => {
        // Verify cancellation through the pending fetch's AbortSignal as well
        // as checking that the edited wording survives the delayed response.
        window.__coachQuestionRequestAborted = false;
        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, options) => {
          const url = typeof input === 'string' ? input : input.url;
          if (url.endsWith('/api/generate-question')) {
            options?.signal?.addEventListener('abort', () => {
              window.__coachQuestionRequestAborted = true;
            }, { once: true });
          }
          return originalFetch(input, options);
        };
      });
      let releaseResponse;
      let markStarted;
      const responseReady = new Promise(resolve => { releaseResponse = resolve; });
      const requestStarted = new Promise(resolve => { markStarted = resolve; });
      await page.route('**/api/generate-question', async (route) => {
        markStarted();
        await responseReady;
        await route.fulfill({ status: 200, json: {
          question: 'What late AI wording could replace my edits?',
          provider: 'workers-ai'
        } }).catch(() => {});
      });
      try {
        await gotoReading(page);
        const coach = await openCoachWithButton(page);
        await coach.getByRole('tab', { name: 'Depth' }).click();
        await coach.getByRole('checkbox', { name: 'Personalize with AI' }).check();
        await requestStarted;
        const question = 'How can I choose a pace that supports my wellbeing this month?';
        const field = coach.getByRole('textbox', { name: 'Your Question', exact: true });
        await field.fill(question);
        await expect.poll(() => page.evaluate(() => window.__coachQuestionRequestAborted)).toBe(true);
        releaseResponse();
        await expect(field).toHaveValue(question);
        await coach.getByRole('button', { name: 'Use question', exact: true }).click();
        await expect(page.locator('#quick-intention,#question-input').filter({ visible: true }).first()).toHaveValue(question);
      } finally {
        releaseResponse();
      }
    });
  });
}

test.describe('Guided intention coach responsive review @mobile', () => {
  test('enlarged text keeps the editor and footer reachable at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await seedApp(page);
    await gotoReading(page);
    const coach = await openCoachWithButton(page);
    await coach.getByRole('tab', { name: 'Depth' }).press('Enter');
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.documentElement.style.fontSize = '32px';
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    const field = coach.getByRole('textbox', { name: 'Your Question', exact: true });
    await field.scrollIntoViewIfNeeded();
    const geometry = await field.evaluate(element => {
      let scroller = element.parentElement;
      while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
        scroller = scroller.parentElement;
      }
      const fieldBox = element.getBoundingClientRect();
      const scrollBox = scroller?.getBoundingClientRect();
      const dialog = element.closest('[role="dialog"]');
      return {
        scrollHeight: scroller?.clientHeight || 0,
        scrollOverflow: scroller.scrollWidth > scroller.clientWidth,
        fieldInside: Boolean(scrollBox && fieldBox.top >= scrollBox.top - 1 && fieldBox.bottom <= scrollBox.bottom + 1),
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        dialogOverflow: dialog.scrollWidth > dialog.clientWidth
      };
    });
    expect(geometry.scrollHeight).toBeGreaterThan(100);
    expect(geometry.fieldInside).toBe(true);
    expect(geometry.documentOverflow).toBe(false);
    expect(geometry.dialogOverflow).toBe(false);
    expect(geometry.scrollOverflow).toBe(false);

    const useQuestion = coach.getByRole('button', { name: 'Use question', exact: true });
    const footerBox = await useQuestion.boundingBox();
    expect(footerBox.x).toBeGreaterThanOrEqual(0);
    expect(footerBox.x + footerBox.width).toBeLessThanOrEqual(320);
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(568);
    const question = 'How can I make room for rest this week?';
    await field.fill(question);
    await useQuestion.tap();
    await expect(coach).toHaveCount(0);
    await expect(page.locator('#quick-intention,#question-input').filter({ visible: true }).first()).toHaveValue(question);
  });

  test('review and template actions meet the 44px touch target', async ({ page }) => {
    await seedApp(page, { user: PLUS_USER, templates: [TEMPLATE] });
    await gotoReading(page);
    const coach = await openCoachWithButton(page);
    await coach.getByRole('tab', { name: 'Depth' }).press('Enter');

    const shortTargets = dialog => dialog.evaluate(element => [...element.querySelectorAll('button,input,textarea')]
      .filter(control => control.getClientRects().length && getComputedStyle(control).visibility !== 'hidden')
      .map(control => {
        const target = control.matches('input[type="checkbox"]') ? control.closest('label') : control;
        const box = target.getBoundingClientRect();
        return { name: control.getAttribute('aria-label') || target.textContent.trim(), width: box.width, height: box.height };
      }).filter(target => target.width < 43.9 || target.height < 43.9));

    expect(await shortTargets(coach)).toEqual([]);
    await coach.getByRole('button', { name: 'Templates', exact: true }).press('Enter');
    const library = page.getByRole('dialog', { name: 'Template library', exact: true });
    expect(await shortTargets(library)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(library).toHaveCount(0);
    await expect(coach).toBeVisible();
  });
});

test.describe('Guided intention coach keyboard and layers', () => {
  test('arrow keys move focus and selection across the step tabs', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);
    const coach = await openCoachWithShortcut(page);

    await coach.getByRole('tab', { name: 'Topic' }).focus();
    await page.keyboard.press('ArrowRight');
    const timeframeTab = coach.getByRole('tab', { name: 'Timeframe' });
    await expect(timeframeTab).toBeFocused();
    await expect(timeframeTab).toHaveAttribute('aria-selected', 'true');

    // A second arrow used to stall because focus never left the first tab.
    await page.keyboard.press('ArrowRight');
    await expect(coach.getByRole('tab', { name: 'Depth' })).toBeFocused();

    await page.keyboard.press('Home');
    const topicTab = coach.getByRole('tab', { name: 'Topic' });
    await expect(topicTab).toBeFocused();
    await expect(topicTab).toHaveAttribute('aria-selected', 'true');

    // Back to back, with no wait: each press acts on the tab the last one chose.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const depthTab = coach.getByRole('tab', { name: 'Depth' });
    await expect(depthTab).toBeFocused();
    await expect(depthTab).toHaveAttribute('aria-selected', 'true');
  });

  test('focus moved just after opening stays where the user put it', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);
    // Warm the deferred dialog first so this still tests the activation timer,
    // rather than trying to focus a tab before its module has arrived.
    const coach = await openCoachWithShortcut(page);
    await page.keyboard.press('Escape');
    await expect(coach).toHaveCount(0);

    // The focus trap schedules its own activation focus on a zero-delay timer.
    // Open and move focus before that timer runs, then let it run: it used to
    // pull focus back to Close, which under load could land mid-interaction.
    const focusedId = await page.evaluate(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'G', shiftKey: true, bubbles: true }));
      await Promise.resolve(); // React commits the keyboard-opened coach in a microtask
      document.getElementById('step-tab-timeframe')?.focus();
      await new Promise(resolve => setTimeout(resolve, 50));
      return document.activeElement?.id || document.activeElement?.getAttribute('aria-label');
    });
    expect(focusedId).toBe('step-tab-timeframe');
  });

  test('choice cards are a radio group: arrows move focus, Space selects', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);
    const coach = await openCoachWithShortcut(page);

    const radios = coach.getByRole('radiogroup', { name: TOPIC_PROMPT }).getByRole('radio');
    await expect(radios).toHaveCount(6);
    const checkedIndex = await radios.evaluateAll(
      elements => elements.findIndex(element => element.getAttribute('aria-checked') === 'true')
    );
    expect(checkedIndex).toBeGreaterThanOrEqual(0);
    const nextIndex = (checkedIndex + 1) % 6;

    await radios.nth(checkedIndex).focus();
    await page.keyboard.press('ArrowDown');
    await expect(radios.nth(nextIndex)).toBeFocused();
    // Moving focus alone must not change the choice (or drop a prefilled question).
    await expect(radios.nth(checkedIndex)).toHaveAttribute('aria-checked', 'true');

    await page.keyboard.press('Space');
    await expect(radios.nth(nextIndex)).toHaveAttribute('aria-checked', 'true');
    await expect(radios.nth(checkedIndex)).toHaveAttribute('aria-checked', 'false');
  });

  test('Back on the first step keeps focus and names the new step', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);
    const coach = await openCoachWithShortcut(page);

    await coach.getByRole('tab', { name: 'Timeframe' }).click();
    const back = coach.getByRole('button', { name: 'Back', exact: true });
    await back.focus();
    await page.keyboard.press('Enter');

    await expect(coach.getByRole('tab', { name: 'Topic' })).toHaveAttribute('aria-selected', 'true');
    await expect(back).toBeFocused();
    await expect(back).toHaveAttribute('aria-disabled', 'true');
    await expect(coach.getByRole('status')).toHaveText('Step 1 of 3: Topic');
  });

  test('a review chip hands focus to the choice it points at', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);
    const coach = await openCoachWithShortcut(page);

    await coach.getByRole('tab', { name: 'Depth' }).click();
    await coach.getByRole('button', { name: /^Topic:/ }).focus();
    await page.keyboard.press('Enter');

    await expect(coach.getByRole('tab', { name: 'Topic' })).toHaveAttribute('aria-selected', 'true');
    await expect(
      coach.getByRole('radiogroup', { name: TOPIC_PROMPT }).getByRole('radio', { checked: true })
    ).toBeFocused();
  });

  test('Escape closes an open tooltip before the coach', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);
    const coach = await openCoachWithShortcut(page);

    await coach.getByRole('tab', { name: 'Depth' }).click();
    await coach.getByRole('button', { name: 'About question quality' }).focus();
    await expect(page.getByRole('tooltip')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(coach).toBeVisible();
  });

  test('a tooltip left open behind the coach does not swallow its Escape', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    // Hovered, then the coach opened from the keyboard: no pointerdown hides
    // the page's tooltip, and the coach now covers it.
    await page.getByRole('button', { name: /^Ritual \(optional\)/ }).click();
    await page.getByRole('button', { name: 'About clearing the deck ritual' }).hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
    const coach = await openCoachWithShortcut(page);

    await page.keyboard.press('Escape');
    await expect(coach).toHaveCount(0);
  });

  test('the template library is a layer of its own', async ({ page }) => {
    await seedApp(page, { templates: [TEMPLATE] });
    await gotoReading(page);
    const coach = await openCoachWithShortcut(page);
    const library = page.getByRole('dialog', { name: 'Template library' });
    const templatesButton = coach.getByRole('button', { name: 'Templates', exact: true });

    await templatesButton.click();
    await expect(library.getByRole('button', { name: 'Close template panel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(library).toHaveCount(0);
    await expect(coach).toBeVisible();
    await expect(templatesButton).toBeFocused();

    await coach.getByRole('tab', { name: 'Depth' }).click();
    await coach.getByRole('button', { name: 'Save as template' }).click();
    const nameField = library.getByRole('textbox', { name: 'Template name' });
    await expect(nameField).toBeFocused();
    await nameField.fill('Evening check-in');
    await page.keyboard.press('Enter');
    await expect(library.getByRole('status')).toHaveText('Template saved');

    await library.getByRole('button', { name: `Apply template ${TEMPLATE.label}` }).click();
    await expect(library).toHaveCount(0);
    await expect(coach.getByRole('tab', { name: 'Depth' })).toHaveAttribute('aria-selected', 'true');
    await expect(reviewQuestion(coach)).toHaveValue(TEMPLATE.savedQuestion);
    await expect(coach.getByRole('status')).toContainText(`Template "${TEMPLATE.label}" applied.`);
  });

  test('closing without applying keeps the unfinished question', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);
    let coach = await openCoachWithShortcut(page);

    await coach.getByRole('radiogroup', { name: TOPIC_PROMPT })
      .getByRole('radio', { name: /^Career & Purpose/ })
      .click();
    await coach.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(coach.getByRole('tab', { name: 'Timeframe' })).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Escape');
    await expect(coach).toHaveCount(0);

    coach = await openCoachWithShortcut(page);
    await expect(coach.getByRole('tab', { name: 'Timeframe' })).toHaveAttribute('aria-selected', 'true');
    await expect(coach.getByRole('status')).toHaveText('Picked up where you left off.');
    await coach.getByRole('tab', { name: 'Topic' }).click();
    await expect(
      coach.getByRole('radiogroup', { name: TOPIC_PROMPT }).getByRole('radio', { name: /^Career & Purpose/ })
    ).toHaveAttribute('aria-checked', 'true');
  });

  test('a journal recommendation opens with its own question', async ({ page }) => {
    const question = 'What is The Hermit asking me to notice this month?';
    await seedApp(page, {
      recommendation: { question, label: 'The Hermit', source: 'card:The Hermit', topicValue: 'growth' }
    });
    await gotoReading(page);
    const coach = await openCoachWithShortcut(page);

    await coach.getByRole('tab', { name: 'Depth' }).click();
    await expect(reviewQuestion(coach)).toHaveValue(question);
  });

  test('signing in while the coach is open starts over for the new account', async ({ page }) => {
    await seedApp(page);
    // Registered after seedApp, so it wins: hold the session check until the
    // anonymous session has something in it.
    let signIn;
    const signedIn = new Promise(resolve => { signIn = resolve; });
    await page.route('**/api/auth/me', async (route) => {
      await signedIn;
      await route.fulfill({
        status: 200,
        json: { user: { id: 'user-e2e', email: 'reader@example.com', username: 'reader' } }
      });
    });
    await gotoReading(page);
    let coach = await openCoachWithShortcut(page);

    await coach.getByRole('radiogroup', { name: TOPIC_PROMPT })
      .getByRole('radio', { name: /^Career & Purpose/ })
      .click();
    await coach.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(coach.getByRole('tab', { name: 'Timeframe' })).toHaveAttribute('aria-selected', 'true');

    signIn();
    await expect(page.getByRole('button', { name: 'Sign In' })).toHaveCount(0);
    await expect(coach.getByRole('tab', { name: 'Topic' })).toHaveAttribute('aria-selected', 'true');

    // The anonymous session was not filed under the new account.
    await page.keyboard.press('Escape');
    await expect(coach).toHaveCount(0);
    coach = await openCoachWithShortcut(page);
    await expect(coach.getByRole('tab', { name: 'Topic' })).toHaveAttribute('aria-selected', 'true');
  });

  test('an untouched session is not kept as a draft', async ({ page }) => {
    const question = 'What is The Hermit asking me to notice this month?';
    await seedApp(page, {
      recommendation: { question, label: 'The Hermit', source: 'card:The Hermit', topicValue: 'growth' }
    });
    await gotoReading(page);
    let coach = await openCoachWithShortcut(page);
    await page.keyboard.press('Escape');
    await expect(coach).toHaveCount(0);

    // Dismissed elsewhere before the next open: a saved "draft" of the
    // untouched session would bring it back.
    await page.evaluate(() => localStorage.removeItem('tarot_coach_recommendation_anon'));
    coach = await openCoachWithShortcut(page);
    await coach.getByRole('tab', { name: 'Depth' }).click();
    await expect(reviewQuestion(coach)).not.toHaveValue(question);
  });

  test('the icon-only Back button keeps its name in landscape', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await seedApp(page);
    await gotoReading(page);
    const coach = await openCoachWithShortcut(page);

    await expect(coach.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  });
});

test.describe('Guided intention coach and the selected spread', () => {
  test('the Decision spread shapes the note, the question and its chips', async ({ page }) => {
    await seedApp(page, { user: PLUS_USER });
    await gotoReading(page);
    await selectSpread(page, /Decision \/ Two-Path/);
    const coach = await openCoachWithShortcut(page);

    // The note explains the spread's shape; it suggests no topic.
    const note = spreadNote(coach);
    await expect(note).toBeVisible();
    await expect(note).toContainText('Decision. Two paths are read side by side');
    await expect(note).not.toContainText(STAYS_AS_WRITTEN);
    await expect(note.getByRole('button')).toHaveCount(0);
    await expect(coach.getByText(/we suggest exploring/i)).toHaveCount(0);

    await coach.getByRole('tab', { name: 'Depth' }).click();
    await expect(reviewQuestion(coach)).toHaveValue(DECISION_SHAPED);
    await expect(contextChip(coach, 'Spread')).toHaveText(/^Spread:\s*Decision$/);
    // The spread is chosen on the page, so its chip is a label, not a button.
    await expect(coach.getByRole('button', { name: /^Spread:/ })).toHaveCount(0);
  });

  test('interests pick the topic while the spread note describes only the spread', async ({ page }) => {
    await seedApp(page, { focusAreas: ['career'] });
    await gotoReading(page);
    await selectSpread(page, /Five-Card Clarity/);
    const coach = await openCoachWithShortcut(page);

    const career = coach.getByRole('radiogroup', { name: TOPIC_PROMPT })
      .getByRole('radio', { name: /^Career & Purpose/ });
    await expect(career).toHaveAttribute('aria-checked', 'true');
    await expect(career).toContainText('Based on your interests');
    // The old box said this spread suggested Wellbeing while Career was checked.
    const note = spreadNote(coach);
    await expect(note).toContainText('Five-Card Clarity. Five cards circle the core of the matter');
    await expect(note).not.toContainText(/wellbeing|suggest/i);
  });

  test('a generated draft keeps its words after the spread changes until Remix', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);
    await selectSpread(page, /Five-Card Clarity/);
    let coach = await openCoachWithShortcut(page);
    await coach.getByRole('tab', { name: 'Depth' }).click();
    const savedQuestion = await reviewQuestion(coach).inputValue();

    await page.keyboard.press('Escape');
    await expect(coach).toHaveCount(0);
    await selectSpread(page, /Three-Card Story/);
    coach = await openCoachWithShortcut(page);

    await expect(reviewQuestion(coach)).toHaveValue(savedQuestion);
    await coach.getByRole('tab', { name: 'Topic' }).click();
    await expect(spreadNote(coach)).toContainText(STAYS_AS_WRITTEN);
    await coach.getByRole('tab', { name: 'Depth' }).click();
    await coach.getByRole('button', { name: 'Remix', exact: true }).click();
    await expect(reviewQuestion(coach)).not.toHaveValue(savedQuestion);
    await expect(contextChip(coach, 'Spread')).toHaveText(/^Spread:\s*Three-Card Story$/);
  });

  test('a restored draft generates a new question when a setting changes', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);
    await selectSpread(page, /Five-Card Clarity/);
    let coach = await openCoachWithShortcut(page);
    await coach.getByRole('tab', { name: 'Depth' }).click();
    const savedQuestion = await reviewQuestion(coach).inputValue();
    await page.keyboard.press('Escape');
    await expect(coach).toHaveCount(0);
    coach = await openCoachWithShortcut(page);
    await coach.getByRole('tab', { name: 'Topic' }).click();
    await expect(spreadNote(coach)).toContainText(STAYS_AS_WRITTEN);
    await coach.getByRole('radiogroup', { name: TOPIC_PROMPT })
      .getByRole('radio', { name: /^Career & Purpose/ }).click();
    await coach.getByRole('tab', { name: 'Depth' }).click();
    await expect(reviewQuestion(coach)).not.toHaveValue(savedQuestion);
    await expect(reviewQuestion(coach)).toHaveValue(/my career direction and purpose/);
    await expect(contextChip(coach, 'Spread')).toHaveText(/^Spread:\s*Five-Card Clarity$/);
  });

  test('an AI draft stays as written on reopen without another generation', async ({ page }) => {
    await seedApp(page, { user: PLUS_USER });
    let generations = 0;
    const savedQuestion = 'What can I offer and receive as I tend this bond this week?';
    await page.route('**/api/generate-question', (route) => {
      generations++;
      return route.fulfill({ status: 200, json: {
        question: generations === 1 ? savedQuestion : 'What new question could replace my saved intention?',
        provider: 'workers-ai'
      } });
    });
    await gotoReading(page);
    await selectSpread(page, /Relationship Snapshot/);
    let coach = await openCoachWithShortcut(page);
    await coach.getByRole('tab', { name: 'Depth' }).click();
    await coach.getByRole('checkbox', { name: 'Personalize with AI' }).check();
    await expect(reviewQuestion(coach)).toHaveValue(savedQuestion);

    await page.keyboard.press('Escape');
    await expect(coach).toHaveCount(0);
    coach = await openCoachWithShortcut(page);
    await coach.getByRole('tab', { name: 'Topic' }).click();
    await expect(spreadNote(coach)).toContainText(STAYS_AS_WRITTEN);
    await coach.getByRole('tab', { name: 'Depth' }).click();
    await expect(reviewQuestion(coach)).toHaveValue(savedQuestion);
    expect(generations).toBe(1);

    await coach.getByRole('button', { name: 'Remix', exact: true }).click();
    await expect(reviewQuestion(coach)).toHaveValue('What new question could replace my saved intention?');
    expect(generations).toBe(2);
  });

  test('a saved template keeps its words until Remix shapes a question for the spread', async ({ page }) => {
    await seedApp(page, { user: PLUS_USER, templates: [TEMPLATE] });
    await gotoReading(page);
    await selectSpread(page, /Decision \/ Two-Path/);
    const coach = await openCoachWithShortcut(page);
    const library = page.getByRole('dialog', { name: 'Template library' });

    await coach.getByRole('button', { name: 'Templates', exact: true }).click();
    await library.getByRole('button', { name: `Apply template ${TEMPLATE.label}` }).click();
    await expect(library).toHaveCount(0);
    await expect(reviewQuestion(coach)).toHaveValue(TEMPLATE.savedQuestion);
    await expect(contextChip(coach, 'Mode')).toHaveText(/^Mode:\s*Custom question$/);
    await expect(contextChip(coach, 'Spread')).toHaveCount(0);

    await coach.getByRole('tab', { name: 'Topic' }).click();
    await expect(spreadNote(coach)).toContainText(STAYS_AS_WRITTEN);
    await expect(reviewQuestion(coach)).toHaveValue(TEMPLATE.savedQuestion);

    await coach.getByRole('tab', { name: 'Depth' }).click();
    await coach.getByRole('button', { name: 'Remix', exact: true }).click();
    await expect(reviewQuestion(coach)).toHaveValue(DECISION_SHAPED);
    await expect(contextChip(coach, 'Spread')).toHaveText(/^Spread:\s*Decision$/);
  });

  test('a journal recommendation keeps its own question on a chosen spread', async ({ page }) => {
    const question = 'What is The Hermit asking me to notice this month?';
    await seedApp(page, {
      recommendation: { question, label: 'The Hermit', source: 'card:The Hermit', topicValue: 'growth' }
    });
    await gotoReading(page);
    await selectSpread(page, /Three-Card Story/);
    const coach = await openCoachWithShortcut(page);

    const note = spreadNote(coach);
    await expect(note).toContainText('Three-Card Story. Three cards read as a story');
    await expect(note).toContainText(`follow that arc. ${STAYS_AS_WRITTEN}`);

    await coach.getByRole('tab', { name: 'Depth' }).click();
    await expect(reviewQuestion(coach)).toHaveValue(question);
    await expect(contextChip(coach, 'Mode')).toHaveText(/^Mode:\s*Custom question$/);
    await expect(contextChip(coach, 'Spread')).toHaveCount(0);
  });
});

test.describe('Guided intention coach sheet gestures', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  async function touchDrag(cdp, start, distance, { secondFingerAtStep = null } = {}) {
    const steps = 12;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: start.x, y: start.y, id: 1 }]
    });
    for (let step = 1; step <= steps; step += 1) {
      const points = [{ x: start.x, y: start.y + (distance * step) / steps, id: 1 }];
      if (secondFingerAtStep !== null && step >= secondFingerAtStep) {
        points.push({ x: start.x + 80, y: start.y, id: 2 });
      }
      await cdp.send('Input.dispatchTouchEvent', {
        type: step === secondFingerAtStep ? 'touchStart' : 'touchMove',
        touchPoints: points
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  test('an interrupted swipe leaves the sheet open; a clean one closes it and keeps the draft', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Synthesized touch drags need the Chromium DevTools protocol');
    await seedApp(page);
    await gotoReading(page);

    await page.getByRole('button', { name: 'Open guided intention coach' }).first().click();
    const coach = page.getByRole('dialog', { name: COACH_NAME });
    await expect(coach).toBeVisible();
    await coach.getByRole('button', { name: 'Next', exact: true }).click();

    const cdp = await page.context().newCDPSession(page);
    const handle = await coach.locator('.mobile-drawer__handle').boundingBox();
    const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };

    // A second finger mid-drag turns the gesture into something else.
    await touchDrag(cdp, start, 220, { secondFingerAtStep: 4 });
    await page.waitForTimeout(400);
    await expect(coach).toBeVisible();
    await expect(coach).not.toHaveAttribute('style', /translateY/);

    await touchDrag(cdp, start, 220);
    await expect(coach).toHaveCount(0);

    // Reopen with the shortcut: the page's own coach buttons may sit under
    // the sticky header once scroll is restored. The swipe closes from a
    // timer, so the page re-arms the shortcut an effect flush after the sheet
    // leaves the DOM; retry the key until it takes.
    await expect(async () => {
      await page.keyboard.press('Shift+G');
      await expect(coach).toBeVisible({ timeout: 500 });
    }).toPass();
    await expect(coach.getByRole('tab', { selected: true })).toHaveAccessibleName(/2\s*Timeframe/);
  });
});

test.describe('Quick intention card @mobile', () => {
  test('control names match what is on screen', async ({ page }) => {
    await seedApp(page);
    await gotoReading(page);

    await expect(page.getByRole('button', { name: 'More reading settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change deck' })).toBeVisible();
    await expect(page.locator('#quick-intention')).toHaveAttribute('maxlength', '2000');

    await page.getByRole('button', { name: 'Open guided intention coach' }).first().click();
    const coach = page.getByRole('dialog', { name: COACH_NAME });
    await expect(coach.getByRole('tab', { selected: true })).toHaveAccessibleName(/1\s*Topic/);
  });
});
