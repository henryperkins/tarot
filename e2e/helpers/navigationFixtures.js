import { buildReadingSnapshot } from '../../src/lib/readingSnapshot.js';
import { expect } from '@playwright/test';

export const DEMO_READER = { id: 'navigation-demo', username: 'Avery', email: 'avery@example.invalid',
  email_verified: true, subscription_tier: 'pro', subscription_status: 'active', subscription_provider: 'manual' };
export const DEMO_READING = {
  id: 'navigation-reflection', ts: Date.now(), spread: 'One-Card Insight', spreadKey: 'single',
  question: 'Where can I make space for a quieter pace?', deckId: 'rws-1909',
  cards: [{ name: 'The Star', number: 17, position: 'Theme', orientation: 'Upright', isReversed: false,
    upright: 'hope, renewal, perspective', reversed: 'reconnection, patience' }],
  personalReading: '## Opening\n\nThe Star invites a gentler pace. Make space for what restores your attention.\n\n## Reflection\n\nChoose one small commitment you can keep today, and leave room to rest.'
};

export async function prepareNavigation(page, { pro = false, theme = 'dark', completed = false, populated = false, rituals = false } = {}) {
  const user = pro ? DEMO_READER : null;
  const entries = populated ? Array.from({ length: 5 }, (_, i) => ({ ...DEMO_READING, id: `navigation-${i}`, ts: Date.now() - i * 86400000 })) : [];
  const snapshot = completed ? buildReadingSnapshot({ owner: pro ? `user:${DEMO_READER.id}` : 'guest',
    spreadKey: 'single', reading: DEMO_READING.cards, isSpreadDealt: true, revealedCards: [0], hasConfirmedSpread: true,
    question: DEMO_READING.question, narrative: { raw: DEMO_READING.personalReading, provider: 'local-composer' } }) : null;
  await page.addInitScript(({ theme, entries, snapshot, id, rituals }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-theme', theme);
    localStorage.setItem('tarot-personalization:guest', JSON.stringify({ showRitualSteps: rituals }));
    if (id) localStorage.setItem(`tarot-personalization:${id}`, JSON.stringify({ showRitualSteps: rituals }));
    localStorage.setItem(id ? `tarot_journal_${id}` : 'tarot_journal', JSON.stringify(id ? [] : entries));
    if (snapshot) sessionStorage.setItem('tarot:reading-snapshot', JSON.stringify(snapshot));
    else sessionStorage.removeItem('tarot:reading-snapshot');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({ readingCount: 3, hasSeenRitualNudge: true,
      hasSeenGestureCoach: true, hasSeenJournalNudge: true, hasDismissedAccountNudge: true, journalSaveCount: 2 }));
  }, { theme, entries, snapshot, id: user?.id, rituals });
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/me') return route.fulfill({ status: user ? 200 : 401, json: { user } });
    if (url.pathname === '/api/subscription') return route.fulfill({ json: { subscription: { tier: pro ? 'pro' : 'free', status: pro ? 'active' : 'inactive', provider: 'manual' } } });
    if (url.pathname === '/api/journal') return route.fulfill({ json: url.searchParams.has('summary')
      ? { summary: { total: entries.length, lastReadingAt: entries[0]?.ts || null } }
      : { entries, pagination: { total: entries.length, hasMore: false } } });
    if (url.pathname === '/api/share/navigation-demo') return route.fulfill({ json: {
      token: 'navigation-demo', title: 'A shared reflection', entries: [DEMO_READING], notes: [], meta: { entryCount: 1 }, viewCount: 1
    } });
    if (url.pathname === '/api/archetype-journey/preferences') return route.fulfill({ json: { preferences: { archetype_journey_enabled: false } } });
    return route.fulfill({ json: { ok: true, success: true, enabled: false, memories: [], entries: [], notes: [], cards: [],
      usage: { readings: { used: 0, limit: null }, followups: { used: 0, limit: null } }, analytics: { topCards: [], badges: [], monthlyTotals: [] } } });
  });
}

export async function settleNavigation(page) {
  await page.locator('[data-app-header]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

// Page overflow alone misses text that paints outside an undersized target.
// Inspect the labels and annotation separately, including the text spans that
// can overflow an inline-flex label, and the neighboring Settings control.
export async function expectCanvasProgressGeometry(page) {
  const canvas = page.locator('.canvas-progress');
  await canvas.scrollIntoViewIfNeeded();
  await settleNavigation(page);
  const targets = canvas.locator('.step-progress-canvas__button, .canvas-progress__settings');
  await expect(targets).toHaveCount(5);
  const geometry = await targets.evaluateAll(buttons => buttons.map(button => ({
    name: button.getAttribute('aria-label'),
    box: button.getBoundingClientRect().toJSON(),
    labels: [...button.querySelectorAll('.step-progress-canvas__label, .step-progress-canvas__label > span, .step-progress-canvas__skipped')]
      .map(label => ({ text: label.textContent, box: label.getBoundingClientRect().toJSON() }))
  })));
  for (const target of geometry) {
    expect(target.box.width, target.name).toBeGreaterThanOrEqual(43.99);
    expect(target.box.height, target.name).toBeGreaterThanOrEqual(43.99);
    for (const label of target.labels) {
      const message = `${target.name}: ${JSON.stringify(label)}`;
      expect(label.box.left, message).toBeGreaterThanOrEqual(target.box.left - 1);
      expect(label.box.right, message).toBeLessThanOrEqual(target.box.right + 1);
      expect(label.box.top, message).toBeGreaterThanOrEqual(target.box.top - 1);
      expect(label.box.bottom, message).toBeLessThanOrEqual(target.box.bottom + 1);
    }
  }
  const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  for (let i = 0; i < geometry.length; i++) {
    for (let j = i + 1; j < geometry.length; j++) {
      expect(overlap(geometry[i].box, geometry[j].box), 'Progress and Settings targets must be independent').toBe(0);
      for (const a of geometry[i].labels) for (const b of geometry[j].labels) {
        expect(overlap(a.box, b.box), `${a.text} must not overlap ${b.text}`).toBe(0);
      }
    }
  }
  for (const target of await targets.all()) {
    await target.scrollIntoViewIfNeeded();
    await expect.poll(() => target.evaluate(button => {
      const box = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
    }), { message: 'The center must activate its own progress/Settings target' }).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  return geometry;
}
