import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createReadingCueRelay, createCueRunIdentity, DEFAULT_CUE_CANDIDATES } from '../../scripts/evaluation/lib/visualCueEvaluationHarness.mjs';
import { buildIndependentReadingSchedule } from './readingCueBrowserScoring.mjs';
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

const timingRoots = ['src/components/ReadingGesturesFixture.jsx', 'src/components/StreamingNarrative.jsx',
  'src/components/reading/narrative/SpreadCompanion.jsx', 'src/contexts/ReadingContext.jsx', 'src/hooks/useReadingVisualJob.js',
  'src/lib/readingCueTimingProbe.js', 'e2e/helpers/readingCueBrowserCollector.mjs', 'e2e/helpers/readingCueBrowserScoring.mjs',
  'e2e/helpers/readingCueBrowserSession.mjs', 'e2e/helpers/readingCueFrontend.mjs', 'e2e/reading-cue-qualification.spec.js',
  'output/reading-motion/react-bridge.playwright.config.mjs', 'vite.config.js', 'package-lock.json',
  'package.json', 'index.html', 'postcss.config.cjs', 'tailwind.config.js', 'public/theme-bootstrap.js',
  ...['inter', 'source-serif-4'].flatMap(font => ['normal', 'italic'].map(style =>
    `node_modules/@fontsource-variable/${font}/files/${font}-latin-opsz-${style}.woff2`))];
export async function createCueTimingIdentity({ caseData, candidate, deliveryMode, viewport, motionPreference, live, lane = 'automatic', sourceMode = 'sse', reader = true }) {
  const dispatchConfiguration = { deliveryMode, viewport, motionPreference, lane, sourceMode, readerEnabled: reader,
    readerSchedule: buildIndependentReadingSchedule(caseData.raw), sourceProjection: 'exact-parser-leaves-v1', minimumExposureMs: 600 };
  const backend = await createCueRunIdentity({ cases: [caseData], candidates: [candidate], phase: 'timing', live, dispatchConfiguration });
  // Vite resolves extensionless JSX imports and CSS asset URLs. Bind the
  // complete tracked frontend/shared tree plus explicit untracked task roots,
  // rather than pretending Node's exact-path ESM closure resolves Vite graphs.
  const execute = promisify(execFile);
  const tracked = (await execute('git', ['ls-files', '-z', 'src', 'shared', 'public/fonts'])).stdout.split('\0').filter(Boolean);
  const helperClosure = await createCueRunIdentity({ cases: [caseData], candidates: [candidate], phase: 'timing', live,
    dispatchConfiguration, relevantPaths: timingRoots.filter(path => !path.startsWith('src/')) });
  const paths = [...new Set([...tracked, ...timingRoots, ...Object.keys(helperClosure.fileDigests),
    ...caseData.cards.map(c => c.artwork.assetPath).filter(Boolean)])].sort();
  const fileDigests = Object.fromEntries(await Promise.all(paths.map(async path => [path, cueDigest(await readFile(path))])));
  const head = (await execute('git', ['rev-parse', 'HEAD'])).stdout.trim();
  const dirtyPaths = (await execute('git', ['status', '--porcelain', '--untracked-files=all'])).stdout.split('\n')
    .filter(line => Object.hasOwn(fileDigests, line.slice(3))).map(line => line.slice(3)).sort();
  const frontendSnapshot = { head, dirtyPaths, fileDigests, dispatchConfiguration };
  const frontend = { ...frontendSnapshot, digest: cueDigest(frontendSnapshot) };
  if (backend.head !== frontend.head) throw new Error('Backend/frontend snapshot changed during identity capture');
  return { backend, frontend, dispatchConfiguration, digest: cueDigest({ backend: backend.digest, frontend: frontend.digest, dispatchConfiguration }) };
}

export async function openCueBrowserSession({ page, frontend, caseData, candidate = DEFAULT_CUE_CANDIDATES[0], aiAdapter,
  live = false, budget, deliveryMode = 'paced', sourceMode = 'sse', viewport = { width: 1100, height: 1000 },
  motionPreference = 'no-preference', lane = 'automatic', outputDir, reader = true }) {
  if (page.url() !== 'about:blank') throw new Error('Each timing session requires a fresh page');
  if (live && !budget) throw new Error('Live browser sessions require the existing shared round budget');
  if (!outputDir) throw new Error('A new immutable timing evidence directory is required');
  await mkdir(outputDir); // Existing evidence is never overwritten.
  const identity = await createCueTimingIdentity({ caseData, candidate, deliveryMode, viewport, motionPreference, live, lane, sourceMode, reader });
  await writeFile(join(outputDir, 'identity.json'), JSON.stringify(identity, null, 2), { flag: 'wx' });
  const relay = await createReadingCueRelay({ caseData, candidate, aiAdapter, live, budget, schedule: deliveryMode,
    sourceMode, frontendOrigin: frontend.origin, runId: `browser:${identity.digest}:${randomUUID()}` });
  let fixture;
  const network = { blocked: [], loadedAssets: [], failedAssets: [] };
  const assetRecord = request => { const url = new URL(request.url()); return { origin: url.origin, path: url.pathname, type: request.resourceType() }; };
  const asset = request => ['font', 'image', 'stylesheet', 'document'].includes(request.resourceType());
  page.on('response', response => { if (asset(response.request())) network.loadedAssets.push({ ...assetRecord(response.request()), status: response.status() }); });
  page.on('requestfailed', request => { if (asset(request)) network.failedAssets.push(assetRecord(request)); });
  try {
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
    })();` });
    fixture = await createNarrativeFixture(page, { relayOrigin: relay.origin, narrative: caseData.raw });
    await page.goto(`${frontend.origin}/__e2e/reading-gestures?study=${caseData.id === 'star-2347-excerpt' ? 'star' : 'five-card'}&sourceMode=job-sse&associations=dynamic`);
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
      await page.waitForFunction(revision => Number(document.querySelector('[data-testid="gesture-source-diagnostics"]')?.dataset.ledgerRevision) === revision,
        server.ledger.ledgerRevision, { timeout: 5000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const browser = await page.evaluate(() => window.__cueBrowser.stop());
      const fonts = await page.evaluate(() => ({ status: document.fonts.status, faces: [...document.fonts].map(f => ({ family: f.family, style: f.style, status: f.status })) }));
      const current = await createCueTimingIdentity({ caseData, candidate, deliveryMode, viewport, motionPreference, live, lane, sourceMode, reader });
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
      const result = { browser, server, timing, network, fonts, sameSnapshot, identityDigest: identity.digest,
        scope: { auth: 'mock Pro', prose: 'controlled recorded delivery', model: live ? 'explicit live adapter' : 'offline fake',
          sourceMode, directJsonConsumers: 'outside qualified app-job observer', viewport: 'emulation, not physical device',
          requestContext: 'relay selected frozen metadata authoritative; ordinary app request general reflectionsText remains empty' } };
      await writeFile(join(outputDir, 'report.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
      return result;
    }, async close() { await fixture.close(); await relay.close(); },
    async assertIdentityUnchanged() {
      const saved = JSON.parse(await readFile(join(outputDir, 'identity.json'), 'utf8'));
      return saved.digest === identity.digest;
    }
  };
}
