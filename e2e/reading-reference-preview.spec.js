import { readFile, writeFile } from 'node:fs/promises';
import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openReadingSupport } from './helpers/narrativeFixtures.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';
import { buildReadingSnapshot } from '../src/lib/readingSnapshot.js';
import { analyzeSpreadThemes } from '../functions/lib/spreadAnalysis.js';

const SAVED_NARRATIVE = '## Opening\n\nSaved reader wording — keep next Thursday free.\n\n## Reflection\n\nChoose one useful practical step.';
const currentSnapshot = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('tarot:reading-snapshot') || 'null'));

async function readingState({ deck = 'thoth-a1', names = ['Strength'], historical = false, complete = true, provider = 'fixture', usage = null, explicitDeck = true, narrative = SAVED_NARRATIVE } = {}) {
  const reading = names.map((name, index) => {
    const card = [...MAJOR_ARCANA, ...MINOR_ARCANA].find(card => card.name === name);
    return { ...card, name, isReversed: index === 1 };
  });
  const cardsInfo = reading.map((card, index) => ({ ...card, card: card.name, canonicalName: card.name, canonicalKey: card.name.toLowerCase(), position: `Position ${index + 1}`, orientation: card.isReversed ? 'Reversed' : 'Upright' }));
  const themes = await analyzeSpreadThemes(cardsInfo, { deckStyle: deck, env: { GRAPHRAG_ENABLED: 'true', KNOWLEDGE_GRAPH_ENABLED: 'true' } });
  if (historical) {
    themes.knowledgeGraph.retrievedPassages = [{ title: 'Foreign legacy RWS reference', text: 'Unverified historical scene with a Rider-Waite lion.', context: 'general' }];
    delete themes.knowledgeGraph.graphRAGPayload;
    // Explicit saved draw identity alone must suffice for recoverable history.
    delete themes.deckStyle;
  }
  return buildReadingSnapshot({
    owner: 'guest', spreadKey: names.length === 1 ? 'single' : 'threeCard', hasUserSelectedSpread: true,
    reading, drawIncludeMinors: names.some(name => / of /.test(name)), drawDeckStyleId: explicitDeck ? deck : null,
    isSpreadDealt: true, revealedCards: reading.map((_, index) => index), dealIndex: reading.length,
    hasConfirmedSpread: true, sessionSeed: 'preview-synthetic-seed',
    ritual: { hasKnocked: true, hasCut: true, cutIndex: 12 },
    question: 'How can I preserve a useful boundary next Thursday?', reflections: { 0: 'Literal reflection — keep my boundary.' },
    narrative: complete ? { raw: narrative, provider, requestId: 'preview-synthetic' } : null,
    analysis: { themes, readingMeta: { provider, ...(explicitDeck ? { deckStyle: deck } : {}), ...(usage ? { sourceUsage: { graphRAG: usage } } : {}) } }
  });
}

async function installState(page, state) {
  await page.addInitScript(state => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-deck-style', 'rws-1909');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({ readingCount: 3, hasSeenRitualNudge: true, hasSeenGestureCoach: true, hasSeenJournalNudge: true, hasDismissedAccountNudge: true, journalSaveCount: 1 }));
    if (!sessionStorage.getItem('preview-state-installed')) {
      sessionStorage.setItem('tarot:reading-snapshot', JSON.stringify(state));
      sessionStorage.setItem('preview-state-installed', 'true');
    }
  }, state);
}

async function networkGuard(page) {
  const calls = { api: [], prohibited: [], blockedExternal: [], runtimeErrors: [] };
  page.on('pageerror', error => calls.runtimeErrors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      calls.blockedExternal.push(`${url.protocol}//${url.hostname}`);
      return route.abort();
    }
    if (url.pathname.startsWith('/api/')) {
      const call = { path: url.pathname, method: route.request().method() };
      calls.api.push(call);
      if (/embedding|generate-story|generate-card|\/ai\//i.test(url.pathname) && !url.searchParams.has('capabilities')
        || url.pathname === '/api/usage' && call.method !== 'GET') {
        calls.prohibited.push(call);
        return route.fulfill({ status: 503, json: { error: 'Prohibited in preview rendering qualification' } });
      }
    }
    return route.fallback();
  });
  return calls;
}

