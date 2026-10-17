// Only auth/tier, narrative transport and journal persistence are controlled.
// React, production flags, normal routes, matching, rendering and native input stay real.
import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { onRequestPost as startRoute } from '../../functions/api/tarot-reading-job-start.js';
import { createD1 } from '../../tests/helpers/d1Sqlite.mjs';
import { seedSession, seedUser, jsonRequest } from '../../tests/helpers/journalFixtures.mjs';
import { withInitialVisualAdmission } from '../../tests/helpers/visualInitialAdmissionFixtures.mjs';

import { applyVisualCueBatch, createVisualCueLedger } from '../../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../../shared/contracts/visualCueBatches.js';
import { fingerprintVisualSource, normalizeVisualSource } from '../../shared/reading/visualSourceIdentity.js';

export function starEntry(overrides = {}) {
  return { id: 'saved-star', ts: Date.now() - 3600000, spread: 'Three-Card Story', spreadKey: 'threeCard',
    question: 'Where can I make space for a quiet pause?', reflections: '', deckId: 'rws-1909',
    cards: [{ name: 'Strength', number: 8, position: 'Past', orientation: 'Upright' },
      { name: 'Four of Swords', position: 'Present', orientation: 'Upright' },
      { name: 'The Star', number: 17, position: 'Future', orientation: 'Upright' }],
    personalReading: 'The Star shows one pitcher into a pool.', sessionSeed: 'aligner-saved-star', ...overrides };
}
export async function sourceBinding(entry, readingResultId, sourceRevision = 0) {
  const source = { raw: entry.personalReading, cards: entry.cards, deckId: entry.deckId, question: entry.question, reflections: entry.reflections };
  const { spreadHash, contextHash } = await fingerprintVisualSource(source); const { artworkEdition, catalogVersion } = normalizeVisualSource(source);
  return { readingResultId, sourceRevision, spreadHash, contextHash, artworkEdition, catalogVersion };
}
export async function acceptedLedger(binding, raw) {
  const result = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: raw,
    issuedRequest: { binding, batchId: 'aligner-cached-fixture', requestSequence: 1, status: 'active', analyzedEnd: raw.length, analyzedHash: await hashVisualCueText(raw), baseLedgerRevision: 0 },
    response: { proposals: [{ localAlias: 'pool', kind: 'literal', quote: 'one pitcher into a pool', targets: [{ spreadIndex: 2, detailIds: ['pool-pour'] }] }] },
    validationContext: { cards: starEntry().cards.map((card, index) => ({ index, canonicalName: card.name })), getSupportedDetails: () => ['pool-pour', 'land-pour'] } });
  if (result.rejected.length) throw new Error('Controlled cached fixture was rejected'); return result.ledger;
}

export async function acceptanceManifest() {
  if (!process.env.ALIGNER_ACCEPTANCE_MANIFEST) throw new Error('An owned production manifest is required.');
  return JSON.parse(await readFile(process.env.ALIGNER_ACCEPTANCE_MANIFEST, 'utf8'));
}
export default async function verifyProductionRuntime() {
  const m = await acceptanceManifest(); const response = await fetch(`${m.origins.frontend}/__aligner_identity`, { redirect: 'error' });
  const identity = await response.json();
  if (!response.ok || identity.runId !== m.runId || identity.snapshotDigest !== m.snapshotDigest || identity.outputDigest !== m.outputDigest
    || !identity.outputIntegrity || identity.mode !== 'production' || identity.dev !== false || identity.prod !== true
    || JSON.stringify(identity.flags) !== JSON.stringify(m.flags)) throw new Error('Production listener identity/integrity mismatch.');
}

/** A real server admission boundary with a fake, fail-closed provider seam.
 * Pro session and accidental model configuration cannot infer without client consent.
 * These counters describe actual server behavior, separately from browser interception.
 */
