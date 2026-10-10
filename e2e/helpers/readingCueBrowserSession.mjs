import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createReadingCueRelay, createCueRunIdentity, DEFAULT_CUE_CANDIDATES, buildCueDeliverySchedule } from '../../scripts/evaluation/lib/visualCueEvaluationHarness.mjs';
import { buildIndependentReadingSchedule, traceCueBrowserOpportunities, scoreCueBrowserReport } from './readingCueBrowserScoring.mjs';
import { installCueBrowserCollector } from './readingCueBrowserCollector.mjs';
import { createNarrativeFixture } from './narrativeFixtures.js';
import { cueDigest } from '../../scripts/evaluation/lib/visualCueEvaluationBudget.mjs';

export function createOfflineOpportunityAdapter(caseData, { empty = false, beforeResponse } = {}) {
  return { offline: true, async run(model, input, options) {
    await beforeResponse?.({ model, input, options });
    const prompt = input.messages.find(m => m.role === 'user').content;
    const prefix = prompt.split('Reading Text to Analyze:\n"""\n')[1]?.split('\n"""')[0] || '';
    const ready = empty ? [] : caseData.opportunities.filter(o => o.anchors[0].end <= prefix.length);
    // Deterministic model-output stand-in only. Real prompt/provider/job/ledger
    // still validate each proposal; no client ledger or sidecar is fabricated.
    const proposals = ready.map(o => ({ localAlias: `o${caseData.opportunities.indexOf(o)}`, kind: o.kind,
      quote: o.anchors[0].quote, targets: o.targets,
      ...(o.establishedByOpportunityIds.length ? { establishedBy: o.establishedByOpportunityIds.map(id => ({ localAlias: `o${caseData.opportunities.findIndex(o => o.id === id)}` })) } : {}),
      ...(o.personalContext ? { personalContext: o.personalContext } : {}) }));
    return { response: JSON.stringify({ proposals }), model, usage: { prompt_tokens: 10, completion_tokens: 10 } };
  } };
}

export function buildIdealCueArrivalSchedule(caseData, { mode, activeMs, deliveryMode = 'paced' }) {
  const events = buildCueDeliverySchedule(caseData.raw, deliveryMode);
  const reader = buildIndependentReadingSchedule(caseData.raw);
  let previous = -activeMs;
  const releases = caseData.opportunities.map(o => {
    const sourceAtMs = events.find(e => e.end >= o.anchors[0].end).atMs - events[0].atMs;
    const readerAtMs = reader.steps.find(s => s.end > o.anchors[0].start).atMs;
    const atMs = mode === 'reader-aligned' ? readerAtMs : Math.max(sourceAtMs, previous + activeMs);
    previous = atMs;
    return { opportunityId: o.id, sourceAtMs, atMs, expectedSourceLagMs: atMs - sourceAtMs,
      anchor: o.anchors[0], kind: o.kind };
  });
  const lags = releases.map(r => r.expectedSourceLagMs).sort((a, b) => a - b);
  return { mode, clock: 'browser performance.now relative to first source render', activeMs,
    method: mode === 'reader-aligned' ? 'independent reader anchor-start deadlines'
      : 'earliest source-order releases spaced by the existing full active phase',
    provider: 'already validated real-job offline cue subsets; fixture stream and revision sequence',
    expectedP95LagMs: lags[Math.ceil(lags.length * .95) - 1], expectedMaxLagMs: Math.max(...lags), releases };
}