async function previewPanel(page) {
  await openReadingSupport(page);
  const panel = page.locator('.spread-patterns-panel');
  await expect(panel).toBeVisible();
  const disclosure = panel.getByRole('button', { name: 'Traditional wisdom preview', exact: true });
  await expect(disclosure).toBeVisible();
  if (await disclosure.getAttribute('aria-expanded') !== 'true') await disclosure.press('Enter');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByRole('list', { name: 'Traditional wisdom preview passages', exact: true })).toBeVisible();
  return panel;
}

async function expectNoPreviewSideEffects(fixture, calls) {
  expect(fixture.requests.reading).toHaveLength(0);
  expect(fixture.requests.journal).toHaveLength(0);
  expect(fixture.requests.followup).toHaveLength(0);
  expect(calls.prohibited).toEqual([]);
  expect(calls.runtimeErrors).toEqual([]);
  expect(calls.api.filter(call => call.method !== 'GET' && !call.path.startsWith('/api/auth/'))).toEqual([]);
}

for (const example of [
  { label: 'Thoth Lust', deck: 'thoth-a1', names: ['Strength'], title: 'Lust', forbidden: /\bStrength\b|Rider.Waite lion/ },
  { label: 'Thoth Art', deck: 'thoth-a1', names: ['Temperance'], title: 'Art', forbidden: /\bTemperance\b/ },
  { label: 'Marseille La Force', deck: 'marseille-classic', names: ['Strength'], title: 'La Force', forbidden: /\bStrength\b|Rider.Waite lion/ },
  { label: 'Marseille pips', deck: 'marseille-classic', names: ['Two of Cups', 'Two of Pentacles', 'Two of Swords'], title: 'Marseille Numerology: Two', forbidden: /Rider.Waite|Lust|Temperance/ },
  { label: 'Marseille court', deck: 'marseille-classic', names: ['Page of Cups', 'Knight of Cups', 'Queen of Cups'], title: 'Coupes Court Council', forbidden: /Rider.Waite lion|Lust|Temperance/ }
]) {
  test(`guest completed ${example.label} preview preserves projected labels and saved reading`, async ({ page }, testInfo) => {
    const state = await readingState(example);
    await installState(page, state);
    const fixture = await createNarrativeFixture(page, { signedOut: true, sourceUsage: null });
    const calls = await networkGuard(page);
    try {
      await page.goto('/');
      const panel = await previewPanel(page);
      const references = panel.getByRole('list', { name: 'Traditional wisdom preview passages', exact: true });
      await expect(references).toContainText(example.title);
      await expect(references).not.toContainText(example.forbidden);
      await expect(panel).toContainText('These are a preview; inclusion in the generated reading is unverified.');
      await expect(page.locator('.narrative-stream')).toContainText('Saved reader wording — keep next Thursday free.');
      const after = await currentSnapshot(page);
      expect(after.narrative.raw).toBe(state.narrative.raw);
      expect(after.reading).toEqual(state.reading);
      expect(after.reflections).toEqual(state.reflections);
      expect(after.drawDeckStyleId).toBe(example.deck);
      await expectNoPreviewSideEffects(fixture, calls);
      if (example.label === 'Thoth Lust') await panel.screenshot({ path: testInfo.outputPath('guest-thoth-preview.png') });
    } finally { await fixture.close(); }
  });
}

test('guest loading keeps preview support hidden until mocked completion without delaying narrative delivery', async ({ page }) => {
  const state = await readingState({ complete: false });
  await installState(page, state);
  const fixture = await createNarrativeFixture(page, { signedOut: true, sourceUsage: null, meta: { themes: state.analysis.themes } });
  const calls = await networkGuard(page);
  try {
    await page.goto('/');
    await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().press('Enter');
    await expect.poll(() => fixture.connected('reading')).toBeGreaterThan(0);
    await fixture.emit('reading', 'delta', { text: '## Opening\n\nA reflective beginning. ' });
    await expect(page.locator('.narrative-stream')).toContainText('A reflective beginning.');
    // The existing scene intentionally hides Explore support while streaming.
    // Loading coverage must preserve that behavior and uninterrupted prose.
    await expect(page.locator('details.reading-support')).toBeHidden();
    await fixture.completeReading();
    const panel = await previewPanel(page);
    await expect(panel).toContainText('Background references for these cards.');
    await expect(panel).toContainText('Lust');
    await expect(panel).toContainText('These are a preview; inclusion in the generated reading is unverified.');
    expect(fixture.requests.reading).toHaveLength(1);
    expect(calls.prohibited).toEqual([]);
    expect(calls.runtimeErrors).toEqual([]);
  } finally { await fixture.close(); }
});

