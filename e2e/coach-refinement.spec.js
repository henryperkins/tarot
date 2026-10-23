import { test, expect } from './helpers/frontendTest.js';

const COACH_NAME = 'Shape a question with clarity';
const CAREER = 'Will I ever stop doubting myself in my career?';
const SISTER = 'What can help me speak more openly with my sister this week?';
const DATED = 'Will my interview on November 4 help me find a role that fits my career?';
const PRO_USER = {
  id: 'coach-refinement-pro', email: 'coach-refinement@example.com', username: 'coach-refinement',
  subscription_tier: 'pro', subscription_status: 'active', subscription_provider: 'stripe'
};
const SAVED = {
  id: 'coach-refinement-template', label: 'A difficult conversation', topic: 'relationships',
  timeframe: 'week', depth: 'guided', customFocus: '', useCreative: false,
  savedQuestion: SISTER, updatedAt: 100
};

function readingField(page) {
  return page.locator('#quick-intention,#question-input').filter({ visible: true }).first();
}

function questionField(coach) {
  return coach.getByRole('textbox', { name: 'Your Question', exact: true });
}

async function setup(page, { user = null, templates = [], history = [], focusAreas = [] } = {}) {
  // External API and auth are controlled; the actual app, storage, editor and
  // focus/scroll behavior remain real. Every unclaimed API request is blocked.
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'No live API in coach acceptance tests' } }));
  await page.route('**/api/auth/me', route => route.fulfill(user
    ? { status: 200, json: { user } }
    : { status: 401, json: { user: null } }));
  await page.route('**/api/health/**', route => route.fulfill({ json: { ok: true } }));
  await page.addInitScript(({ owner, templates: savedTemplates, history: savedHistory, focusAreas: savedAreas }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({ readingCount: 1, hasSeenRitualNudge: true,
      hasSeenGestureCoach: true, hasSeenJournalNudge: true, journalSaveCount: 0, hasDismissedAccountNudge: true }));
    localStorage.setItem(`tarot_coach_templates_${owner || 'anon'}`, JSON.stringify(savedTemplates));
    localStorage.setItem(`tarot_coach_history_${owner || 'anon'}`, JSON.stringify(savedHistory));
    if (savedAreas.length) localStorage.setItem(`tarot-personalization:${owner || 'guest'}`, JSON.stringify({ focusAreas: savedAreas }));
  }, { owner: user?.id, templates, history, focusAreas });
  await page.goto('/');
  await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
}

async function openCoach(page, initialQuestion = '') {
  if (initialQuestion) {
    await readingField(page).fill(initialQuestion);
    const contextual = page.getByRole('button', { name: 'Shape it with the coach', exact: true }).filter({ visible: true }).first();
    await expect(contextual).toBeVisible();
    await contextual.click();
  } else {
    await page.getByRole('button', { name: /^Open guided (?:intention )?coach/ }).filter({ visible: true }).first().click();
  }
  const coach = page.getByRole('dialog', { name: COACH_NAME, exact: true });
  await expect(coach).toBeVisible();
  return coach;
}