export async function proveServerNoConsent(payload) {
  const DB = await createD1(); let providerDispatches = 0; let visualDispatches = 0; let narrativeDispatches = 0; let forwarded;
  try {
    await seedUser(DB, { tier: 'pro', status: 'active' }); await seedSession(DB);
    const env = withInitialVisualAdmission({ DB, VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'controlled-fake-model', VISUAL_CUE_ALLOWED_TIERS: '["plus","pro"]',
      AI: { run() { providerDispatches++; throw new Error('Unexpected fake annotation dispatch'); } },
      READING_VISUAL_JOBS: { idFromName(id) { visualDispatches++; return id; }, get() { throw new Error('Unexpected visual job'); } },
      READING_JOBS: { idFromName: id => id, get: () => ({ fetch: async (_url, init) => { narrativeDispatches++; forwarded = JSON.parse(init.body); return Response.json({ ok: true }); } }) } });
    const background = [];
    const response = await startRoute({ env, request: jsonRequest('https://controlled.invalid/api/tarot-reading/jobs', { body: payload, headers: { Cookie: 'session=session-1' } }), waitUntil: promise => background.push(promise) });
    await Promise.all(background);
    expect(response.status).toBe(200); expect(narrativeDispatches).toBe(1); expect(forwarded.visualInit).toBeNull();
    expect(providerDispatches).toBe(0); expect(visualDispatches).toBe(0);
    return { status: response.status, narrativeDispatches, visualDispatches, providerDispatches, actualBoundary: 'tarot-reading-job-start.js',
      seams: ['SQLite D1', 'seeded Pro cookie session', 'fake READING_JOBS transport', 'fake Workers AI provider', 'fake visual DO'], clientConsent: false };
  } finally { DB.sqlite.close(); }
}

/** Inspect only the app's exact configured telemetry endpoint. Transport is
 * fulfilled locally; actual event errors remain test failures, never waived. */
export function classifyBlockedTelemetry({ method, url, body = '' }) {
  const endpoint = new URL(url);
  if (method !== 'POST' || endpoint.protocol !== 'https:' || endpoint.hostname !== 'o4508070823395328.ingest.us.sentry.io'
    || endpoint.port || endpoint.username || endpoint.password || endpoint.pathname !== '/api/4510814880661504/envelope/') return null;
  const result = { endpoint: endpoint.origin + endpoint.pathname, method, items: [], errors: [] };
  try {
    const lines = body.trimEnd().split('\n'); JSON.parse(lines[0]);
    if (lines.length < 3 || lines.length % 2 !== 1) throw new Error('Malformed envelope');
    for (let index = 1; index < lines.length; index += 2) {
      const header = JSON.parse(lines[index]); const value = JSON.parse(lines[index + 1]);
      result.items.push({ type: header.type, ...(value.transaction ? { transaction: value.transaction } : {}),
        ...(value.contexts?.trace?.status ? { status: value.contexts.trace.status } : {}), ...(Array.isArray(value.spans) ? { spans: value.spans.length } : {}) });
      for (const error of value.exception?.values || []) result.errors.push({ type: header.type, message: `${error.type || 'Error'}: ${error.value || 'Captured product exception'}` });
      if (['error', 'fatal'].includes(value.level) && !value.exception?.values?.length) result.errors.push({ type: header.type, message: value.message || value.logentry?.message || 'Captured product error' });
      if (header.type === 'session' && (value.errors > 0 || ['crashed', 'abnormal'].includes(value.status))) result.errors.push({ type: header.type, message: 'Telemetry session reports product errors' });
    }
  } catch { result.errors.push({ type: 'malformed-envelope', message: 'Known telemetry payload could not be inspected' }); }
  return result;
}