test('recoverable restored history rebuilds a labeled preview without changing original prose, cards, or reflections', async ({ page }, testInfo) => {
  const state = await readingState({ historical: true });
  await installState(page, state);
  const fixture = await createNarrativeFixture(page, { signedOut: true, sourceUsage: null });
  const calls = await networkGuard(page);
  try {
    await page.goto('/');
    const panel = await previewPanel(page);
    await expect(panel).toContainText('Reconstructed preview from the saved cards and deck.');
    await expect(panel).toContainText('Lust');
    await expect(panel).not.toContainText('Foreign legacy RWS reference');
    const after = await currentSnapshot(page);
    expect(after.narrative).toEqual(state.narrative);
    expect(after.reading).toEqual(state.reading);
    expect(after.reflections).toEqual(state.reflections);
    expect(after.analysis.themes.knowledgeGraph.retrievedPassages).toEqual(state.analysis.themes.knowledgeGraph.retrievedPassages);
    await expectNoPreviewSideEffects(fixture, calls);
    await panel.screenshot({ path: testInfo.outputPath('reconstructed-history-preview.png') });
  } finally { await fixture.close(); }
});

for (const malformed of [{ broken: 'legacy object' }, 'legacy preview string']) {
  test(`malformed historical ${typeof malformed} preview data reconstructs safely without delaying the saved narrative`, async ({ page }) => {
    const state = await readingState({ historical: true });
    state.analysis.themes.knowledgeGraph.retrievedPassages = malformed;
    await installState(page, state);
    const fixture = await createNarrativeFixture(page, { signedOut: true, sourceUsage: null });
    const calls = await networkGuard(page);
    try {
      await page.goto('/');
      await expect(page.locator('.narrative-stream')).toContainText('Saved reader wording — keep next Thursday free.');
      const panel = await previewPanel(page);
      await expect(panel).toContainText('Reconstructed preview from the saved cards and deck.');
      await expect(panel).toContainText('Lust');
      const after = await currentSnapshot(page);
      expect(after.narrative.raw).toBe(state.narrative.raw);
      expect(after.analysis.themes.knowledgeGraph.retrievedPassages).toEqual(malformed);
      await expectNoPreviewSideEffects(fixture, calls);
    } finally { await fixture.close(); }
  });
}

for (const variant of [
  { label: 'safe fallback', provider: 'safe-fallback', usage: null, preview: false },
  { label: 'accounted local fallback', provider: 'local-composer', usage: { used: false, mode: 'none', selectedDeck: 'thoth-a1', passagesUsedInPrompt: 0, passageIndices: [] }, preview: false },
  { label: 'historical local fallback without use metadata', provider: 'local-composer', usage: null, preview: true }
]) {
  test(`${variant.label} preserves its distinct preview contract`, async ({ page }) => {
    const state = await readingState(variant);
    await installState(page, state);
    const fixture = await createNarrativeFixture(page, { signedOut: true, sourceUsage: null });
    const calls = await networkGuard(page);
    try {
      await page.goto('/');
      await expect(page.locator('.narrative-stream')).toContainText('Saved reader wording');
      await openReadingSupport(page);
      const preview = page.getByRole('button', { name: 'Traditional wisdom preview', exact: true });
      if (variant.preview) await expect(preview).toBeVisible();
      else await expect(preview).toHaveCount(0);
      await expectNoPreviewSideEffects(fixture, calls);
    } finally { await fixture.close(); }
  });
}

