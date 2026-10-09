import { test, expect } from './helpers/frontendTest.js';
import AxeBuilder from '@axe-core/playwright';

const entries = [
  {
    id: 'reflection', spread: 'Three-Card Story', spreadKey: 'threeCard',
    question: 'What deserves my attention?', ts: Date.now(),
    cards: [
      { name: 'Queen of Cups', position: 'Past', orientation: 'Upright' },
      { name: 'Temperance', position: 'Present', orientation: 'Upright' },
      { name: 'The Star', position: 'Future', orientation: 'Upright' }
    ]
  },
  {
    id: 'next-step', spread: 'Single Card', spreadKey: 'single',
    question: 'What is one next step?', ts: Date.now(),
    cards: [{ name: 'The Fool', position: 'Next step', orientation: 'Upright' }]
  }
];

const note = { id: 'shared-note', authorName: 'A friend', body: 'A gentle reflection.', createdAt: Date.now() };

async function prepare(page, theme = 'dark') {
  await page.addInitScript(theme => {
    localStorage.setItem('tarot-theme', theme);
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 2, hasSeenRitualNudge: true, hasSeenGestureCoach: true,
      hasSeenJournalNudge: true, hasDismissedAccountNudge: true, journalSaveCount: 1
    }));
  }, theme);
  await page.route(/https:\/\/[^/]*sentry\.io\//, route => route.fulfill({ json: {} }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ status: 401, json: { user: null } });
    if (path.startsWith('/api/share/')) return route.fulfill({ json: {
      title: 'Shared reflections', entries, notes: [note], meta: { entryCount: 2 }
    } });
    return route.fulfill({ json: { success: true, entries: [], notes: [note], items: [] } });
  });
}

async function showNotes(page, width) {
  if (width < 1024) await page.getByRole('tab', { name: /^Notes/ }).click();
}

async function showSpread(page, width) {
  if (width < 1024) await page.getByRole('tab', { name: 'Spread', exact: true }).click();
}

test.use({ serviceWorkers: 'block' });