export async function createAlignerFixture(page, options = {}) {
  const manifest = await acceptanceManifest(); let tier = options.tier || 'guest'; let userId = options.userId || 'aligner-reader';
  const narrative = options.narrative || '## Reflection\n\nYour choices remain your own. Choose one small next step.';
  const savedEntries = [...(options.initialEntries || [])]; const annotationRequests = []; const unexpectedRequests = []; const requests = { reading: [], readingHeaders: [] };
  const blockedTelemetry = []; const telemetryErrors = []; const uiErrors = []; const consoleWarnings = []; const apiFailures = []; const expectedAuthUrls = new Set(); const expectedReadingErrors = [];
  page.on('pageerror', error => uiErrors.push({ kind: 'pageerror', message: error.message }));
  page.on('console', message => { const item = { text: message.text(), url: message.location().url }; if (message.type() === 'error') uiErrors.push({ kind: 'console', ...item }); else if (message.type() === 'warning') consoleWarnings.push(item); });
  page.on('response', response => { const url = new URL(response.url()); if (url.origin === manifest.origins.frontend && url.pathname.startsWith('/api/') && response.status() >= 400 && !(response.status() === 401 && expectedAuthUrls.has(response.url()))) apiFailures.push({ path: url.pathname, status: response.status() }); });
  const assertUiHealth = () => {
    const unexpectedErrors = uiErrors.filter(error => !(error.kind === 'console' && (expectedAuthUrls.has(error.url) && /^Failed to load resource:.*401/.test(error.text)
      || /^generatePersonalReading error:/.test(error.text) && expectedReadingErrors.some(message => error.text.includes(message)))));
    expect.soft(unexpectedErrors, 'Unplanned browser/console errors remain failures').toEqual([]); expect.soft(apiFailures, 'Unplanned API failures remain failures').toEqual([]); expect.soft(telemetryErrors, 'Captured telemetry exceptions remain failures').toEqual([]); expect.soft(unexpectedRequests, 'Unknown external or API requests remain failures').toEqual([]); expect.soft(annotationRequests, 'Model annotation attempts remain failures').toEqual([]);
  };
  const control = async (value = null) => {
    const response = await fetch(`${manifest.origins.api}/__aligner_control`, { method: value ? 'POST' : 'GET',
      headers: { 'X-Aligner-Owner': manifest.controlToken, ...(value ? { 'Content-Type': 'application/json' } : {}) }, body: value ? JSON.stringify(value) : undefined });
    if (!response.ok) throw new Error('Owned controlled API unavailable'); return response.json();
  };
  await control({ operation: 'reset' });
  await page.addInitScript(({ initialEntries, tier, userId }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true'); localStorage.setItem('tarot-nudge-state', JSON.stringify({ readingCount: 2, hasSeenRitualNudge: true, hasSeenGestureCoach: true, hasSeenJournalNudge: true, hasDismissedAccountNudge: true, journalSaveCount: 1 }));
    if (!localStorage.getItem('__aligner_seeded')) { localStorage.setItem('__aligner_seeded', 'true'); if (initialEntries.length) localStorage.setItem(tier === 'guest' ? 'tarot_journal' : `tarot_journal_${userId}`, JSON.stringify(initialEntries)); }
  }, { initialEntries: savedEntries, tier, userId });
  await page.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    const telemetry = classifyBlockedTelemetry({ method: request.method(), url: request.url(), body: request.postData() || '' });
    if (telemetry) { blockedTelemetry.push(telemetry); telemetryErrors.push(...telemetry.errors); return route.fulfill({ json: {} }); }
    if (![manifest.origins.frontend, manifest.origins.api].includes(url.origin)) { unexpectedRequests.push({ url: url.origin + url.pathname, method: request.method() }); return route.abort('blockedbyclient'); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const pathname = url.pathname;
    if (/\/visual(?:s|-retry|-replays)?(?:\/|$)/.test(pathname)) { annotationRequests.push({ path: pathname, method: request.method() }); return route.fulfill({ status: 503, json: { error: 'Model annotations disabled in aligner-only acceptance' } }); }
    if (pathname === '/api/auth/me') { if (tier === 'guest') expectedAuthUrls.add(request.url()); return route.fulfill({ status: tier === 'guest' ? 401 : 200, json: { user: tier === 'guest' ? null : { id: userId, username: 'aligner-reviewer', email: 'aligner@example.invalid', subscription_tier: tier, subscription_status: tier === 'free' ? 'inactive' : 'active', subscription_provider: 'stripe' } } }); }
    if (pathname === '/api/auth/logout') { tier = 'guest'; return route.fulfill({ json: { success: true } }); }
    if (pathname === '/api/subscription') return route.fulfill({ json: { subscription: { tier: tier === 'guest' ? 'free' : tier, status: ['plus', 'pro'].includes(tier) ? 'active' : 'inactive', provider: 'stripe' } } });
    if (pathname === '/api/tarot-reading/jobs' && request.method() === 'POST') { requests.reading.push(request.postDataJSON()); requests.readingHeaders.push(request.headers()); return route.fulfill({ json: { jobId: 'aligner-offline-reading', jobToken: 'controlled-narrative-token' } }); }
    if (/^\/api\/tarot-reading\/jobs\/[^/]+\/stream$/.test(pathname)) return route.continue({ url: `${manifest.origins.api}/reading${url.search}` });
    if (pathname.endsWith('/cancel')) return route.fulfill({ json: { status: 'cancelled' } });
    if (pathname === '/api/journal' && request.method() === 'POST') { const body = request.postDataJSON(); const entry = { ...body, id: `aligner-saved-${savedEntries.length + 1}`, ts: Date.now() }; savedEntries.unshift(entry); return route.fulfill({ json: { success: true, entry } }); }
    if (pathname === '/api/journal') return route.fulfill({ json: { entries: savedEntries, pagination: { hasMore: false, total: savedEntries.length } } });
    if (/^\/api\/journal\/[^/]+$/.test(pathname) && !['pattern-alerts'].includes(pathname.split('/').at(-1))) { const entry = savedEntries.find(item => item.id === decodeURIComponent(pathname.split('/').at(-1))); return route.fulfill({ status: entry ? 200 : 404, json: { entry } }); }
    const benign = { '/api/health/tarot-reading': { ok: true }, '/api/health/tts': { ok: true }, '/api/usage': { ok: true, entries: [] },
      '/api/archetype-journey/preferences': { preferences: { archetype_journey_enabled: false } }, '/api/archetype-journey/track': { success: true },
      '/api/journal/pattern-alerts': { alerts: [] }, '/api/memories': { memories: [] }, '/api/share': { shares: [] }, '/api/media': { media: [], items: [] }, '/api/generate-card-video': { enabled: false }, '/api/feedback': { ok: true } };
    if (benign[pathname]) return route.fulfill({ json: benign[pathname] });
    unexpectedRequests.push({ path: pathname, method: request.method() }); return route.fulfill({ status: 503, json: { error: 'offline_api_unconfigured' } });
  });
  return { manifest, narrative, question: options.question || 'How can I make a grounded next step?', requests, annotationRequests, unexpectedRequests, blockedTelemetry, telemetryErrors, uiErrors, consoleWarnings, apiFailures, assertUiHealth, savedEntries,
    setEntries(entries) { savedEntries.splice(0, savedEntries.length, ...entries); }, setTier(value, values = {}) { tier = value; userId = values.userId || userId; },
    async connected(_kind = 'reading', after = 0) { const status = await control(); return status.generation > after ? status.clients : 0; },
    async connectionGeneration() { return (await control()).generation; },
    async emit(kind, event, data) { if (kind !== 'reading') throw new Error('Only controlled narrative transport is admitted'); if (event === 'error' && typeof data.message === 'string') expectedReadingErrors.push(data.message); await expect.poll(() => this.connected()).toBeGreaterThan(0); await control({ operation: 'emit', event, data }); },
    async emitBurst(events) { await expect.poll(() => this.connected()).toBeGreaterThan(0); await control({ operation: 'burst', events }); },
    async disconnect() { await control({ operation: 'disconnect' }); },
    async completeReading() { await this.emit('reading', 'done', { fullText: narrative, requestId: 'aligner-offline', provider: 'controlled-offline' }); await expect(page.getByText('Narrative ready.', { exact: true })).toBeAttached(); },
    async close() { try { if (!page.isClosed()) await page.close(); await control({ operation: 'reset' }); } finally { assertUiHealth(); } }
  };
}