test('missing explicit historical deck omits the preview alone and preserves journal actions', async ({ page }) => {
  const state = await readingState({ historical: true, explicitDeck: false });
  await installState(page, state);
  const fixture = await createNarrativeFixture(page, { signedOut: true, sourceUsage: null });
  const calls = await networkGuard(page);
  try {
    await page.goto('/');
    await expect(page.locator('.narrative-stream')).toContainText('Saved reader wording');
    await openReadingSupport(page);
    await expect(page.getByRole('button', { name: 'Traditional wisdom preview', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true })).toBeVisible();
    expect((await currentSnapshot(page)).narrative.raw).toBe(state.narrative.raw);
    await expectNoPreviewSideEffects(fixture, calls);
  } finally { await fixture.close(); }
});

test('restoring a different reading identity cannot retain the prior deck preview after reload', async ({ page }) => {
  const first = await readingState({ historical: true });
  const second = await readingState({ deck: 'marseille-classic', names: ['Two of Cups', 'Two of Pentacles', 'Two of Swords'], historical: true, narrative: '## Opening\n\nSecond saved identity.\n\n## Reflection\n\nKeep the options clear.' });
  await installState(page, first);
  const fixture = await createNarrativeFixture(page, { signedOut: true, sourceUsage: null });
  const calls = await networkGuard(page);
  try {
    await page.goto('/');
    await expect(await previewPanel(page)).toContainText('Lust');
    await page.evaluate(second => sessionStorage.setItem('tarot:reading-snapshot', JSON.stringify(second)), second);
    await page.reload();
    const panel = await previewPanel(page);
    await expect(panel).toContainText('Marseille Numerology: Two');
    await expect(panel).not.toContainText('Lust');
    await expect(page.locator('.narrative-stream')).toContainText('Second saved identity.');
    expect((await currentSnapshot(page)).drawDeckStyleId).toBe('marseille-classic');
    await expectNoPreviewSideEffects(fixture, calls);
  } finally { await fixture.close(); }
});

test('synthetic Pro switching to saved history cancels the prior stream and retains only the new deck preview', async ({ page }, testInfo) => {
  const state = await readingState({ complete: false });
  const second = await readingState({ deck: 'marseille-classic', names: ['Strength'], historical: true, narrative: '## Opening\n\nA different saved reading.\n\n## Reflection\n\nKeep this exact reflection.' });
  await installState(page, state);
  const fixture = await createNarrativeFixture(page, { sourceUsage: null, meta: { themes: state.analysis.themes } });
  const calls = await networkGuard(page);
  fixture.entries.push({ id: 'preview-race-saved-entry', ts: Math.floor(Date.now() / 1000), spread: 'One-Card Insight', spreadKey: 'single', question: second.question, cards: second.reading.map(card => ({ ...card, position: 'Theme', orientation: 'Upright' })), personalReading: second.narrative.raw, deckId: 'marseille-classic', themes: second.analysis.themes, provider: 'local-composer', context: 'general', followUps: [] });
  try {
    await page.goto('/');
    await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().press('Enter');
    await expect.poll(() => fixture.connected('reading')).toBeGreaterThan(0);
    await fixture.emit('reading', 'delta', { text: '## Opening\n\nOld reading still in flight. ' });
    await expect(page.locator('.narrative-stream')).toContainText('Old reading still in flight.');
    await page.getByRole('link', { name: 'Journal', exact: true }).filter({ visible: true }).first().click();
    const entry = page.getByRole('article').first();
    await expect(entry).toBeVisible();
    const expand = entry.locator('button[title="Expand entry"]');
    if (await expand.count()) await expand.click();
    await entry.getByRole('button', { name: 'Ask a follow-up', exact: true }).click();
    await expect.poll(() => fixture.connected('reading')).toBe(0);
    await expect.poll(async () => (await currentSnapshot(page))?.narrative?.raw).toBe(second.narrative.raw);
    await page.getByRole('button', { name: 'Close follow-up chat', exact: true }).click();
    const panel = await previewPanel(page);
    await expect(panel).toContainText('La Force');
    await expect(panel).not.toContainText('Lust');
    await expect(page.locator('.narrative-stream')).toContainText('A different saved reading.');
    await expect(page.locator('.narrative-stream')).not.toContainText('Old reading still in flight.');
    await expect.poll(() => fixture.connected('reading')).toBe(0);
    expect((await currentSnapshot(page)).drawDeckStyleId).toBe('marseille-classic');
    expect(fixture.requests.reading).toHaveLength(1);
    expect(fixture.requests.journal).toHaveLength(0);
    expect(calls.prohibited).toEqual([]);
    expect(calls.runtimeErrors).toEqual([]);
  } catch (error) {
    if (!page.isClosed()) {
      const snapshot = await currentSnapshot(page);
      const diagnostic = JSON.stringify({
        url: page.url(), drawDeckStyleId: snapshot?.drawDeckStyleId,
        cardNames: snapshot?.reading?.map(card => card.name), narrative: snapshot?.narrative,
        oldStreamConnections: fixture.connected('reading'), runtimeErrors: calls.runtimeErrors,
        visibleMain: await page.locator('main').innerText()
      }, null, 2);
      const diagnosticPath = testInfo.outputPath('in-flight-history-switch-state.json');
      await writeFile(diagnosticPath, diagnostic);
      await testInfo.attach('in-flight-history-switch-state', { contentType: 'application/json', path: diagnosticPath });
    }
    throw error;
  } finally { await fixture.close(); }
});