async function expectReview(coach) {
  await expect(coach.getByRole('heading', { name: 'Review your question', exact: true })).toBeVisible();
  await expect(coach.getByRole('tab', { name: 'Review', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(questionField(coach)).toBeVisible();
  await expect(questionField(coach)).toBeInViewport();
}

test.describe('Coach refinement acceptance', () => {
  test('contextual career entry opens review with the reader wording and original recoverable after Start fresh', async ({ page }) => {
    await setup(page, { focusAreas: ['love'] });
    const coach = await openCoach(page, CAREER);
    await expectReview(coach);
    const editor = questionField(coach);
    await expect(editor).toHaveValue(CAREER);
    await editor.fill('What can help me understand and work with self-doubt in my career?');
    await coach.getByRole('button', { name: 'Restore original question', exact: true }).click();
    await expect(editor).toHaveValue(CAREER);
    await coach.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await expect(coach.getByRole('tab', { name: 'Topic', exact: true })).toHaveAttribute('aria-selected', 'true');
    await coach.getByRole('button', { name: 'Restore original question', exact: true }).click();
    await expectReview(coach);
    await expect(editor).toHaveValue(CAREER);
  });

  test('contextual entry retains the subject and stated interview date verbatim', async ({ page }) => {
    await setup(page);
    const coach = await openCoach(page, DATED);
    await expectReview(coach);
    await expect(questionField(coach)).toHaveValue(DATED);
  });

  test('empty entry reaches a separate review before it offers applying the question', async ({ page }) => {
    await setup(page);
    const coach = await openCoach(page);
    await expect(coach.getByRole('tab', { name: 'Topic', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(coach.getByRole('button', { name: 'Use this question', exact: true })).toHaveCount(0);
    await coach.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(coach.getByRole('tab', { name: 'Timeframe', exact: true })).toHaveAttribute('aria-selected', 'true');
    await coach.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(coach.getByRole('tab', { name: 'Depth', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(coach.getByRole('button', { name: 'Use this question', exact: true })).toHaveCount(0);
    await coach.getByRole('button', { name: 'Review question', exact: true }).click();
    await expectReview(coach);
    await expect(coach.getByRole('button', { name: 'Use this question', exact: true })).toBeEnabled();
  });

  test('settings and detail preserve sister wording until explicit generation and prior wording can be restored', async ({ page }) => {
    await setup(page, { user: PRO_USER });
    let refinementInput;
    await page.route('**/api/generate-question', route => {
      refinementInput = route.request().postDataJSON().metadata?.questionText;
      return route.fulfill({ json: {
        question: 'How can I create space to speak honestly with my sister this week?',
        provider: 'workers-ai', model: 'synthetic', forecast: null
      } });
    });
    const coach = await openCoach(page, CAREER);
    await expectReview(coach);
    const editor = questionField(coach);
    await editor.fill(SISTER);
    await coach.getByRole('tab', { name: 'Timeframe', exact: true }).click();
    await coach.getByRole('radio', { name: /^Next 30 days/ }).click();
    await coach.getByRole('tab', { name: 'Depth', exact: true }).click();
    await coach.getByRole('textbox', { name: 'Add a detail (optional)', exact: true }).fill('an honest conversation');
    await coach.getByRole('button', { name: 'Review question', exact: true }).click();
    await expect(editor).toHaveValue(SISTER);
    await coach.getByRole('checkbox', { name: 'Personalize with AI', exact: true }).check();
    await expect(editor).toHaveValue(SISTER);
    await coach.getByRole('button', { name: 'Generate new wording', exact: true }).click();
    await expect(editor).toHaveValue('How can I create space to speak honestly with my sister this week?');
    expect(refinementInput).toBe(SISTER);
    await coach.getByRole('button', { name: 'Restore my wording', exact: true }).click();
    await expect(editor).toHaveValue(SISTER);
    await coach.getByRole('button', { name: 'Restore original question', exact: true }).click();
    await expect(editor).toHaveValue(CAREER);
  });

  test('applying uses the exact editor contents including line breaks', async ({ page }) => {
    await setup(page);
    const coach = await openCoach(page, CAREER);
    await expectReview(coach);
    const edited = 'What can help me speak openly with my sister?\nWhat support can I ask for?';
    await questionField(coach).fill(edited);
    await coach.getByRole('button', { name: 'Use this question', exact: true }).click();
    await expect(coach).toHaveCount(0);
    await expect(readingField(page)).toHaveValue(edited);
  });

  test('guaranteed outcomes get gentle framing and Spanish receives no automated assessment', async ({ page }) => {
    await setup(page);
    const coach = await openCoach(page, CAREER);
    await expectReview(coach);
    const editor = questionField(coach);
    await editor.fill('How can I guarantee that my partner comes back to me this week?');
    await expect(coach.getByText('Question framing', { exact: true })).toBeVisible();
    await expect(coach.getByText(/asks for a guaranteed outcome/i)).toBeVisible();
    await expect(coach.getByText(/^(Excellent|Good|Fair|Poor|Question quality)$/)).toHaveCount(0);
    await expect(coach.getByRole('button', { name: 'Use this question', exact: true })).toBeEnabled();
    await editor.fill('¿Cómo puedo cuidar mi relación con mi pareja esta semana?');
    await expect(coach.getByText('Question framing', { exact: true })).toHaveCount(0);
    await expect(coach.getByText(/name (?:a person|the situation)|guaranteed outcome/i)).toHaveCount(0);
    await expect(coach.getByRole('button', { name: 'Use this question', exact: true })).toBeEnabled();
  });
});

test.describe('Coach saved wording and recovery', () => {
  test('a template opens review with the exact saved question', async ({ page }) => {
    await setup(page, { templates: [SAVED] });
    const coach = await openCoach(page);
    await coach.getByRole('button', { name: 'Templates', exact: true }).click();
    const library = page.getByRole('dialog', { name: 'Template library', exact: true });
    await library.getByRole('button', { name: `Apply template ${SAVED.label}`, exact: true }).click();
    await expect(library).toHaveCount(0);
    await expectReview(coach);
    await expect(questionField(coach)).toHaveValue(SISTER);
    await expect(questionField(coach)).toBeFocused();
  });

  test('a recent question opens review with its exact wording', async ({ page }) => {
    const recent = 'What can I understand about the conflict with my brother on Friday?';
    await setup(page, { history: [{ id: 'recent-refinement', question: recent, createdAt: 100 }] });
    const coach = await openCoach(page);
    await coach.getByRole('button', { name: 'Templates', exact: true }).click();
    const library = page.getByRole('dialog', { name: 'Template library', exact: true });
    await library.getByRole('button', { name: recent, exact: true }).click();
    await expect(library).toHaveCount(0);
    await expectReview(coach);
    await expect(questionField(coach)).toHaveValue(recent);
  });

  test('a suggestion opens review with the exact question shown in its preview', async ({ page }) => {
    await setup(page, { focusAreas: ['career', 'love', 'healing'] });
    const coach = await openCoach(page);
    const suggestions = coach.locator('section').filter({ has: page.getByText('Suggested for you', { exact: true }) });
    const show = suggestions.getByRole('button', { name: 'Show', exact: true });
    if (await show.count()) await show.click();
    const card = suggestions.getByRole('button', { name: 'Love & relationships', exact: true });
    const preview = await card.evaluate(element => {
      const ids = element.getAttribute('aria-describedby').split(/\s+/);
      return document.getElementById(ids.at(-1)).textContent.trim();
    });
    expect(preview).toMatch(/\?$/);
    await card.click();
    await expectReview(coach);
    await expect(questionField(coach)).toHaveValue(preview);
    await expect(questionField(coach)).toBeFocused();
  });

  test('the ninth template identifies the replaced entry and Undo restores the library', async ({ page }) => {
    const templates = Array.from({ length: 8 }, (_, index) => ({
      ...SAVED, id: `template-${index + 1}`, label: `Saved concern ${index + 1}`,
      savedQuestion: `What can I learn from situation ${index + 1}?`, updatedAt: 8 - index
    }));
    await setup(page, { templates });
    const coach = await openCoach(page, CAREER);
    await expectReview(coach);
    await coach.getByRole('button', { name: 'Save as template', exact: true }).click();
    const library = page.getByRole('dialog', { name: 'Template library', exact: true });
    await library.getByRole('textbox', { name: 'Template name', exact: true }).fill('Career clarity');
    await library.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(library.getByRole('status')).toContainText(/replaced/i);
    await expect(library.getByRole('status')).toContainText('Saved concern 8');
    await expect(library.getByRole('status')).not.toContainText(/archived/i);
    await expect(library.getByRole('button', { name: 'Apply template Career clarity', exact: true })).toBeVisible();
    await expect(library.getByRole('button', { name: 'Apply template Saved concern 8', exact: true })).toHaveCount(0);
    await library.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(library.getByRole('button', { name: 'Apply template Career clarity', exact: true })).toHaveCount(0);
    await expect(library.getByRole('button', { name: 'Apply template Saved concern 8', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tarot_coach_templates_anon'))))
      .toEqual(templates);
  });
});

test.describe('Coach asynchronous refinement', () => {
  test('settings cancel pending refinement without replacing the displayed concern', async ({ page }) => {
    await setup(page, { user: PRO_USER });
    let release;
    let started;
    const pending = new Promise(resolve => { release = resolve; });
    const requested = new Promise(resolve => { started = resolve; });
    await page.route('**/api/generate-question', async route => {
      started();
      await pending;
      await route.fulfill({ json: { question: 'A late response must never replace this concern?', provider: 'workers-ai' } }).catch(() => {});
    });
    try {
      const coach = await openCoach(page, CAREER);
      await coach.getByRole('checkbox', { name: 'Personalize with AI', exact: true }).check();
      await coach.getByRole('button', { name: 'Generate new wording', exact: true }).click();
      await requested;
      await coach.getByRole('tab', { name: 'Timeframe', exact: true }).click();
      await coach.getByRole('radio', { name: /^Next 30 days/ }).click();
      release();
      await coach.getByRole('tab', { name: 'Review', exact: true }).click();
      await expect(questionField(coach)).toHaveValue(CAREER);
      await expect(coach.getByRole('button', { name: 'Use this question', exact: true })).toBeEnabled();
    } finally {
      release();
    }
  });

  test('wizard AI refinement always sends the visible question, including repeated generation and Start fresh', async ({ page }) => {
    await setup(page, { user: PRO_USER });
    const inputs = [];
    const generated = 'What can help me speak more openly with my sister this week?';
    await page.route('**/api/generate-question', route => {
      inputs.push(route.request().postDataJSON().metadata.questionText);
      return route.fulfill({ json: { question: generated, provider: 'workers-ai', forecast: null } });
    });
    const coach = await openCoach(page);
    await coach.getByRole('tab', { name: 'Review', exact: true }).click();
    const first = await questionField(coach).inputValue();
    await coach.getByRole('checkbox', { name: 'Personalize with AI', exact: true }).check();
    await coach.getByRole('button', { name: 'Generate new wording', exact: true }).click();
    await expect(questionField(coach)).toHaveValue(generated);
    expect(inputs[0]).toBe(first);
    await coach.getByRole('button', { name: 'Generate new wording', exact: true }).click();
    await expect.poll(() => inputs.length).toBe(2);
    expect(inputs[1]).toBe(generated);
    await expect(coach.getByRole('button', { name: 'Use this question', exact: true })).toBeEnabled();
    await coach.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await coach.getByRole('tab', { name: 'Review', exact: true }).click();
    const fresh = await questionField(coach).inputValue();
    await coach.getByRole('checkbox', { name: 'Personalize with AI', exact: true }).check();
    await coach.getByRole('button', { name: 'Generate new wording', exact: true }).click();
    await expect.poll(() => inputs.length).toBe(3);
    expect(inputs[2]).toBe(fresh);
  });

  test('malformed API question uses an editable fallback and the coach stays open', async ({ page }) => {
    await setup(page, { user: PRO_USER });
    await page.route('**/api/generate-question', route => route.fulfill({ json: {
      question: { invalid: 'An object is not a question' }, provider: 'workers-ai', model: 'synthetic', forecast: null
    } }));
    const coach = await openCoach(page, CAREER);
    await expectReview(coach);
    await coach.getByRole('checkbox', { name: 'Personalize with AI', exact: true }).check();
    const response = page.waitForResponse('**/api/generate-question');
    await coach.getByRole('button', { name: 'Generate new wording', exact: true }).click();
    await response;
    await expect(coach.getByRole('button', { name: 'Use this question', exact: true })).toBeEnabled();
    await expect(questionField(coach)).not.toHaveValue('');
    await expect(page.getByText('Unable to open question coach', { exact: true })).toHaveCount(0);
    await questionField(coach).fill(SISTER);
    await coach.getByRole('button', { name: 'Use this question', exact: true }).click();
    await expect(readingField(page)).toHaveValue(SISTER);
  });

  test('late AI output does not overwrite edits made while refinement is pending', async ({ page }) => {
    await setup(page, { user: PRO_USER });
    let releaseResponse;
    let markRequest;
    const responseReady = new Promise(resolve => { releaseResponse = resolve; });
    const requestStarted = new Promise(resolve => { markRequest = resolve; });
    await page.route('**/api/generate-question', async route => {
      markRequest();
      await responseReady;
      await route.fulfill({ json: {
        question: 'What can help me understand and work with self-doubt in my career?',
        provider: 'workers-ai', model: 'synthetic', forecast: null
      } }).catch(() => {});
    });
    try {
      const coach = await openCoach(page, CAREER);
      await expectReview(coach);
      await coach.getByRole('checkbox', { name: 'Personalize with AI', exact: true }).check();
      await coach.getByRole('button', { name: 'Generate new wording', exact: true }).click();
      await requestStarted;
      await questionField(coach).fill(SISTER);
      releaseResponse();
      await expect(coach.getByRole('button', { name: 'Use this question', exact: true })).toBeEnabled();
      await expect(questionField(coach)).toHaveValue(SISTER);
      await coach.getByRole('button', { name: 'Use this question', exact: true }).click();
      await expect(readingField(page)).toHaveValue(SISTER);
    } finally {
      releaseResponse();
    }
  });
});

test('compact enlarged text leaves a readable editor and moves the oversized footer into scrolling content', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await setup(page);
  const coach = await openCoach(page, CAREER);
  await expectReview(coach);
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.style.fontSize = '32px';
  });
  const editor = questionField(coach);
  await editor.scrollIntoViewIfNeeded();
  expect(await editor.evaluate(element => element.clientWidth)).toBeGreaterThanOrEqual(220);
  await editor.fill(SISTER);
  await expect(editor).toHaveValue(SISTER);
  await expect.poll(() => editor.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  const apply = coach.getByRole('button', { name: 'Use this question', exact: true });
  // A footer that consumes too much space must share the content's scroller;
  // merely changing position: fixed would still leave a docked flex footer.
  await expect.poll(() => editor.evaluate(element => {
    const dialog = element.closest('[role="dialog"]');
    const applyButton = [...dialog.querySelectorAll('button')].find(button => button.textContent.trim() === 'Use this question');
    let scrollParent = element.parentElement;
    while (scrollParent && scrollParent !== dialog && !/auto|scroll/.test(getComputedStyle(scrollParent).overflowY)) {
      scrollParent = scrollParent.parentElement;
    }
    return Boolean(scrollParent && scrollParent !== dialog && scrollParent.contains(applyButton));
  })).toBe(true);
  await apply.scrollIntoViewIfNeeded();
  await expect(apply).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await apply.click();
  await expect(readingField(page)).toHaveValue(SISTER);
});
