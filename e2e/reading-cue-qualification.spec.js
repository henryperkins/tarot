import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadReadingCueCases } from '../scripts/evaluation/lib/readingCueQualification.mjs';
import { startCueQualificationFrontend } from './helpers/readingCueFrontend.mjs';
import { openCueBrowserSession, createOfflineOpportunityAdapter } from './helpers/readingCueBrowserSession.mjs';
import { scoreCueBrowserReport } from './helpers/readingCueBrowserScoring.mjs';

const cases = await loadReadingCueCases();
const star = cases.find(c => c.id === 'star-2347-excerpt');
const five = cases.find(c => c.id === 'five-card-creative-project');
let frontend; let evidence;
test.beforeAll(async () => {
  evidence = await mkdtemp('output/reading-motion/evidence/cue-qualification/task5-browser-');
  frontend = await startCueQualificationFrontend();
  await writeFile(join(evidence, 'ownership.json'), JSON.stringify({ pid: frontend.pid, origin: frontend.origin,
    inertPort: frontend.inertPort, stateDir: frontend.stateDir, credentialsInherited: false }, null, 2), { flag: 'wx' });
});
test.afterAll(async () => {
  if (frontend) await writeFile(join(evidence, 'cleanup.json'), JSON.stringify(await frontend.close()), { flag: 'wx' });
});

async function open(page, name, options = {}) {
  const caseData = options.caseData || star;
  return openCueBrowserSession({ page, frontend, caseData, aiAdapter: createOfflineOpportunityAdapter(caseData),
    outputDir: join(evidence, name), ...options });
}
async function sourceReady(page, c = star) {
  await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-raw-length', String(c.raw.length), { timeout: 50000 });
  await expect(page.locator('.narrative-stream__text [data-cue-source-start]').first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.__cueBrowser.report.narrativeEvents.some(e => e.complete))).toBe(true);
}

for (const deliveryMode of ['paced', 'burst', 'final-only']) {
  test(`${deliveryMode}: independent Star passage timing through real production jobs`, async ({ page }) => {
    const session = await open(page, deliveryMode, { deliveryMode });
    try {
      await sourceReady(page);
      await session.waitForReader();
      const result = await session.finish();
      expect(result.sameSnapshot).toBe(true);
      expect(result.server.narrativeSourceMatchesCase).toBe(true);
      expect(result.server.ledger.raw).toBe(star.raw);
      expect(result.browser.narrativeEvents.length).toBeGreaterThan(0);
      expect(result.browser.cueReceipts.length).toBeGreaterThan(0);
      expect(result.browser.passageEvents).toHaveLength(6);
      expect(new Set(result.browser.passageIntervals.filter(p => p.withinAutomaticWindow).map(p => p.opportunityId)).size).toBe(6);
      expect(result.browser.passageIntervals.filter(p => p.withinAutomaticWindow).every(p => p.end <= result.browser.window.end)).toBe(true);
      expect(result.browser.sourceProjectionErrors).toEqual([]);
      expect(result.browser.sourceDigests.some(d => d.sha256 === result.server.narrativeRawSha256)).toBe(true);
      expect(result.browser.unexpectedScrolls).toEqual([]);
      expect(result.browser.layout.maxProseStartDriftPx).toBe(0);
      expect(result.browser.layout.maxOverflowPx).toBe(0);
      expect(result.browser.window.end).toBe(result.browser.scheduledEndpoint);
      expect(result.browser.completionAt).toBeLessThan(result.browser.window.end);
      const score = scoreCueBrowserReport({ report: result.browser, opportunities: star.opportunities,
        cues: result.server.ledger.cues, offline: true });
      await writeFile(join(session.outputDir, 'scores.json'), JSON.stringify(score, null, 2), { flag: 'wx' });
      expect(score.availability.denominator).toBe(6);
      if (deliveryMode !== 'paced') {
        expect(score.availability.numerator).toBe(6);
        expect(score.accompaniment.passed).toBe(false);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: join(session.outputDir, 'desktop.png'), fullPage: true });
    } finally { await session.close(); }
  });
}

