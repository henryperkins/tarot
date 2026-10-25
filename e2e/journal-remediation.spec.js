import { test, expect } from './helpers/frontendTest.js';
import { THREE_CARDS } from '../tests/helpers/journalFixtures.mjs';

const firstQuestion = 'What deserves a quieter place in my week?';
const entries = Array.from({ length: 6 }, (_, index) => ({
  id: `journal-remediation-${index}`, readingResultId: `remediation-result-${index}`, ts: Date.now() - index * 86400000,
  question: index === 0 ? firstQuestion : `How can I make room for reflection ${index}?`,
  spread: 'Three-Card Story', spreadKey: 'threeCard', deckId: 'rws-1909', context: 'self', cards: THREE_CARDS,
  personalReading: '## A steadier rhythm\n\nMake space for a small pause before the next commitment. '.repeat(20),
  reflections: { Overall: 'I can choose a steadier pace.' }
}));

async function openJournal(page, { owner = null, tier = 'free', corrupt = false, outage = false, empty = false, legacyViews = false } = {}) {
  const state = { owner, tier, outage, mutations: [] };
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/auth/me') return route.fulfill(state.owner ? { json: { user: { id: state.owner, username: state.owner,
      subscription_tier: state.tier, subscription_status: state.tier === 'free' ? 'inactive' : 'active', email_verified: true } } }
      : { status: 401, json: { user: null } });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      state.mutations.push(path); return route.fulfill({ status: 503, json: { error: 'Read-only browser fixture' } });
    }
    if (path === '/api/journal') return route.fulfill(state.outage ? { status: 503, json: { error: 'Synthetic outage' } }
      : { json: { entries: empty ? [] : entries, pagination: { total: empty ? 0 : entries.length, hasMore: false } } });
    if (path === '/api/archetype-journey/preferences') return route.fulfill({ json: { preferences: { archetype_journey_enabled: false } } });
    if (path === '/api/share') return route.fulfill({ json: { shares: [] } });
    return route.fulfill({ json: {} });
  });
  await page.addInitScript(({ entries, corrupt, empty, legacyViews }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    if (!sessionStorage.getItem('journal-remediation-seeded')) {
      for (const key of ['tarot_journal', 'tarot_journal_owner-a', 'tarot_journal_owner-b']) localStorage.setItem(key, corrupt ? '{broken' : JSON.stringify(empty ? [] : entries));
      if (legacyViews) localStorage.setItem('journal_saved_filters_v1', JSON.stringify([{ id: 'older', name: 'Private older view', values: { query: 'Earlier private question' } }]));
      sessionStorage.setItem('journal-remediation-seeded', 'true');
    }
  }, { entries, corrupt, empty, legacyViews });
  await page.goto('/journal');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  return state;
}

async function openPracticeDetails(page) {
  const summary = page.getByText('Practice snapshot', { exact: true }).first();
  const details = summary.locator('xpath=ancestor::details[1]');
  await expect(details).not.toHaveAttribute('open');
  await summary.click();
  await expect(details).toHaveAttribute('open');
  const showDetails = page.getByRole('button', { name: 'Show Details', exact: true });
  if (await showDetails.isVisible()) await showDetails.click();
  return details;
}

async function expectUnclipped(locator, label) {
  const measurement = await locator.evaluate(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clipped: style.overflowX !== 'visible' && element.scrollWidth > element.clientWidth + 1,
      outside: [...range.getClientRects()].some(textRect =>
        textRect.left < rect.left - 1 || textRect.right > rect.right + 1)
    };
  });
  expect(measurement.clipped, `${label} must wrap rather than clip`).toBe(false);
  expect(measurement.outside, `${label} text must stay inside its container`).toBe(false);
}