async function loginLocalPro(context) {
  // This is the only credential-reading path. Values and cookies never enter artifacts.
  const credentials = JSON.parse(await readFile('/home/ubuntu/.config/tableu/agent-reviewer.local.json', 'utf8'));
  const origin = new URL(credentials.baseUrl).origin;
  if (origin !== 'http://localhost:8787' || credentials.scope !== 'local-development-only') throw new Error('Reviewer credentials have an invalid local scope.');
  let response;
  try {
    response = await context.request.post(`${origin}/api/auth/login`, { data: { email: credentials.email, password: credentials.password }, maxRedirects: 0 });
  } catch {
    throw new Error('The local reviewer authentication service is unavailable.');
  }
  if (response.status() !== 200) throw new Error(`Local reviewer login returned HTTP ${response.status()}.`);
  try {
    const me = await context.request.get(`${origin}/api/auth/me`);
    const body = await me.json();
    expect(me.status()).toBe(200);
    expect(body.user?.id === credentials.userId).toBe(true);
    expect(body.user?.subscription_tier).toBe('pro');
    expect(body.user?.subscription_status).toBe('active');
  } catch {
    await logoutLocalPro(context, origin);
    throw new Error('Local reviewer identity or Pro tier verification failed.');
  }
  return origin;
}

async function logoutLocalPro(context, origin) {
  let response;
  try { response = await context.request.post(`${origin}/api/auth/logout`); }
  catch { throw new Error('Local reviewer logout failed; session cleanup must be checked.'); }
  expect(response.status()).toBe(200);
  let status;
  try { status = (await context.request.get(`${origin}/api/auth/me`)).status(); }
  catch { throw new Error('Local reviewer logout verification service is unavailable.'); }
  expect(status).toBe(401);
}

test('real local signed-in Pro restores the preview with authenticated tier coverage and logs out', async ({ page, context }, testInfo) => {
  test.skip(process.env.TABLEU_PREVIEW_REAL_PRO !== '1', 'Requires the documented local reviewer auth service; guest/synthetic transports remain independently covered.');
  let origin;
  let fixture;
  try {
    origin = await loginLocalPro(context);
    const state = await readingState({ historical: true, deck: 'marseille-classic', names: ['Strength'] });
    await installState(page, state);
    fixture = await createNarrativeFixture(page, { authMode: 'passthrough', sourceUsage: null });
    const calls = await networkGuard(page);
    await page.goto('/');
    const panel = await previewPanel(page);
    await expect(panel).toContainText('La Force');
    await expect(panel).toContainText('Reconstructed preview from the saved cards and deck.');
    await expect(panel).not.toContainText('Foreign legacy RWS reference');
    const me = await page.evaluate(async () => { const response = await fetch('/api/auth/me'); const body = await response.json(); return { status: response.status, tier: body.user?.subscription_tier, active: body.user?.subscription_status }; });
    expect(me).toEqual({ status: 200, tier: 'pro', active: 'active' });
    await expectNoPreviewSideEffects(fixture, calls);
    await panel.screenshot({ path: testInfo.outputPath('real-pro-preview.png') });
  } finally {
    if (fixture) await fixture.close();
    if (origin) await logoutLocalPro(context, origin);
  }
});