// Observes actual production fetch consumption, DOM phase commits and geometry on one
// browser performance.now clock; no DEV probe or React internal state is used.
export async function observeAligner(page) {
  await page.addInitScript(() => {
    const report = { clock: 'browser performance.now', turnMeasurement: 'DOM committed phase; not compositor paint', source: [], renders: [], turns: [], frameTurns: [], stageMutations: [], batchTransitionViolations: [], visibility: [], phraseVisibility: [], scroll: [] }; window.__alignerObservation = report;
    const originalFetch = window.fetch; window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args); const url = String(args[0]?.url || args[0]);
      if (/\/api\/tarot-reading\/jobs\/[^/]+\/stream/.test(url) && response.body) {
        const originalGetReader = response.body.getReader.bind(response.body); let buffer = ''; const decoder = new TextDecoder();
        response.body.getReader = (...values) => { const reader = originalGetReader(...values); const originalRead = reader.read.bind(reader);
          reader.read = async () => { const result = await originalRead(); if (result.value) { buffer += decoder.decode(result.value, { stream: true }); const blocks = buffer.split(/\r?\n\r?\n/); buffer = blocks.pop() || '';
            for (const block of blocks) { const event = block.match(/^event:\s*(.+)$/m)?.[1]; const raw = block.match(/^data:\s*(.+)$/m)?.[1]; if (event && raw) { try { report.source.push({ at: performance.now(), event, data: JSON.parse(raw) }); } catch { report.source.push({ at: performance.now(), event: 'parse-error', raw }); } } }
          } return result; }; return reader; };
      } return response;
    };
    let previousText = ''; let previousStage = ''; let previousFrameStage = ''; let previousScroll = 0; let batchId = 0; const phraseStates = new Map();
    const readStage = () => { const stage = document.querySelector('[data-gesture-window]'); return stage ? { id: stage.dataset.association, phase: stage.dataset.phase, held: stage.dataset.held === 'true', pending: stage.dataset.pending } : null; };
    document.addEventListener('visibilitychange', () => report.visibility.push({ at: performance.now(), hidden: document.hidden }));
    const sampleExposure = (trigger, mutationBatch = null) => {
      const sampledAt = performance.now();
      for (const element of document.querySelectorAll('.reading-gesture-association, .reading-gesture-identity')) {
        const range = document.createRange(); range.selectNodeContents(element);
        const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
        const bounds = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }; let opacity = 1; let painted = !document.hidden;
        for (let parent = element; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent); opacity *= Number(style.opacity); if (parent.inert || ['hidden', 'collapse'].includes(style.visibility) || style.display === 'none') painted = false;
          const box = parent.getBoundingClientRect(); if (/(hidden|clip|scroll|auto)/.test(style.overflowX)) { bounds.left = Math.max(bounds.left, box.left); bounds.right = Math.min(bounds.right, box.right); }
          if (/(hidden|clip|scroll|auto)/.test(style.overflowY)) { bounds.top = Math.max(bounds.top, box.top); bounds.bottom = Math.min(bounds.bottom, box.bottom); }
        }
        for (const selector of ['.header-sticky', '.gesture-companion']) {
          const overlay = document.querySelector(selector); if (!overlay) continue; const box = overlay.getBoundingClientRect(); const style = getComputedStyle(overlay);
          if (['sticky', 'fixed'].includes(style.position) && box.top <= (parseFloat(style.top) || 0) + 1 && rects.some(rect => rect.left < box.right && rect.right > box.left)) bounds.top = Math.max(bounds.top, box.bottom);
        }
        const exposed = rect => { if (rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom) return false;
          const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2); return Boolean(hit && (element.contains(hit) || hit.contains(element))); };
        const oversized = rects.length > 0 && Math.max(...rects.map(rect => rect.bottom)) - Math.min(...rects.map(rect => rect.top)) > bounds.bottom - bounds.top;
        const value = { id: element.dataset.gestureId, quote: element.textContent, visible: painted && opacity > .01 && rects.length > 0 && (oversized ? rects.some(exposed) : rects.every(exposed)),
          oversized, bounds, rects: rects.map(rect => ({ left: Math.round(rect.left * 10) / 10, top: Math.round(rect.top * 10) / 10, right: Math.round(rect.right * 10) / 10, bottom: Math.round(rect.bottom * 10) / 10 })) };
        const signature = JSON.stringify(value); if (trigger === 'DOM-stage-change' || phraseStates.get(value.id) !== signature) { report.phraseVisibility.push({ at: sampledAt, finishedAt: performance.now(), trigger, batchId: mutationBatch, ...value }); phraseStates.set(value.id, signature); }
      }
    };
    new MutationObserver(records => {
      const at = performance.now(); const batch = ++batchId; const raw = []; const changes = new Map();
      for (let index = 0; index < records.length; index++) {
        const record = records[index]; if (record.type !== 'attributes' || !record.target.matches('[data-gesture-window]')) continue;
        const later = records.slice(index + 1).find(next => next.target === record.target && next.attributeName === record.attributeName);
        const finalValue = record.target.getAttribute(record.attributeName); const changedTo = later ? later.oldValue : finalValue;
        raw.push({ attribute: record.attributeName, oldValue: record.oldValue, changedTo, observedFinalValue: finalValue, observedStageId: record.target.dataset.association, connected: record.target.isConnected });
        if (['data-phase', 'data-association'].includes(record.attributeName) && record.oldValue !== changedTo) {
          let counts = changes.get(record.target); if (!counts) { counts = new Map(); changes.set(record.target, counts); }
          counts.set(record.attributeName, (counts.get(record.attributeName) || 0) + 1);
        }
      }
      if (raw.length) report.stageMutations.push({ at, batchId: batch, records: raw });
      for (const counts of changes.values()) for (const [attribute, count] of counts) if (count > 1) report.batchTransitionViolations.push({ at, batchId: batch, attribute, count });
      const state = readStage(); const key = JSON.stringify(state);
      if (state && key !== previousStage) { report.turns.push({ at, batchId: batch, ...state }); previousStage = key; sampleExposure('DOM-stage-change', batch); }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-phase', 'data-association', 'data-held', 'data-pending'] });
    const sample = () => {
      const text = document.querySelector('.narrative-stream__text')?.textContent || ''; if (text !== previousText) { report.renders.push({ at: performance.now(), text }); previousText = text; }
      const state = readStage(); const key = JSON.stringify(state); if (state && key !== previousFrameStage) { report.frameTurns.push({ at: performance.now(), ...state }); previousFrameStage = key; }
      sampleExposure('animation-frame');
      if (scrollY !== previousScroll) { report.scroll.push({ at: performance.now(), y: scrollY }); previousScroll = scrollY; }
      requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
}
/** Pure geometry/hit inspection. It neither focuses nor scrolls the phrase. */
export function inspectInlineReadingPhrase(element) {
  const doc = element.ownerDocument; const view = doc.defaultView;
  const range = doc.createRange(); range.selectNodeContents(element);
  const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
  const clip = { left: 0, top: 0, right: view.innerWidth, bottom: view.innerHeight }; let opacity = 1; let allowed = !doc.hidden;
  const ancestors = [];
  for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
    const style = view.getComputedStyle(ancestor); opacity *= Number(style.opacity);
    if (ancestor.inert || style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)) allowed = false;
    const box = ancestor.getBoundingClientRect();
    if (/(hidden|clip|scroll|auto)/.test(style.overflowX)) { clip.left = Math.max(clip.left, box.left); clip.right = Math.min(clip.right, box.right); }
    if (/(hidden|clip|scroll|auto)/.test(style.overflowY)) { clip.top = Math.max(clip.top, box.top); clip.bottom = Math.min(clip.bottom, box.bottom); }
    ancestors.push({ tag: ancestor.tagName, id: ancestor.id, className: String(ancestor.className), box: box.toJSON(), overflowX: style.overflowX, overflowY: style.overflowY, scrollLeft: ancestor.scrollLeft, scrollTop: ancestor.scrollTop });
  }
  const fragments = rects.map(rect => {
    const withinClip = rect.left >= clip.left && rect.right <= clip.right && rect.top >= clip.top && rect.bottom <= clip.bottom;
    const hit = doc.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, withinClip, owned: Boolean(hit && element.contains(hit)), hitTag: hit?.tagName, hitClass: String(hit?.className || '') };
  });
  return { at: view.performance.now(), measurement: 'DOM Range geometry and actual midpoint hit ownership', id: element.dataset.gestureId, quote: element.textContent, hidden: doc.hidden, opacity, allowed, clip, fragments, ancestors,
    scroll: { x: view.scrollX, y: view.scrollY, historyLeft: doc.querySelector('#history')?.scrollLeft },
    foreground: allowed && opacity > .01 && fragments.length > 0 && fragments.every(fragment => fragment.withinClip && fragment.owned) };
}