test('missing cues retain independent opportunities and upstream JSON observer is measured separately', async ({ page }) => {
  const session = await open(page, 'upstream-json-empty', { deliveryMode: 'final-only', sourceMode: 'json',
    aiAdapter: createOfflineOpportunityAdapter(star, { empty: true }) });
  try {
    await sourceReady(page); await session.waitForReader();
    const result = await session.finish();
    expect(result.server.sourceMode).toBe('json');
    expect(result.server.scheduleEvents[0].type).toBe('json-completion');
    expect(result.server.attempts.length).toBeGreaterThan(0);
    expect(result.browser.cueReceipts).toEqual([]);
    expect(new Set(result.browser.passageIntervals.filter(p => p.withinAutomaticWindow).map(p => p.opportunityId)).size).toBe(6);
      expect(result.browser.passageIntervals.filter(p => p.withinAutomaticWindow).every(p => p.end <= result.browser.window.end)).toBe(true);
    const score = scoreCueBrowserReport({ report: result.browser, opportunities: star.opportunities, offline: true });
    expect(score.availability.numerator).toBe(0); expect(score.availability.denominator).toBe(6);
  } finally { await session.close(); }
});

for (const motionPreference of ['no-preference', 'reduce']) {
  test(`phone ${motionPreference}: static reduced motion and explicit revisit preserve prose layout`, async ({ page }) => {
    const session = await open(page, `phone-${motionPreference}`, { deliveryMode: 'final-only', lane: 'lifecycle',
      reader: false, viewport: { width: 390, height: 844 }, motionPreference });
    try {
      await sourceReady(page);
      await expect(page.locator('[data-gesture-id]')).toHaveCount(6);
      const phrase = page.locator('[data-gesture-id]').filter({ hasText: 'one pitcher into a pool' });
      await phrase.scrollIntoViewIfNeeded();
      const before = await phrase.boundingBox();
      const scroll = await page.evaluate(() => scrollY);
      await phrase.click();
      const stage = page.locator('[data-gesture-window]');
      await expect(stage).toHaveAttribute('data-held', 'true');
      const heldId = await stage.getAttribute('data-association');
      await page.waitForTimeout(700);
      expect(await stage.getAttribute('data-association')).toBe(heldId);
      expect(await phrase.boundingBox()).toEqual(before);
      expect(await page.evaluate(() => scrollY)).toBe(scroll);
      await page.screenshot({ path: join(session.outputDir, 'phone-revisit.png') });
      await page.keyboard.press('Escape');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (motionPreference === 'reduce') expect(await stage.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
      const result = await session.finish();
      expect(result.browser.sourceProjectionErrors).toEqual([]);
      expect(result.browser.sourceDigests.some(d => d.sha256 === result.server.narrativeRawSha256)).toBe(true);
      expect(result.browser.heldIntervals.length).toBeGreaterThan(0);
      if (motionPreference === 'reduce') expect(result.browser.stageAdoptions.filter(a => a.origin === 'automatic')).toEqual([]);
    } finally { await session.close(); }
  });
}

test('held literal wins through continuing text completion and metadata', async ({ page }) => {
  const session = await open(page, 'held-through-completion', { deliveryMode: 'paced', lane: 'lifecycle', reader: false });
  try {
    const phrase = page.locator('[data-gesture-id]').filter({ hasText: 'one pitcher into a pool' });
    await expect(phrase).toBeVisible(); await phrase.click();
    const heldId = await page.locator('[data-gesture-window]').getAttribute('data-association');
    await sourceReady(page);
    await expect(page.locator('[data-gesture-id]')).toHaveCount(6);
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-association', heldId);
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    await expect(phrase).toBeFocused();
    const result = await session.finish();
    expect(result.server.narrativeSourceMatchesCase).toBe(true);
    expect(result.browser.heldIntervals.length).toBeGreaterThan(0);
    expect(result.browser.heldIntervals.every(interval => interval.cueId === heldId)).toBe(true);
    expect(result.browser.heldIntervals[0].end).toBeGreaterThan(result.browser.completionAt);
  } finally { await session.close(); }
});

for (const deliveryMode of ['paced', 'burst', 'final-only']) test(`full five-card ${deliveryMode} reading uses independent 180-wpm deadline and supports paired revisit`, async ({ page }) => {
  const session = await open(page, `five-card-${deliveryMode}`, { caseData: five, deliveryMode });
  try {
    await sourceReady(page, five); await session.waitForReader();
    const server = await session.relay.completion;
    const pair = server.ledger.cues.find(c => c.kind === 'relationship' && c.targets.some(t => t.spreadIndex === 0) && c.targets.some(t => t.spreadIndex === 2));
    expect(pair).toBeTruthy();
    const phrase = page.locator(`[data-gesture-id="${pair.id}"]`);
    await phrase.scrollIntoViewIfNeeded(); const before = await phrase.boundingBox();
    await phrase.click();
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    await expect(page.locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]')).toHaveCount(2);
    expect(await phrase.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: join(session.outputDir, 'pair-revisit.png') });
    await page.waitForTimeout(700);
    const result = await session.finish();
    expect(result.sameSnapshot).toBe(true); expect(result.server.narrativeSourceMatchesCase).toBe(true);
    expect(result.browser.sourceProjectionErrors).toEqual([]);
      expect(result.browser.sourceDigests.some(d => d.sha256 === result.server.narrativeRawSha256)).toBe(true);
    expect(result.browser.unexpectedScrolls).toEqual([]);
      expect(result.browser.layout.maxProseStartDriftPx).toBe(0);
      expect(result.browser.layout.maxOverflowPx).toBe(0);
    expect(result.browser.readerSteps).toHaveLength(904);
    const score = scoreCueBrowserReport({ report: result.browser, opportunities: five.opportunities, cues: result.server.ledger.cues, offline: true });
    expect(score.availability.denominator).toBe(25);
    await writeFile(join(session.outputDir, 'scores.json'), JSON.stringify(score, null, 2), { flag: 'wx' });
    expect(result.browser.detailExposures.some(e => e.cueId === pair.id && e.origin === 'explicit' && e.targets.length === 2)).toBe(true);
  } finally { await session.close(); }
});