for (const width of [390, 1280]) {
  test.describe(`${width}px state transitions`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('auth mode changes preserve email, clear local errors, and mask passwords', async ({ page }) => {
      await prepare(page);
      await page.goto('/');
      const signIn = page.getByRole('button', { name: 'Sign In', exact: true }).filter({ visible: true }).first();
      await signIn.click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Email', { exact: true }).fill('reader@example.test');
      await dialog.getByLabel('Password', { exact: true }).fill('Reflection123');
      await dialog.getByRole('button', { name: 'Show password', exact: true }).click();
      await expect(dialog.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
      await dialog.getByRole('button', { name: "Don't have an account? Register" }).click();
      await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue('reader@example.test');
      await expect(dialog.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
      await expect(dialog.getByLabel('Confirm Password', { exact: true })).toHaveAttribute('type', 'password');
      await dialog.getByLabel('Username', { exact: true }).fill('reader');
      await dialog.getByLabel('Password', { exact: true }).fill('Reflection123');
      await dialog.getByLabel('Confirm Password', { exact: true }).fill('Different123');
      await dialog.getByRole('button', { name: 'Create Account', exact: true }).click();
      await expect(dialog.getByRole('alert')).toContainText('Passwords do not match');
      await dialog.getByRole('button', { name: 'Already have an account? Sign in' }).click();
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Forgot password?' }).click();
      await expect(dialog.getByRole('heading', { name: 'Reset Access' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Send Reset Link' }).click();
      await expect(dialog.getByText('If this email is registered, you will receive a reset link shortly.')).toBeVisible();
      await expect(dialog.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
      await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue('reader@example.test');
      await expect(dialog.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
      await dialog.getByRole('button', { name: "Don't have an account? Register" }).click();
      await dialog.getByRole('button', { name: 'Close dialog' }).click();
      await signIn.click();
      await expect(dialog.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
      await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue('reader@example.test');
    });

    test('auth sessions clear feedback and passwords while preserving only the email draft', async ({ page }) => {
      await prepare(page);
      let user = null;
      let release;
      let hold = false;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('**/api/auth/me', route => route.fulfill({ status: user ? 200 : 401, json: { user } }));
      await page.route('**/api/auth/logout', route => { user = null; return route.fulfill({ json: { success: true } }); });
      await page.route('**/api/auth/login', async route => {
        if (hold) await gate;
        return route.fulfill({ status: user ? 200 : 401, json: user ? { user } : { error: 'Fixture sign-in failed' } });
      });
      try {
        await page.goto('/');
        const opener = page.getByRole('button', { name: 'Sign In', exact: true }).filter({ visible: true }).first();
        await opener.click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Email', { exact: true }).fill('reader@example.test');
        await dialog.getByLabel('Password', { exact: true }).fill('Reflection123');
        await dialog.getByRole('button', { name: 'Sign In', exact: true }).click();
        await expect(dialog.getByRole('alert')).toContainText('Fixture sign-in failed');
        await dialog.getByRole('button', { name: 'Close dialog' }).click();
        await opener.click();
        await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue('reader@example.test');
        await expect(dialog.getByLabel('Password', { exact: true })).toHaveValue('');
        await expect(dialog.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
        await expect(dialog.getByRole('alert')).toHaveCount(0);
        hold = true;
        await dialog.getByLabel('Password', { exact: true }).fill('Reflection123');
        await dialog.getByRole('button', { name: 'Sign In', exact: true }).click();
        await dialog.getByRole('button', { name: 'Close dialog' }).click();
        await opener.click();
        release();
        await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue('reader@example.test');
        await expect(dialog.getByRole('alert')).toHaveCount(0);
        hold = false;
        user = { id: 'auth-draft-reader', username: 'reader', email: 'reader@example.test' };
        await dialog.getByLabel('Password', { exact: true }).fill('Reflection123');
        await dialog.getByRole('button', { name: 'Sign In', exact: true }).click();
        await expect(dialog).toBeHidden();
        await page.getByRole('button', { name: 'User menu for reader', exact: true }).filter({ visible: true }).first().click();
        await page.getByRole('menuitem', { name: 'Sign Out', exact: true }).click();
        await opener.click();
        await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue('');
      } finally { release(); }
    });

    test('Journal, Account and Pricing auth callers retain their local email fallback', async ({ page }) => {
      await prepare(page);
      await page.addInitScript(entries => localStorage.setItem('tarot_journal', JSON.stringify(entries)), entries);
      for (const [path, label] of [['/journal', 'Sign in to sync'], ['/account', 'Sign in'], ['/pricing', 'Restore purchases']]) {
        await page.goto(path);
        const opener = page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).first();
        await opener.click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Email', { exact: true }).fill('fallback@example.test');
        await dialog.getByLabel('Password', { exact: true }).fill('Reflection123');
        await dialog.getByRole('button', { name: 'Close dialog' }).click();
        await expect(opener).toBeFocused();
        await opener.click();
        await expect(dialog.getByLabel('Email', { exact: true })).toHaveValue('fallback@example.test');
        await expect(dialog.getByLabel('Password', { exact: true })).toHaveValue('');
        await expect(dialog.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
        await dialog.getByRole('button', { name: 'Close dialog' }).click();
      }
    });

    test('shared card selection and notes stay synchronized through entry changes and refresh', async ({ page }) => {
      await prepare(page);
      await page.goto('/share/state-transitions');
      const card = page.getByRole('button', { name: /Future: The Star/ }).filter({ visible: true });
      await card.click();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Three-Card Story', exact: true }).click();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await showNotes(page, width);
      const position = page.getByLabel('Card position to comment on').filter({ visible: true });
      await expect(position).toHaveValue('Future');
      await position.selectOption('');
      await showSpread(page, width);
      await expect(card).toHaveAttribute('aria-pressed', 'false');
      await page.getByRole('button', { name: 'Single Card', exact: true }).click();
      await expect(page.getByRole('button', { name: /Next step: The Fool/ }).filter({ visible: true })).toHaveAttribute('aria-pressed', 'true');
      await showNotes(page, width);
      await expect(position).toHaveValue('Next step');
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('**/api/share/state-transitions', async route => {
        await gate;
        await route.fulfill({ json: { title: 'Refreshed reading', entries, notes: [note] } });
      });
      try {
        await page.getByRole('button', { name: 'Refresh reading', exact: true }).click();
        await expect(page.getByText('Opening sacred space…')).toBeVisible();
        release();
        await expect(page.getByRole('heading', { name: 'Refreshed reading' })).toBeVisible();
        await showNotes(page, width);
        await expect(position).toHaveValue('Past');
      } finally {
        release();
      }
    });

    test('a failed note keeps the draft and announces one error before a successful retry', async ({ page }) => {
      await prepare(page);
      const requests = [];
      await page.route('**/api/share-notes/state-transitions', route => {
        if (route.request().method() !== 'POST') return route.fulfill({ json: { notes: [note] } });
        requests.push(route.request().postDataJSON());
        if (requests.length === 1) return route.fulfill({ status: 503, json: { error: 'Please try again shortly.' } });
        return route.fulfill({ json: { note: { ...note, id: 'new-note', body: requests[1].body } } });
      });
      await page.goto('/share/state-transitions');
      await showNotes(page, width);
      const draft = page.getByLabel('Your reflection').filter({ visible: true });
      await draft.fill('I will make room for a pause.');
      const submit = page.getByRole('button', { name: 'Share note', exact: true }).filter({ visible: true });
      await submit.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('alert').filter({ visible: true })).toHaveText('Please try again shortly.');
      await expect(draft).toHaveValue('I will make room for a pause.');
      await expect(page.getByRole('status').filter({ hasText: 'Please try again shortly.' })).toHaveCount(0);
      await submit.focus();
      await page.keyboard.press('Enter');
      await expect(draft).toHaveValue('');
      await expect(page.getByRole('alert').filter({ visible: true })).toHaveCount(0);
      await expect(page.getByRole('status').filter({ hasText: 'Shared!' })).toBeVisible();
      expect(requests).toEqual([
        { authorName: '', body: 'I will make room for a pause.', cardPosition: 'Past' },
        { authorName: '', body: 'I will make room for a pause.', cardPosition: 'Past' }
      ]);
    });

    test('reported notes persist for their share link and stay independent of other links', async ({ page }) => {
      await prepare(page);
      await page.goto('/share/report-a');
      await showNotes(page, width);
      await page.getByRole('button', { name: 'Report this note' }).filter({ visible: true }).click();
      await page.getByRole('button', { name: 'Submit report' }).filter({ visible: true }).click();
      await expect(page.getByText('Reported', { exact: true }).filter({ visible: true })).toBeVisible();
      await page.reload();
      await showNotes(page, width);
      await expect(page.getByText('Reported', { exact: true }).filter({ visible: true })).toBeVisible();
      await page.goto('/share/report-b');
      await showNotes(page, width);
      await expect(page.getByRole('button', { name: 'Report this note' }).filter({ visible: true })).toBeVisible();
      await expect(page.getByRole('list', { name: '1 reflection', exact: true }).filter({ visible: true }).getByText('A gentle reflection.', { exact: true })).toBeVisible();
    });
  });
}

for (const width of [320, 1280]) {
  for (const theme of ['dark', 'light']) {
    test(`governance text has sufficient contrast at ${width}px (${theme})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await prepare(page, theme);
      await page.goto('/governance-critique');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: testInfo.outputPath('governance-viewport.png') });
      await page.screenshot({ path: testInfo.outputPath('governance.png'), fullPage: true });
      const { violations } = await new AxeBuilder({ page })
        .include('.governance-critique-page')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
    });
  }
}