/** Acceptance-only native phrase input: inline quotes have separate painted
 * line fragments, so their union box center is not a valid hit target. */
export async function clickInlineReadingPhrase(locator) {
  await expect.poll(async () => {
    try {
      await locator.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }));
      return (await locator.evaluate(inspectInlineReadingPhrase)).foreground;
    } catch (error) { if (/not attached/.test(error.message)) return false; throw error; }
  }, { timeout: 5000 }).toBe(true);
  await locator.click();
}


/** Pure pre-cue viewport inspection for supported mobile WebKit key input. */
export function inspectReadingViewport(element) {
  const prose = element; const box = prose.getBoundingClientRect();
  const bounds = { left: 0, right: innerWidth, top: 0, bottom: innerHeight }; const overlays = [];
  for (const element of document.querySelectorAll('.header-sticky, .gesture-companion, .mobile-action-bar')) {
    const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= .01 || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= box.left || rect.left >= box.right) continue;
    const lower = style.position === 'fixed' && rect.bottom >= innerHeight - 1;
    const stuck = !lower && ['fixed', 'sticky'].includes(style.position) && rect.top <= (parseFloat(style.top) || 0) + 1;
    if (stuck) bounds.top = Math.max(bounds.top, rect.bottom);
    if (lower) bounds.bottom = Math.min(bounds.bottom, rect.top);
    overlays.push({ className: element.className, rect: rect.toJSON(), position: style.position, top: style.top, bottom: style.bottom, stuck, lower });
  }
  const ancestors = [];
  for (let element = prose; element; element = element.parentElement) {
    const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
    if (/(hidden|clip|scroll|auto)/.test(style.overflowX)) { bounds.left = Math.max(bounds.left, rect.left); bounds.right = Math.min(bounds.right, rect.right); }
    if (/(hidden|clip|scroll|auto)/.test(style.overflowY)) { bounds.top = Math.max(bounds.top, rect.top); bounds.bottom = Math.min(bounds.bottom, rect.bottom); }
    ancestors.push({ tag: element.tagName, id: element.id, className: element.className, rect: rect.toJSON(), scrollTop: element.scrollTop, scrollLeft: element.scrollLeft, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflowX: style.overflowX, overflowY: style.overflowY });
  }
  // Text-node ranges exclude the atmosphere decoration's non-prose geometry.
  const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT); const fragments = []; let text;
  while ((text = walker.nextNode())) {
    if (!text.textContent.includes('Your cards')) continue;
    const range = document.createRange(); range.selectNodeContents(text);
    for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0) {
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      fragments.push({ rect: rect.toJSON(), owned: Boolean(hit && prose.contains(hit)), hit: hit?.outerHTML.slice(0, 180) });
    }
  }
  const geometry = { scrollY, scrollX, viewport: { width: innerWidth, height: innerHeight }, documentHeight: document.documentElement.scrollHeight,
    prose: box.toJSON(), bounds, overlays, ancestors, fragments,
    wholeProseExposed: box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom };
  return geometry;
}