// Serialized fixture transport only. Reading delivery, reader and renderer stay untouched.
function installIdealCueArrival(schedule) {
  const original = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!/\/api\/tarot-reading\/visuals\/[^/]+\/stream(?:\?|$)/.test(url)) return original(input, options);
    const encoder = new TextEncoder();
    const signal = options.signal || input.signal;
    let cancelled = false; let revision = 0; let signature = ''; let timer;
    window.__cueIdealArrival = { schedule, releases: [], lastRevision: 0, complete: false };
    const stream = new ReadableStream({ start(controller) {
      const tick = async () => {
        if (cancelled) return;
        try {
          const originalEnvelope = await window.__cueIdealEnvelope();
          if (cancelled) return;
          const start = window.__cueBrowser.report.window.start;
          const now = performance.now();
          if (start !== null && originalEnvelope.cueLedger) {
            const due = schedule.releases.filter(r => start + r.atMs <= now);
            const cues = originalEnvelope.cueLedger.cues.filter(c => due.some(r => c.kind === r.kind
              && c.passage.start >= r.anchor.start && c.passage.end <= r.anchor.end));
            const complete = originalEnvelope.status === 'complete' && cues.length === schedule.releases.length;
            const next = JSON.stringify([originalEnvelope.cueLedger.raw, cues.map(c => c.id), complete]);
            if (next !== signature) {
              signature = next; revision += 1;
              const cueLedger = { ...originalEnvelope.cueLedger, cues, ledgerRevision: revision };
              const envelope = { binding: originalEnvelope.binding, cueLedger, cues,
                introductions: cueLedger.introductions, ledgerRevision: revision, eventId: revision,
                status: complete ? 'complete' : 'running', error: null };
              const record = { at: now, originalServerLedgerRevision: originalEnvelope.ledgerRevision,
                fixtureLedgerRevision: revision, cueIds: cues.map(c => c.id), dueOpportunityIds: due.map(r => r.opportunityId) };
              window.__cueIdealArrival.releases.push(record);
              window.__cueIdealArrival.lastRevision = revision;
              window.__cueIdealArrival.complete = complete;
              controller.enqueue(encoder.encode(`event: ${complete ? 'done' : 'cues'}\ndata: ${JSON.stringify(envelope)}\n\n`));
              if (complete) { controller.close(); cancelled = true; return; }
            }
          }
        } catch (error) { controller.error(error); cancelled = true; return; }
        timer = setTimeout(tick, 20);
      };
      signal?.addEventListener('abort', () => { if (cancelled) return; cancelled = true; clearTimeout(timer); controller.close(); }, { once: true });
      tick();
    }, cancel() { cancelled = true; clearTimeout(timer); } });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  };
}

const timingRoots = ['src/components/ReadingGesturesFixture.jsx', 'src/components/StreamingNarrative.jsx',
  'src/components/reading/narrative/SpreadCompanion.jsx', 'src/contexts/ReadingContext.jsx', 'src/hooks/useReadingVisualJob.js',
  'src/lib/readingCueTimingProbe.js', 'e2e/helpers/readingCueBrowserCollector.mjs', 'e2e/helpers/readingCueBrowserScoring.mjs',
  'e2e/helpers/readingCueBrowserSession.mjs', 'e2e/helpers/readingCueFrontend.mjs', 'e2e/reading-cue-qualification.spec.js',
  'output/reading-motion/react-bridge.playwright.config.mjs', 'vite.config.js', 'package-lock.json',
  'package.json', 'index.html', 'postcss.config.cjs', 'tailwind.config.js', 'public/theme-bootstrap.js',
  ...['inter', 'source-serif-4'].flatMap(font => ['normal', 'italic'].map(style =>
    `node_modules/@fontsource-variable/${font}/files/${font}-latin-opsz-${style}.woff2`))];