test('late visible cue is not superseded by a later offscreen cue', async ({ page }) => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const session = await open(page, 'late-visible-offscreen', { caseData: five, deliveryMode: 'final-only', lane: 'offscreen', reader: false,
    aiAdapter: createOfflineOpportunityAdapter(five, { beforeResponse: () => gate }) });
  try {
    await sourceReady(page, five);
    const anchor = five.opportunities.find(o => o.id.endsWith(':ace-sprout')).anchors[0];
    await page.evaluate(a => {
      const projected = window.__cueBrowser.projection(a.start, a.end);
      const rect = projected.fragments[0].range.getBoundingClientRect();
      scrollTo({ top: scrollY + rect.top - 350, behavior: 'instant' });
    }, anchor);
    await page.waitForTimeout(700);
    release();
    await expect.poll(() => session.relay.session.job.ledger.cues.length).toBe(25);
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-phase', /active|settling/);
    const id = await page.locator('[data-gesture-window]').getAttribute('data-association');
    const cue = session.relay.session.job.ledger.cues.find(c => c.id === id);
    expect(cue.passage.end).toBeLessThan(1800);
    await expect(page.locator(`[data-gesture-id="${id}"]`)).toBeInViewport();
    await page.waitForTimeout(3500);
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-phase', 'static');
    expect(await page.locator('[data-gesture-window]').getAttribute('data-association')).toBe(id);
    const result = await session.finish();
    expect(result.browser.stageAdoptions.filter(a => a.origin === 'automatic').length).toBeLessThanOrEqual(2);
    const score = scoreCueBrowserReport({ report: result.browser, opportunities: five.opportunities, cues: result.server.ledger.cues, offline: true });
    expect(score.availability.denominator).toBe(0);
  } finally { release(); await session.close(); }
});

test('reconnect duplicates do not restart settled automatic motion', async ({ page }) => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const session = await open(page, 'reconnect', { deliveryMode: 'paced', lane: 'lifecycle', reader: false,
    aiAdapter: createOfflineOpportunityAdapter(star, { beforeResponse: ({ input }) => input.messages[1].content.includes('Neither pitcher gets dropped.') ? gate : undefined }) });
  try {
    await sourceReady(page);
    await expect(page.locator('[data-gesture-id]')).not.toHaveCount(0);
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-phase', 'static', { timeout: 10000 });
    const adopted = await page.evaluate(() => window.__cueBrowser.report.stageAdoptions.filter(a => a.origin === 'automatic').length);
    const receipts = await page.evaluate(() => window.__cueBrowser.report.cueReceipts.length);
    const before = await page.locator('[data-gesture-window]').getAttribute('data-association');
    session.relay.session.job.closeSubscribers();
    await expect.poll(() => page.evaluate(() => window.__cueBrowser.report.cueReceipts.length)).toBeGreaterThan(receipts);
    await page.waitForTimeout(700);
    expect(await page.locator('[data-gesture-window]').getAttribute('data-association')).toBe(before);
    expect(await page.evaluate(() => window.__cueBrowser.report.stageAdoptions.filter(a => a.origin === 'automatic').length)).toBe(adopted);
    release();
    const result = await session.finish();
    expect(result.browser.sourceProjectionErrors).toEqual([]);
    expect(session.fixture.requests.visual.length).toBeGreaterThan(1);
  } finally { release(); await session.close(); }
});