/** Public keyboard input for mobile WebKit, whose Playwright wheel API is
 * unsupported. This is external-keyboard emulation, not touch evidence. */
export async function scrollMobileWebKitDocument(page, { deltaY, pointer, measure, exposed, canContinue, receipt }) {
  const started = Date.now(); const deadline = started + 5000;
  Object.assign(receipt, { input: 'mobile WebKit external-keyboard emulation', started, timeout: 5000, maxKeys: 12, deltaY, pointer, keys: [] });
  const normalize = value => JSON.stringify(value, (key, value) => ['at', 'clock'].includes(key) ? undefined : value);
  const state = () => page.evaluate(() => {
    const stage = document.querySelector('[data-gesture-window]'); const active = document.activeElement; const style = getComputedStyle(active);
    const scrollable = /(auto|scroll|hidden)/.test(style.overflowX) && active.scrollWidth > active.clientWidth + 1 || /(auto|scroll|hidden)/.test(style.overflowY) && active.scrollHeight > active.clientHeight + 1;
    const mainLandmark = active.matches('main#main-content[tabindex="-1"]') && !scrollable;
    const readingLandmark = active.matches('section#step-reading[tabindex="-1"]') && !scrollable;
    const card = document.querySelector('.narrative-stream__text')?.closest('article'); const cardStyle = card ? getComputedStyle(card) : null;
    return { at: performance.now(), scrollX, scrollY, height: innerHeight, hidden: document.hidden,
      documentFocus: active === document.body || active === document.documentElement || mainLandmark || readingLandmark,
      focusOwner: { tag: active.tagName, id: active.id, tabIndex: active.tabIndex, scrollable, mainLandmark, readingLandmark },
      card: card ? { rect: card.getBoundingClientRect().toJSON(), hovered: card.matches(':hover'), transform: cardStyle.transform, transition: cardStyle.transition, className: card.className } : null,
      active: document.activeElement?.tagName, stage: stage ? { association: stage.dataset.association, held: stage.dataset.held, phase: stage.dataset.phase } : null,
      raw: document.querySelector('.narrative-stream__text')?.textContent,
      internal: [...document.querySelectorAll('#history, [data-gesture-shelf], .narrative-stream, .narrative-stream__text, .narrative-panel__column')].map(element => ({ tag: element.tagName, id: element.id, className: element.className, x: element.scrollLeft, y: element.scrollTop })) };
  });
  let validate = null; let previousRoot; receipt.rootTravel = 0;
  const settle = async () => {
    let previous = ''; let unchangedSince = 0;
    while (Date.now() < deadline) {
      const current = { state: await state(), geometry: await measure() }; receipt.latest = current;
      if (previousRoot !== undefined) receipt.rootTravel += Math.abs(current.state.scrollY - previousRoot);
      previousRoot = current.state.scrollY; expect(receipt.rootTravel).toBeLessThanOrEqual(receipt.before.state.height);
      if (validate) validate(current); const signature = normalize(current);
      if (signature !== previous) { previous = signature; unchangedSince = current.state.at; }
      if (current.state.at - unchangedSince >= 250) return current;
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    }
    throw new Error('Mobile WebKit native document scroll exceeded the original five-second bound');
  };
  receipt.beforePointer = { state: await state(), geometry: await measure() }; receipt.before = receipt.beforePointer; previousRoot = receipt.before.state.scrollY;
  await page.mouse.move(pointer.x, pointer.y); receipt.pointerSettled = await settle();
  expect(receipt.pointerSettled.state.scrollY).toBe(receipt.beforePointer.state.scrollY);
  expect(receipt.pointerSettled.state.scrollX).toBe(receipt.beforePointer.state.scrollX);
  expect(receipt.pointerSettled.state.stage).toEqual(receipt.beforePointer.state.stage);
  expect(receipt.pointerSettled.state.raw).toBe(receipt.beforePointer.state.raw);
  expect(receipt.pointerSettled.state.internal).toEqual(receipt.beforePointer.state.internal);
  receipt.before = receipt.pointerSettled;
  const target = await page.evaluate(point => {
    const hit = document.elementFromPoint(point.x, point.y); const ancestors = []; let scrollport = false;
    for (let parent = hit; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll|hidden)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1 || /(auto|scroll|hidden)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1) scrollport = true;
      ancestors.push(`${parent.tagName}#${parent.id}.${String(parent.className).slice(0, 140)}`);
    }
    const focusable = hit?.closest('[tabindex]'); const mainLandmark = Boolean(focusable?.matches('main#main-content[tabindex="-1"]') && !scrollport);
    const readingLandmark = Boolean(focusable?.matches('section#step-reading[tabindex="-1"]') && !scrollport);
    return { mainLandmark, readingLandmark, inViewport: point.x >= 0 && point.x < innerWidth && point.y >= 0 && point.y < innerHeight, present: Boolean(hit),
      interactive: Boolean(hit?.closest('button, a, input, select, textarea, [role="button"], [contenteditable="true"]') || focusable && !mainLandmark && !readingLandmark), scrollport, ancestors };
  }, pointer);
  receipt.background = target;
  expect(target.inViewport && target.present && !target.interactive && !target.scrollport).toBe(true);
  await page.mouse.click(pointer.x, pointer.y);
  receipt.focused = await settle();
  expect(receipt.focused.state.documentFocus).toBe(true);
  expect(normalize(receipt.focused.geometry)).toBe(normalize(receipt.before.geometry));
  expect(receipt.focused.state.scrollY).toBe(receipt.before.state.scrollY);
  const guard = current => {
    expect(current.state.documentFocus).toBe(true); expect(current.state.hidden).toBe(false);
    expect(current.state.stage).toEqual(receipt.before.state.stage); expect(current.state.raw).toBe(receipt.before.state.raw);
    expect(current.state.internal).toEqual(receipt.before.state.internal); expect(current.state.scrollX).toBe(receipt.before.state.scrollX);
    expect(Math.abs(current.state.scrollY - receipt.before.state.scrollY)).toBeLessThanOrEqual(receipt.before.state.height);
  };
  guard(receipt.focused); validate = guard; let previous = receipt.focused;
  const direction = Math.sign(deltaY); expect(direction).not.toBe(0);
  for (let index = 0; index === 0 || !exposed(previous.geometry); index++) {
    expect(index).toBeLessThan(12); expect(Date.now()).toBeLessThan(deadline);
    expect(canContinue(previous.geometry)).toBe(true);
    const key = direction > 0 ? 'ArrowDown' : 'ArrowUp'; const entry = { key, before: previous }; receipt.keys.push(entry);
    await page.keyboard.press(key); entry.after = await settle(); guard(entry.after);
    expect((entry.after.state.scrollY - previous.state.scrollY) * direction).toBeGreaterThan(0);
    if (!exposed(entry.after.geometry)) expect(canContinue(entry.after.geometry)).toBe(true);
    previous = entry.after;
  }
  receipt.after = previous; expect(receipt.keys.length).toBeGreaterThan(0); expect(exposed(previous.geometry)).toBe(true);
  receipt.completed = Date.now(); expect(receipt.completed - started).toBeLessThanOrEqual(5000);
  return receipt;
}

export async function attachAlignerEvidence(page, testInfo, fixture, extra = {}) {
  const observation = await page.evaluate(() => window.__alignerObservation || null);
  await testInfo.attach('aligner-production-evidence', { body: JSON.stringify({ runId: fixture.manifest.runId, sourceDigest: fixture.manifest.snapshotDigest,
    outputDigest: fixture.manifest.outputDigest, project: testInfo.project.name, auth: { controlled: true, tier: extra.tier || 'guest' },
    clientAnnotationRequests: fixture.annotationRequests, unexpectedRequests: fixture.unexpectedRequests, blockedTelemetry: fixture.blockedTelemetry, telemetryErrors: fixture.telemetryErrors, uiErrors: fixture.uiErrors, consoleWarnings: fixture.consoleWarnings, apiFailures: fixture.apiFailures, observation, ...extra }, null, 2), contentType: 'application/json' });
}