export async function createCueTimingIdentity({ caseData, candidate, deliveryMode, viewport, motionPreference, live, lane = 'automatic', sourceMode = 'sse', reader = true, cueArrival = 'production-scheduler', servedSnapshotDigest = null }) {
  const activeMs = Number((await readFile('src/components/reading/narrative/narrativeGestureState.js', 'utf8')).match(/const ACTIVE_MS = (\d+);/)[1]);
  const injectionSchedule = cueArrival === 'production-scheduler' ? null : buildIdealCueArrivalSchedule(caseData, { mode: cueArrival, activeMs, deliveryMode });
  const dispatchConfiguration = { deliveryMode, viewport, motionPreference, lane, sourceMode, readerEnabled: reader,
    readerSchedule: buildIndependentReadingSchedule(caseData.raw), sourceProjection: 'exact-parser-leaves-v1', minimumExposureMs: 600,
    cueArrival, injectionSchedule };
  const backend = await createCueRunIdentity({ cases: [caseData], candidates: [candidate], phase: 'timing', live, dispatchConfiguration });
  // Vite resolves extensionless JSX imports and CSS asset URLs. Bind the
  // complete tracked frontend/shared tree plus explicit untracked task roots,
  // rather than pretending Node's exact-path ESM closure resolves Vite graphs.
  const execute = promisify(execFile);
  const sourcePaths = [];
  const enumerate = async directory => {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT' && directory === 'public/fonts') return; throw error; }
    for (const entry of entries) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await enumerate(path);
      else if (entry.isFile()) sourcePaths.push(path);
    }
  };
  for (const directory of ['src', 'shared', 'public/fonts']) await enumerate(directory);
  const helperClosure = await createCueRunIdentity({ cases: [caseData], candidates: [candidate], phase: 'timing', live,
    dispatchConfiguration, relevantPaths: timingRoots.filter(path => !path.startsWith('src/')) });
  const paths = [...new Set([...sourcePaths, ...timingRoots, ...Object.keys(helperClosure.fileDigests),
    ...caseData.cards.map(c => c.artwork.assetPath).filter(Boolean)])].sort();
  const fileDigests = Object.fromEntries(await Promise.all(paths.map(async path => [path, cueDigest(await readFile(path))])));
  const head = (await execute('git', ['rev-parse', 'HEAD'])).stdout.trim();
  const dirtyPaths = (await execute('git', ['status', '--porcelain', '--untracked-files=all'])).stdout.split('\n')
    .filter(line => Object.hasOwn(fileDigests, line.slice(3))).map(line => line.slice(3)).sort();
  // A borrowed Task 13 runtime serves its own immutable snapshot; these digests
  // then describe the invoking checkout, not the served bytes.
  const frontendSnapshot = { head, dirtyPaths, gitProvenance: servedSnapshotDigest
    ? 'invoking checkout only; the served immutable snapshot is bound by servedSnapshotDigest'
    : 'enclosing worktree only; actual served tree bound by fileDigests', servedSnapshotDigest, fileDigests, dispatchConfiguration };
  const frontend = { ...frontendSnapshot, digest: cueDigest(frontendSnapshot) };
  if (backend.head !== frontend.head) throw new Error('Backend/frontend snapshot changed during identity capture');
  return { backend, frontend, dispatchConfiguration, digest: cueDigest({ backend: backend.digest, frontend: frontend.digest, dispatchConfiguration }) };
}