for (const width of [390, 1440]) {
  test(`saved questions and search lead the Journal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await openJournal(page);
    const search = page.getByRole('searchbox', { name: 'Search journal entries' });
    await expect(search).toBeInViewport();
    const first = page.getByRole('article').first();
    await expect(first.getByRole('heading', { name: firstQuestion, exact: true })).toBeInViewport();
    const searchBox = await search.boundingBox(), entryBox = await first.boundingBox();
    expect(searchBox.y).toBeLessThan(460);
    expect(entryBox.y).toBeLessThan(width === 390 ? 740 : 650);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test('a guest can delete one local entry with confirmation and keep the deletion on reload', async ({ page }) => {
  await openJournal(page);
  await page.getByTitle('Entry actions', { exact: true }).first().click();
  await page.getByRole('menuitem', { name: 'Delete entry', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete Journal Entry' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(5);
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(5);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_journal')).length)).toBe(5);
});

test('a signed-in Free local entry copies a summary without requesting a cloud share', async ({ page }) => {
  const state = await openJournal(page, { owner: 'owner-a' });
  await page.getByTitle('Copy summary', { exact: true }).first().click();
  await expect(page.getByTitle('Create share link', { exact: true })).toHaveCount(0);
  expect(state.mutations).not.toContain('/api/share');
});

test('saved views and active queries remain isolated across account and guest changes', async ({ page }) => {
  const state = await openJournal(page, { owner: 'owner-a' });
  const search = page.getByRole('searchbox', { name: 'Search journal entries' });
  await search.fill('Private account A question');
  await page.getByRole('button', { name: 'Save this view', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name for saved filter view' }).fill('Account A only');
  await page.getByRole('button', { name: 'Save current', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account A only', exact: true })).toBeVisible();
  for (const owner of ['owner-b', null]) {
    state.owner = owner; await page.reload();
    await expect(page.getByRole('button', { name: 'Account A only', exact: true })).toHaveCount(0);
    await expect(search).toHaveValue('');
  }
  state.owner = 'owner-a'; await page.reload();
  await page.getByRole('button', { name: 'Account A only', exact: true }).click();
  await expect(search).toHaveValue('Private account A question');
});

test('mounted full-history search resets safely through account A, guest, and account B', async ({ page }) => {
  await openJournal(page);
  await page.route('**/api/journal/search?**', route => route.fulfill({ json: { entries: [{ id: 'private-result', question: 'Private account A result' }] } }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(async () => {
    const reactModule = await import('/node_modules/.vite/deps/react.js');
    const React = reactModule.default || reactModule;
    const clientModule = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { createRoot } = clientModule.default || clientModule;
    const { useJournalFilters } = await import('/src/hooks/useJournalFilters.js');
    const host = document.createElement('div'); host.id = 'owner-transition-probe'; document.body.append(host);
    const root = createRoot(host);
    const loaded = Array.from({ length: 201 }, (_, index) => ({ id: `probe-${index}`, question: 'Loaded reading' }));
    function Probe({ owner }) {
      const state = useJournalFilters(loaded, { isAuthenticated: Boolean(owner), canUseCloudJournal: Boolean(owner), userId: owner });
      window.__journalOwnerProbe = { query: query => state.setFilters(previous => ({ ...previous, query })),
        owner: owner => root.render(React.createElement(Probe, { owner })), cleanup: () => { root.unmount(); host.remove(); } };
      return React.createElement('output', null, JSON.stringify({ owner, query: state.filters.query,
        questions: state.filteredEntries.map(entry => entry.question), searchStatus: state.serverSearchState.status }));
    }
    root.render(React.createElement(Probe, { owner: 'mounted-owner-a' }));
  });
  const output = page.locator('#owner-transition-probe output');
  await expect(output).toContainText('mounted-owner-a');
  await page.evaluate(() => window.__journalOwnerProbe.query('Private account A'));
  await expect(output).toContainText('Private account A result');
  for (const owner of [null, 'mounted-owner-b']) {
    await page.evaluate(owner => window.__journalOwnerProbe.owner(owner), owner);
    await expect(output).toContainText(`"owner":${JSON.stringify(owner)}`);
    await expect(output).toContainText('"query":""');
    await expect(output).not.toContainText('Private account A');
  }
  await page.evaluate(() => window.__journalOwnerProbe.cleanup());
  expect(errors).toEqual([]);
});

test('native journal locks serialize a save and a visual update across two tabs', async ({ page, context }) => {
  await openJournal(page);
  const other = await context.newPage();
  try {
    await openJournal(other);
    await page.evaluate(() => localStorage.setItem('tarot_journal_lock-probe', JSON.stringify([
      { id: 'kept', readingResultId: 'kept-result', question: 'Keep this reading', personalReading: 'Original saved prose', cards: [], ts: 1000 }
    ])));
    const saving = page.evaluate(async () => {
      const { withLocalJournalStorageLock, writeLocalJournalEntries } = await import('/src/lib/journal/localJournalStorage.js');
      return withLocalJournalStorageLock(['tarot_journal_lock-probe'], async () => {
        window.__journalLockReady = true;
        await new Promise(resolve => { window.__journalLockRelease = resolve; });
        return writeLocalJournalEntries({ storage: localStorage, key: 'tarot_journal_lock-probe', entries: [
          { id: 'incoming', readingResultId: 'incoming-result', question: 'Concurrent saved question', personalReading: 'New prose', cards: [], ts: 2000 }
        ] });
      });
    });
    await expect.poll(() => page.evaluate(() => Boolean(window.__journalLockReady))).toBe(true);
    const patching = other.evaluate(async () => {
      const { commitSavedVisualEntry, savedVisualSourceKey } = await import('/src/lib/readingVisualStorage.js');
      const entry = JSON.parse(localStorage.getItem('tarot_journal_lock-probe'))[0];
      return commitSavedVisualEntry({ namespace: 'user:lock-probe', entryId: entry.id, sourceKey: savedVisualSourceKey(entry),
        update: current => ({ ...current, visualState: { stateVersion: 1 } }) });
    });
    await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).pending.length)).toBeGreaterThan(0);
    await page.evaluate(() => window.__journalLockRelease());
    const [saved, patched] = await Promise.all([saving, patching]);
    expect(saved.ok).toBe(true); expect(patched.committed).toBe(true);
    const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_journal_lock-probe')));
    expect(retained.map(entry => entry.id).sort()).toEqual(['incoming', 'kept']);
    expect(retained.find(entry => entry.id === 'kept').visualState.stateVersion).toBe(1);
  } finally {
    await page.evaluate(() => window.__journalLockRelease?.()).catch(() => {});
    await other.close();
  }
});

test('legacy global views stay private until an explicit owner import', async ({ page }) => {
  await openJournal(page, { owner: 'owner-b', legacyViews: true });
  await expect(page.getByRole('button', { name: 'Private older view', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Import older saved views', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import saved views' });
  await dialog.getByRole('button', { name: 'Import views', exact: true }).click();
  await page.getByRole('button', { name: 'Private older view', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toHaveValue('Earlier private question');
});

for (const mode of ['corrupt', 'outage']) {
  test(`${mode} journal uses recovery messaging rather than first-use empty state`, async ({ page }) => {
    await openJournal(page, mode === 'corrupt' ? { corrupt: true } : { owner: 'owner-a', tier: 'pro', outage: true, empty: true });
    await expect(page.getByRole('heading', { name: 'Journal unavailable', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Start your tarot journal', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again', exact: true }).last()).toBeVisible();
  });
}

test('the empty Journal makes its first reading action immediately available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openJournal(page, { empty: true });
  await expect(page.getByRole('button', { name: 'Start a reading', exact: true })).toBeInViewport();
});

test('filter reset uses the full touch target and restores results', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openJournal(page);
  await page.getByRole('searchbox', { name: 'Search journal entries' }).fill('unmatched-word');
  const reset = page.getByRole('button', { name: 'Reset view', exact: true });
  await expect(reset).toBeEnabled();
  expect((await reset.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await reset.click();
  await expect(page.getByRole('article')).toHaveCount(6);
});

test('Escape from the mobile card fan restores its disclosure focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openJournal(page);
  await page.getByTitle('Expand entry', { exact: true }).first().click();
  const cards = page.getByRole('group', { name: 'Cards drawn in this reading', exact: true }).first();
  await cards.getByRole('button', { expanded: false }).first().click();
  const card = cards.getByRole('button', { name: /The Hermit/ }).first();
  await card.focus(); await card.press('Escape');
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[aria-label="Cards drawn in this reading"]') !== null)).toBe(true);
  await expect(page.locator(':focus')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator(':focus')).toHaveJSProperty('tagName', 'BUTTON');
});

test('See Journey opens and focuses the deferred mobile Journey, then preserves its selected view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openJournal(page);
  const journeySummary = page.getByText('Your reading journey', { exact: true }).first();
  const journeyDetails = journeySummary.locator('xpath=ancestor::details[1]');
  await expect(journeyDetails).not.toHaveAttribute('open');
  await expect(page.locator('[aria-label="Journal insights and journey"]')).toHaveCount(0);
  await openPracticeDetails(page);
  await page.getByRole('button', { name: 'See Journey', exact: true }).click();
  await expect(journeyDetails).toHaveAttribute('open');
  await expect(journeySummary).toBeFocused();
  const region = page.locator('[aria-label="Journal insights and journey"]');
  await expect(region).toBeVisible();
  const journeyHero = region.locator('[aria-labelledby="reading-journey-mobile-heading"]');
  await expect(journeyHero.getByRole('button', { name: /See Full Journey/ })).toBeVisible();
  await expect.poll(() => journeySummary.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  })).toBe(true);

  await journeyHero.getByRole('button', { name: /See Full Journey/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Your Reading Journey' });
  await sheet.getByRole('tab', { name: 'Patterns', exact: true }).click();
  await expect(sheet.getByRole('tab', { name: 'Patterns', exact: true })).toHaveAttribute('aria-selected', 'true');
  await sheet.getByRole('button', { name: 'Close journey panel', exact: true }).click();
  await journeySummary.click();
  await expect(journeyDetails).not.toHaveAttribute('open');
  await journeySummary.click();
  await expect(journeyDetails).toHaveAttribute('open');
  await journeyHero.getByRole('button', { name: /See Full Journey/ }).click();
  await expect(sheet.getByRole('tab', { name: 'Patterns', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('mobile practice snapshot and Journey reflow at 200% text without clipping', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openJournal(page);
  const practice = await openPracticeDetails(page);
  const journeySummary = page.getByText('Your reading journey', { exact: true }).first();
  await journeySummary.click();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.evaluate(() => document.fonts.ready);

  const journeyHero = page.locator('[aria-label="Journal insights and journey"] [aria-labelledby="reading-journey-mobile-heading"]');
  const scopeChip = journeyHero.locator('h2 span').filter({ hasText: /^Scope:/ });
  await expect(scopeChip).toBeVisible();
  await expectUnclipped(scopeChip, 'mobile Journey scope');

  const latestCard = practice.getByRole('button', { name: /The Hermit, Upright.*Tap for insight/ }).filter({ visible: true }).first();
  await expect(latestCard).toBeVisible();
  await expectUnclipped(latestCard.locator('p').filter({ hasText: /^The Hermit$/ }), 'latest card name');

  const reversalLabel = practice.getByText('Reversal rate', { exact: true }).filter({ visible: true }).first();
  await expect(reversalLabel).toBeVisible();
  await expectUnclipped(reversalLabel, 'practice reversal label');
});

test('desktop practice snapshot switches from the fixed constellation to flowing stats at 200% text', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openJournal(page);
  await openPracticeDetails(page);
  const constellation = page.locator('.journal-summary__constellation');
  const flow = page.locator('.journal-summary__flow');
  await expect(constellation).toBeVisible();
  await expect(flow).toBeHidden();

  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await expect(constellation).toBeHidden();
  await expect(flow).toBeVisible();
  await expect(flow.locator('dt')).toHaveCount(4);
  for (const label of ['Entries logged', 'Reversal rate', 'Top context', 'Last entry']) {
    const term = flow.getByText(label, { exact: true });
    if (await term.count()) await expectUnclipped(term.first(), label);
  }
});



test('follow-up actions keep the shared 44px touch target for guests and Pro', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await openJournal(page);
  let article = page.getByRole('article').first();
  await article.getByTitle('Expand entry', { exact: true }).click();
  const guestAction = article.getByRole('button', { name: 'Sign in to ask', exact: true });
  await expect(guestAction).toBeVisible();
  expect((await guestAction.boundingBox()).height).toBeGreaterThanOrEqual(44);

  state.owner = 'owner-a';
  state.tier = 'pro';
  await page.reload();
  article = page.getByRole('article').first();
  await article.getByTitle('Expand entry', { exact: true }).click();
  const proAction = article.getByRole('button', { name: 'Ask a follow-up', exact: true });
  await expect(proAction).toBeVisible();
  expect((await proAction.boundingBox()).height).toBeGreaterThanOrEqual(44);
});