test('outgoing production source replacement resets held focus and rejects stale visual work', async ({ page }) => {
  const replacement = 'The reading has changed at its authoritative completion. This replacement contains no described artwork, and the old source must no longer own any visible card gesture. The text remains available while independent annotation catches up.';
  let release; const gate = new Promise(resolve => { release = resolve; });
  const session = await open(page, 'source-replacement', { deliveryMode: 'paced', lane: 'replacement', reader: false,
    aiAdapter: createOfflineOpportunityAdapter(star, { beforeResponse: ({ input }) => input.messages[1].content.includes('Neither pitcher gets dropped.') ? gate : undefined }) });
  const append = session.relay.readingJob.appendEvent.bind(session.relay.readingJob);
  session.relay.readingJob.appendEvent = (type, data) => append(type, type === 'done' ? { ...data, fullText: replacement } : data);
  try {
    const phrase = page.locator('[data-gesture-id]').filter({ hasText: 'one pitcher into a pool' });
    await expect(phrase).toBeVisible(); await phrase.click();
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-source-revision', '1');
    release();
    await expect(page.locator('.narrative-stream__text')).toHaveText(replacement);
    await expect(page.locator('[data-gesture-window]')).not.toHaveAttribute('data-held', 'true');
    await expect(page.locator('[data-gesture-id]')).toHaveCount(0);
    const result = await session.finish();
    expect(result.server.narrativeSourceMatchesCase).toBe(false);
    expect(result.browser.renderEvents.some(e => e.sourceRevision === 1)).toBe(true);
    expect(result.browser.heldIntervals[0].endReason).toBe('source-replaced');
    await writeFile(join(session.outputDir, 'replacement-boundary.json'), JSON.stringify({
      method: 'actual ReadingJob.appendEvent(done) argument replacement before the only outgoing done',
      automaticTimingEligible: false, originalIdentityDigest: result.identityDigest,
      replacementHash: result.server.narrativeRawSha256, sourceRevision: 1,
      upstreamReplacementTransport: 'not tested'
    }, null, 2), { flag: 'wx' });
  } finally { release(); await session.close(); }
});

test('real completed ledger restored from local journal is static with explicit revisit', async ({ page }) => {
  const session = await open(page, 'restored', { deliveryMode: 'final-only', lane: 'restored', reader: false });
  try {
    await sourceReady(page); await expect(page.locator('[data-gesture-id]')).toHaveCount(6);
    const result = await session.finish();
    const ledger = result.server.ledger;
    const entry = { id: 'qualified-local-restore', ts: Date.now(), personalReading: star.raw,
      question: star.question, reflections: star.reflections, deckId: 'rws-1909',
      cards: star.cards.map(c => ({ name: c.card, position: c.position, orientation: c.orientation })),
      readingResultId: ledger.binding.readingResultId, visualBinding: ledger.binding,
      visual: { binding: ledger.binding, status: 'complete', ledgerRevision: ledger.ledgerRevision, snapshot: ledger } };
    await page.evaluate(e => localStorage.setItem('tarot_journal', JSON.stringify([e])), entry);
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { user: null } }));
    await page.goto(`${frontend.origin}/__e2e/journal-visual`);
    const restored = page.getByTestId('restored-reading-gestures');
    await expect(restored).toBeVisible();
    await expect(restored.locator('[data-gesture-window]')).not.toHaveAttribute('data-phase', /active|settling/);
    const cue = ledger.cues.find(c => c.kind === 'literal');
    const phrase = page.locator(`[data-gesture-id="${cue.id}"]`);
    await phrase.scrollIntoViewIfNeeded(); await phrase.click();
    await expect(restored.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    expect(await restored.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
    await page.screenshot({ path: join(session.outputDir, 'restored.png'), fullPage: true });
    await page.waitForTimeout(700);
    const restoredReport = await page.evaluate(() => window.__cueBrowser.stop());
    expect(restoredReport.cueReceipts).toEqual([]);
    expect(restoredReport.detailExposures.some(e => e.origin === 'explicit')).toBe(true);
    await writeFile(join(session.outputDir, 'restored-browser.json'), JSON.stringify(restoredReport, null, 2), { flag: 'wx' });
  } finally { await session.close(); }
});