export async function openCueBrowserSession({ page, frontend, caseData, candidate = DEFAULT_CUE_CANDIDATES[0], aiAdapter,
  live = false, budget, deliveryMode = 'paced', sourceMode = 'sse', viewport = { width: 1100, height: 1000 },
  motionPreference = 'no-preference', lane = 'automatic', outputDir, reader = true, cueArrival = 'production-scheduler' }) {
  if (page.url() !== 'about:blank') throw new Error('Each timing session requires a fresh page');
  if (live && !budget) throw new Error('Live browser sessions require the existing shared round budget');
  if (!['production-scheduler', 'source-active-phase', 'reader-aligned'].includes(cueArrival) || (live && cueArrival !== 'production-scheduler')) throw new Error('Ideal arrival is an explicitly offline fixture only');
  if (!outputDir) throw new Error('A new immutable timing evidence directory is required');
  await mkdir(outputDir); // Existing evidence is never overwritten.
  const servedSnapshotDigest = frontend.buildIdentity?.snapshotDigest ?? null;
  const identity = await createCueTimingIdentity({ caseData, candidate, deliveryMode, viewport, motionPreference, live, lane, sourceMode, reader, cueArrival, servedSnapshotDigest });
  await writeFile(join(outputDir, 'identity.json'), JSON.stringify(identity, null, 2), { flag: 'wx' });
  const relay = await createReadingCueRelay({ caseData, candidate, aiAdapter, live, budget, schedule: deliveryMode,
    sourceMode, frontendOrigin: frontend.origin, runId: `browser:${identity.digest}:${randomUUID()}` });
  let fixture;
  const network = { blocked: [], loadedAssets: [], failedAssets: [] };
  const consoleHealth = { errors: [], warnings: [], pageErrors: [] };
  page.on('console', message => {
    if (message.type() === 'error') consoleHealth.errors.push(message.text());
    if (message.type() === 'warning') consoleHealth.warnings.push(message.text());
  });
  page.on('pageerror', error => consoleHealth.pageErrors.push(error.message));
  const assetRecord = request => { const url = new URL(request.url()); return { origin: url.origin, path: url.pathname, type: request.resourceType() }; };
  const asset = request => ['font', 'image', 'stylesheet', 'document'].includes(request.resourceType());
  page.on('response', response => { if (asset(response.request())) network.loadedAssets.push({ ...assetRecord(response.request()), status: response.status() }); });
  page.on('requestfailed', request => { if (asset(request)) network.failedAssets.push(assetRecord(request)); });
  try {
    if (cueArrival !== 'production-scheduler') await page.exposeFunction('__cueIdealEnvelope', () => relay.session.job.envelope());
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if ([frontend.origin, relay.origin].includes(url.origin) || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      network.blocked.push({ origin: url.origin, type: route.request().resourceType() });
      return route.abort('blockedbyclient');
    });
    await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: motionPreference });
    const bootstrap = { value: { id: caseData.id, raw: caseData.raw, cards: caseData.cards, spreadKey: caseData.spreadKey,
      userQuestion: caseData.question, reflectionsText: caseData.reflections },
    collectorConfig: { caseId: caseData.id, raw: caseData.raw, opportunities: caseData.opportunities,
      deliveryMode, lane, reader, readerSchedule: identity.dispatchConfiguration.readerSchedule } };
    // One script: Playwright does not promise ordering between init scripts.
    await page.addInitScript({ content: `(() => {
      const bootstrap = ${JSON.stringify(bootstrap)};
      localStorage.setItem('tarot-onboarding-complete', 'true');
      window.__cueQualificationCase = bootstrap.value;
      (${installCueBrowserCollector.toString()})(bootstrap.collectorConfig);
      const schedule = ${JSON.stringify(identity.dispatchConfiguration.injectionSchedule)};
      if (schedule) (${installIdealCueArrival.toString()})(schedule);
    })();` });
    fixture = await createNarrativeFixture(page, { relayOrigin: relay.origin, narrative: caseData.raw });
    await page.goto(`${frontend.origin}/__e2e/reading-gestures?study=${caseData.id === 'star-2347-excerpt' ? 'star' : 'five-card'}&sourceMode=job-sse&associations=dynamic`);
    if (frontend.buildIdentity) {
      const actualLane = await page.evaluate(() => ({ reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio }));
      if (actualLane.reducedMotion !== (motionPreference === 'reduce')) throw new Error('Actual session motion preference mismatch.');
      await writeFile(join(outputDir, 'actual-runtime-lane.json'), JSON.stringify({ ...actualLane, requestedViewport: viewport,
        requestedMotion: motionPreference, browserVersion: page.context().browser()?.version(),
        runId: frontend.buildIdentity.runId, snapshotDigest: frontend.buildIdentity.snapshotDigest, physicalDevice: false }, null, 2), { flag: 'wx' });
    }
    await page.waitForFunction(() => document.querySelector('[data-testid="gesture-source-diagnostics"]')?.dataset.ledgerRevision != null
      || document.querySelector('[data-testid="gesture-source-diagnostics"]')?.dataset.runId.startsWith('cue:'), null, { timeout: 15000 });
    relay.startSchedule();
  } catch (error) { await fixture?.close(); await relay.close(); throw error; }
  return { relay, identity, fixture, outputDir,
    async waitForReader() { await page.waitForFunction(() => window.__cueBrowser?.report.window.end !== null, null,
      { timeout: identity.dispatchConfiguration.readerSchedule.durationMs + 30000 }); },
    async finish() {
      await page.evaluate(() => window.__cueBrowser.endWindow(performance.now(), 'scenario-end-censored'));
      // The browser window is already closed; late model settlement cannot
      // enlarge the passage/availability/accompaniment denominator window.
      const server = await relay.completion;
      // Keep transport accounting observable after the frozen window closes.
      const arrival = await page.evaluate(() => window.__cueIdealArrival || null);
      await page.waitForFunction(revision => Number(document.querySelector('[data-testid="gesture-source-diagnostics"]')?.dataset.ledgerRevision) === revision,
        arrival?.lastRevision ?? server.ledger.ledgerRevision, { timeout: 5000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const browser = await page.evaluate(() => window.__cueBrowser.stop());
      const fonts = await page.evaluate(() => ({ status: document.fonts.status, faces: [...document.fonts].map(f => ({ family: f.family, style: f.style, status: f.status })) }));
      const pageHealth = await page.evaluate(() => ({ url: location.href, title: document.title,
        proseLength: document.querySelector('.narrative-stream__text')?.textContent.length || 0,
        frameworkOverlay: Boolean(document.querySelector('vite-error-overlay')) }));
      const current = await createCueTimingIdentity({ caseData, candidate, deliveryMode, viewport, motionPreference, live, lane, sourceMode, reader, cueArrival, servedSnapshotDigest });
      const sameSnapshot = identity.digest === current.digest;
      browser.measurementValid = sameSnapshot && !browser.truncated && browser.sourceProjectionErrors.length === 0
        && browser.sourceDigests.some(d => d.sha256 === server.narrativeRawSha256);
      const timing = {
        browserClock: 'performance.now', serverClock: 'Date.now; never subtracted from browser',
        annotationBatches: browser.serverTimingEvents.map(e => ({ ledgerRevision: e.ledgerRevision,
          schedulerWaitMs: e.serverAnnotationStartedAt - e.serverAvailableAt,
          modelAndValidationMs: e.serverAnnotationFinishedAt - e.serverAnnotationStartedAt,
          commitDelayMs: e.serverLedgerCommittedAt - e.serverAnnotationFinishedAt })),
        providerRoundTripsMs: server.inferenceAttempts.map(a => a.latency_ms),
        growingPrefixRequests: server.attempts.map(a => ({ analyzedEnd: a.registration.analyzedEnd,
          analyzedHash: a.registration.analyzedHash, inputTokens: a.usage?.inputTokens ?? null })),
        totalInputTokens: server.attempts.every(a => Number.isFinite(a.usage?.inputTokens))
          ? server.attempts.reduce((n, a) => n + a.usage.inputTokens, 0) : null,
        prefixOnlyResentTokens: null, prefixOnlyTokenLimit: 'Provider usage includes whole prompt; source-only token attribution unavailable',
        narrativeCompletionAtBrowser: browser.completionAt
      };
      const result = { browser, server, timing, network, fonts, consoleHealth, pageHealth, sameSnapshot, identityDigest: identity.digest, cueArrival, arrival,
        scope: { auth: 'mock Pro', prose: 'controlled recorded delivery', model: live ? 'explicit live adapter' : 'offline fake',
          sourceMode, directJsonConsumers: 'outside qualified app-job observer', viewport: 'emulation, not physical device',
          requestContext: 'relay selected frozen metadata authoritative; ordinary app request general reflectionsText remains empty' } };
      await writeFile(join(outputDir, 'report.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
      if (!live) {
        const score = scoreCueBrowserReport({ report: browser, opportunities: caseData.opportunities, cues: server.ledger.cues, offline: true });
        await writeFile(join(outputDir, 'opportunity-traces.json'), JSON.stringify(traceCueBrowserOpportunities({ report: browser,
          opportunities: caseData.opportunities, cues: server.ledger.cues, score }), null, 2), { flag: 'wx' });
      }
      return result;
    }, async close() { await fixture.close(); await relay.close(); },
    async assertIdentityUnchanged() {
      const saved = JSON.parse(await readFile(join(outputDir, 'identity.json'), 'utf8'));
      return saved.digest === identity.digest;
    }
  };
}