test('late post-window cue receipts cannot extend the automatic reading window', async ({ page }) => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const session = await open(page, 'post-window', { deliveryMode: 'final-only',
    aiAdapter: createOfflineOpportunityAdapter(star, { beforeResponse: () => gate }) });
  try {
    await sourceReady(page); await session.waitForReader();
    const endpoint = await page.evaluate(() => window.__cueBrowser.report.window.end);
    release();
    const result = await session.finish();
    expect(result.browser.window.end).toBe(endpoint);
    expect(new Set(result.browser.cueReceipts.map(e => e.cueId)).size).toBe(6);
    expect(result.browser.cueReceipts.every(e => e.at > endpoint)).toBe(true);
    const score = scoreCueBrowserReport({ report: result.browser, opportunities: star.opportunities, cues: result.server.ledger.cues, offline: true });
    expect(score.availability.numerator).toBe(0); expect(score.availability.denominator).toBe(6);
    expect(score.accompaniment.qualifiedExposures).toEqual([]);
  } finally { release(); await session.close(); }
});

test('unobserved frames cannot be credited as continuous exposure', async ({ page }) => {
  const session = await open(page, 'frame-gap', { deliveryMode: 'final-only', lane: 'lifecycle', reader: false });
  try {
    await sourceReady(page); await expect(page.locator('[data-gesture-id]')).toHaveCount(6);
    await expect.poll(() => page.evaluate(() => window.__cueBrowser.report.detailExposures.some(e => e.end === null))).toBe(true);
    const gapCount = await page.evaluate(() => window.__cueBrowser.report.samplingGaps.length);
    await page.evaluate(() => { const until = performance.now() + 250; while (performance.now() < until) { /* Controlled missing-frame negative control. */ } });
    await expect.poll(() => page.evaluate(() => window.__cueBrowser.report.samplingGaps.length)).toBeGreaterThan(gapCount);
    // Controlled Page Visibility negative control, not physical-tab coverage.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const result = await session.finish();
    expect(result.browser.visibilityEvents.some(e => e.hidden)).toBe(true);
    expect(result.browser.detailExposures.some(e => e.endReason === 'unobserved-frame-gap')).toBe(true);
    for (const gap of result.browser.samplingGaps) expect(result.browser.detailExposures.some(e => e.start < gap.start && e.end > gap.end)).toBe(false);
  } finally { await session.close(); }
});

for (const motionPreference of ['no-preference', 'reduce']) test(`five-card phone ${motionPreference} paired relationship is visible without prose jump`, async ({ page }) => {
  const session = await open(page, `five-phone-${motionPreference}`, { caseData: five, deliveryMode: 'final-only', lane: 'lifecycle', reader: false,
    viewport: { width: 390, height: 844 }, motionPreference });
  try {
    await sourceReady(page, five);
    const server = await session.relay.completion;
    const pair = server.ledger.cues.find(c => c.kind === 'relationship' && c.targets.some(t => t.spreadIndex === 0) && c.targets.some(t => t.spreadIndex === 2));
    const phrase = page.locator(`[data-gesture-id="${pair.id}"]`);
    await phrase.scrollIntoViewIfNeeded();
    const before = await phrase.boundingBox(); await phrase.click();
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    await expect(page.locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]')).toHaveCount(2);
    await page.waitForTimeout(700);
    expect(await phrase.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: join(session.outputDir, 'phone-pair.png') });
    const result = await session.finish();
    expect(result.browser.sourceProjectionErrors).toEqual([]);
    if (motionPreference === 'reduce') expect(result.browser.stageAdoptions.filter(a => a.origin === 'automatic')).toEqual([]);
  } finally { await session.close(); }
});
