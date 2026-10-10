#!/usr/bin/env node
/** Versioned, explicitly bounded qualification phases. Standalone execution defaults offline. */
import { mkdir, readFile, writeFile, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomInt, randomUUID } from 'node:crypto';
import { parseCueEvaluationArgs } from './evaluateReadingCueModel.mjs';
import { createVisualCueSession, createCueRunIdentity, buildCueDeliverySchedule, DEFAULT_CUE_CANDIDATES,
  CUE_PRICING_SNAPSHOT, openCueRoundBudget, createWorkersAiRestAdapter } from './lib/visualCueEvaluationHarness.mjs';
import { loadReadingCueCases, scoreReadingCueRun } from './lib/readingCueQualification.mjs';
import { cueDigest } from './lib/visualCueEvaluationBudget.mjs';
import { canonicalVisualCueJSON } from '../../shared/contracts/visualCueBatches.js';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const immutableJSON = (path, value) => writeFile(path, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
const timingCaseIds = ['star-2347-excerpt', 'five-card-creative-project'];

/** Cancellation is scoped to explicit owned objects; never scans or kills listeners. */
export function createCueRoundOwnership({ signals = true } = {}) {
  const controller = new AbortController();
  const resources = new Map();
  const cleanup = [];
  let stopping;
  let stopped = false;
  const closeOne = async (resource, kind, cancel) => {
    let complete = true;
    if (cancel && resource.cancel) {
      try { await resource.cancel(); } catch { complete = false; }
    }
    if (resource.finish && kind === 'session') {
      try { await resource.finish(); } catch { complete = false; }
    }
    if (resource.close) {
      try { await resource.close(); } catch { complete = false; }
    }
    cleanup.push({ kind, complete });
  };
  const owner = {
    signal: controller.signal, cleanup,
    get stopped() { return stopped; },
    own(resource, kind = 'resource') {
      resources.set(resource, kind);
      if (stopped) void owner.stop(controller.signal.reason);
      return resource;
    },
    release(resource) { resources.delete(resource); },
    async stop(reason = 'exception') {
      stopped = true;
      if (stopping) {
        await stopping;
        if (!resources.size) return cleanup;
        stopping = null;
      }
      // Install the promise before synchronous abort callbacks can reenter stop.
      if (!stopping) {
        stopping = Promise.resolve().then(async () => {
          if (!controller.signal.aborted) controller.abort(reason);
          while (resources.size) {
            const batch = [...resources];
            // Settle owned sessions before closing browser/frontend transports.
            batch.sort(([, left], [, right]) => (left === 'session' ? -1 : right === 'session' ? 1 : 0));
            for (const [resource, kind] of batch) {
              if (!resources.delete(resource)) continue;
              await closeOne(resource, kind, true);
            }
          }
          return cleanup;
        });
      }
      return stopping;
    },
    async close() {
      for (const [resource, kind] of [...resources].reverse()) {
        if (!resources.delete(resource)) continue;
        await closeOne(resource, kind, false);
      }
      return cleanup;
    },
    dispose() { for (const [name, handler] of handlers) process.removeListener(name, handler); }
  };
  const handlers = signals ? ['SIGINT', 'SIGTERM'].map(name => [name, () => { void owner.stop(name); }]) : [];
  for (const [name, handler] of handlers) process.on(name, handler);
  return owner;
}

/** Only stable rates/docs hashes enter round identity; retrieval time is separate evidence. */
export async function verifyCueLivePreflight({ candidates, fetchImpl = globalThis.fetch } = {}) {
  const models = {};
  const documents = [];
  for (const model of [...new Set(candidates.map(c => c.model))]) {
    const name = model.split('/').at(-1);
    const url = `https://developers.cloudflare.com/workers-ai/models/${name}/index.md`;
    const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Official availability/pricing preflight unavailable.');
    const text = await response.text();
    const context = text.match(/Context Window[^\n]*?([\d,]+)\s*tokens/i);
    const input = text.match(/\$([\d.]+)\s+per M input tokens/i);
    const output = text.match(/\$([\d.]+)\s+per M output tokens/i);
    const cached = text.match(/\$([\d.]+)\s+per M cached input tokens/i);
    if (!text.includes(model) || !context || !input || !output || !cached
      || !/Reasoning[^\n]*low[^\n]*high/.test(text)) throw new Error('Official model pricing/context bound unsupported; dispatch stopped.');
    const rate = { contextWindowTokens: Number(context[1].replaceAll(',', '')), inputUsdPerMillion: Number(input[1]),
      outputUsdPerMillion: Number(output[1]), cachedInputUsdPerMillion: Number(cached[1]), reasoningEfforts: ['low', 'high', 'max'] };
    if (!Number.isSafeInteger(rate.contextWindowTokens) || rate.contextWindowTokens < 1
      || ![rate.inputUsdPerMillion, rate.outputUsdPerMillion, rate.cachedInputUsdPerMillion].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Official pricing/context bound invalid.');
    models[model] = rate;
    documents.push({ url, sha256: cueDigest(text), status: response.status, model });
  }
  return { retrievedAt: new Date().toISOString(), availableModels: Object.keys(models), documents,
    pricing: { models, method: 'execution-time official model documentation', documents } };
}

export async function verifyCueLiveCatalog({ accountId, apiToken, candidates, fetchImpl = globalThis.fetch } = {}) {
  if (!/^[a-f0-9]{32}$/i.test(accountId || '') || typeof apiToken !== 'string' || !apiToken) throw new Error('Explicit account catalog configuration required.');
  const availableModels = [];
  const evidence = [];
  for (const model of [...new Set(candidates.map(c => c.model))]) {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`);
    url.searchParams.set('search', model); url.searchParams.set('per_page', '100');
    const response = await fetchImpl(url.href, { redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${apiToken}` } });
    let envelope;
    try { envelope = await response.json(); } catch { throw new Error('Authenticated model catalog unavailable.'); }
    if (!response.ok || envelope?.success !== true || !Array.isArray(envelope.result) || !envelope.result.some(row => row.name === model)) throw new Error('Authenticated model catalog unavailable.');
    availableModels.push(model);
    evidence.push({ model, status: response.status, endpoint: 'Cloudflare account model search', catalogSha256: cueDigest(envelope.result) });
  }
  return { availableModels, evidence, retrievedAt: new Date().toISOString() };
}

/** Independent packets retain every trial; reversible model/cue joins stay in a separate private artifact. */
export function createBlindedCuePackets({ results = [] } = {}) {
  const joins = [];
  const packets = results.map(result => {
    const packetId = randomUUID();
    const cues = result.ledger?.cues || [];
    const ids = new Map(cues.map(cue => [cue.id, randomUUID()]));
    const safeCues = cues.map(cue => ({ id: ids.get(cue.id), kind: cue.kind,
      passage: { start: cue.passage?.start, end: cue.passage?.end }, quote: cue.passage?.quote ?? cue.quote,
      targets: (cue.targets || []).map(target => ({ spreadIndex: target.spreadIndex, detailIds: target.detailIds || [] })),
      ...(cue.personalContext ? { personalContext: Object.fromEntries(['type', 'quote', 'spreadIndex'].filter(key => Object.hasOwn(cue.personalContext, key)).map(key => [key, cue.personalContext[key]])) } : {}),
      ...(cue.establishedBy ? { establishedBy: cue.establishedBy.map(id => {
        if (!ids.has(id)) throw new Error('Blinded cue dependency missing from trial.');
        return ids.get(id);
      }) } : {}) }));
    joins.push({ packetId, candidateId: result.candidateId, caseId: result.caseId, trialId: result.trialId,
      cueIds: Object.fromEntries(ids) });
    return { packetId, caseId: result.caseId, trialId: result.trialId,
      status: result.analysisComplete || result.status === 'complete' ? 'complete' : 'incomplete',
      raw: result.ledger?.raw || '', cues: safeCues };
  });
  // Presentation randomness is independent of frozen candidate dispatch order;
  // the private packet-ID join is the only authoritative model mapping.
  for (let index = packets.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [packets[index], packets[other]] = [packets[other], packets[index]];
  }
  return { packets, joins };
}

function validateOptions({ phase, candidates, maxCalls, maxEstimatedUsd }) {
  if (!['semantic', 'timing', 'all'].includes(phase) || !Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 600
    || !Number.isFinite(maxEstimatedUsd) || maxEstimatedUsd <= 0 || maxEstimatedUsd > 15) throw new Error('Invalid qualification phase/ceilings.');
  const selected = candidates.map(value => typeof value === 'string' ? DEFAULT_CUE_CANDIDATES.find(c => c.id === value) : value);
  if (!selected.length || selected.some(c => !c || !DEFAULT_CUE_CANDIDATES.some(known => canonicalVisualCueJSON(known) === canonicalVisualCueJSON(c)))
    || new Set(selected.map(c => c.id)).size !== selected.length) throw new Error('Unknown/duplicate qualification candidates.');
  return structuredClone(selected);
}

function buildPlans(cases, candidates) {
  const parents = cases.filter(c => ['recorded-reading', 'recorded-excerpt'].includes(c.provenance.sourceKind)).map(c => c.id);
  const expectedTrials = [{ trialId: 'repeat-1', caseIds: cases.map(c => c.id) }, ...(parents.length ? [{ trialId: 'repeat-2', caseIds: parents }] : [])];
  const semantic = candidates.flatMap(c => expectedTrials.flatMap(t => t.caseIds.map(caseId => ({ candidateId: c.id, caseId, trialId: t.trialId }))));
  const timing = candidates.flatMap(c => timingCaseIds.flatMap(caseId => ['paced', 'burst', 'final-only'].map(scenario => {
    const caseData = cases.find(item => item.id === caseId);
    if (!caseData) return { candidateId: c.id, caseId, scenario, callsUpperBound: 0, skipReason: 'missing-required-timing-case', schedule: [] };
    const schedule = buildCueDeliverySchedule(caseData.raw, scenario).map(({ text: _text, fullText: _fullText, ...event }) => event);
    // At most one request per unique observation prefix; final-only has one.
    return { candidateId: c.id, caseId, scenario, schedule, callsUpperBound: new Set(schedule.map(event => event.end)).size };
  })));
  return { semantic, timing, expectedTrials };
}

export async function runCueQualificationRound({ live = false, phase = 'all', manifest, candidates = DEFAULT_CUE_CANDIDATES,
  outputDir, roundId, roundBudgetPath, maxCalls = 600, maxEstimatedUsd = 15, explicitLiveConfiguration = null } = {}) {
  candidates = validateOptions({ phase, candidates, maxCalls, maxEstimatedUsd });
  if (manifest && typeof manifest === 'object') manifest = structuredClone(manifest);
  if (live && !explicitLiveConfiguration) throw new Error('Explicit live configuration required.');
  if (live && (!roundId || !roundBudgetPath)) throw new Error('Explicit new shared live round path/id required.');
  if (typeof roundId === 'string' && (/(?:^|[^0-9])183(?:[^0-9]|$)/.test(roundId) || ['live-20261010-task6', 'reading-cue-qualification-20261010-task6'].includes(roundId))) throw new Error('Historical 183-attempt round is closed.');
  const cases = await loadReadingCueCases({ manifest });
  const frozenManifest = typeof manifest === 'object' && manifest ? manifest : JSON.parse(await readFile(manifest || join(repositoryRoot, 'scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json'), 'utf8'));
  if (!Array.isArray(frozenManifest.candidateOrder) || candidates.some(c => !frozenManifest.candidateOrder.includes(c.id))) throw new Error('Invalid frozen candidate order.');
  candidates.sort((left, right) => frozenManifest.candidateOrder.indexOf(left.id) - frozenManifest.candidateOrder.indexOf(right.id));
  const allPlans = buildPlans(cases, candidates);
  outputDir = resolve(outputDir || join(repositoryRoot, `output/reading-motion/evidence/cue-round-${Date.now()}-${randomUUID()}`));
  await mkdir(dirname(outputDir), { recursive: true });
  try { await mkdir(outputDir, { mode: 0o700 }); } catch (error) { if (error.code === 'EEXIST') throw new Error('Immutable phase output directory already exists.'); throw error; }
  const owner = createCueRoundOwnership();
  let budget;
  let report;
  try {
    let preflightEvidence = { retrievedAt: CUE_PRICING_SNAPSHOT.retrievedAt, pricing: CUE_PRICING_SNAPSHOT, availableModels: candidates.map(c => c.model), status: 'historical-unverified-current; offline only' };
    let aiAdapter;
    if (live) {
      // Validate explicit credentials/catalog before public preflight, without discovery.
      aiAdapter = createWorkersAiRestAdapter({ ...explicitLiveConfiguration, live: true });
      preflightEvidence = await verifyCueLivePreflight({ candidates });
      if (candidates.some(c => !aiAdapter.availableModels.includes(c.model))) throw new Error('Explicit account model catalog incomplete.');
      const catalog = await verifyCueLiveCatalog({ candidates, accountId: explicitLiveConfiguration.accountId, apiToken: explicitLiveConfiguration.apiToken });
      preflightEvidence = { ...preflightEvidence, availableModels: catalog.availableModels, catalog };
    }
    const identity = await createCueRunIdentity({ cases, phase: 'round-definition-v2', candidates, live,
      dispatchConfiguration: { version: 2, maxCalls, maxEstimatedUsd, plans: allPlans, manifestSha256: cueDigest(frozenManifest),
        pricingSha256: cueDigest(preflightEvidence.pricing), documents: preflightEvidence.documents || [],
        deliveryWordsPerSecond: 25, readerWordsPerMinute: 180, temperature: 0, maxCompletionTokens: 8192, deadlineMs: 60000 },
      catalog: preflightEvidence.availableModels });
    const definition = { version: 2, identity, candidates, plans: allPlans, digest: identity.digest };
    roundId ??= `cue-round:${definition.digest}`;
    budget = await openCueRoundBudget({ path: roundBudgetPath || join(outputDir, 'offline-round.json'), roundId,
      maxCalls, maxEstimatedUsd, mode: live ? 'live' : 'offline', pricing: preflightEvidence.pricing });
    await budget.bindDefinition(definition.digest);
    const phaseId = `phase:${randomUUID()}`;
    await budget.registerPhase({ phaseId, definitionSha256: definition.digest });
    const initialBudget = await budget.snapshot();
    const phaseBudget = { ...budget, reserve: options => budget.reserve({ ...options, registration: { ...options.registration, phase: phaseId } }) };
    const plan = { expectedTrials: allPlans.expectedTrials, semantic: phase === 'timing' ? [] : allPlans.semantic, timing: phase === 'semantic' ? [] : allPlans.timing };
    let upperCost = 0;
    const affordability = [];
    for (const candidate of candidates) {
      const decision = await budget.canReserve({ candidate });
      const calls = plan.semantic.filter(item => item.candidateId === candidate.id).length
        + plan.timing.filter(item => item.candidateId === candidate.id).reduce((sum, item) => sum + item.callsUpperBound, 0);
      upperCost += calls * (decision.reservedUsd || 0);
      affordability.push({ candidateId: candidate.id, callsUpperBound: calls, ...decision });
    }
    report = { version: 2, runId: `cue:${definition.digest}`, roundId, phaseId, phase, live, definition, plan, initialBudget,
      preflight: { semanticCallsUpperBound: plan.semantic.length, timingCallsUpperBound: plan.timing.reduce((sum, p) => sum + p.callsUpperBound, 0),
        conservativeUsdUpperBound: upperCost, remainingUsd: maxEstimatedUsd - initialBudget.heldUsd,
        wholePlanFits: upperCost <= maxEstimatedUsd - initialBudget.heldUsd && plan.semantic.length + plan.timing.reduce((n, p) => n + p.callsUpperBound, 0) <= maxCalls - initialBudget.attempts.length,
        affordability, inputBoundVerifier: 'unavailable; documented context bound retained', official: preflightEvidence },
      semantic: [], timing: [], modelCalls: 0, fakeDispatches: 0, qualified: false, fullyQualified: false,
      independentSemanticComplete: false, independentTimingComplete: false, admissionComplete: false, accountingComplete: false,
      baselineRetained: 'glm-5.3-flash-low', selectedCandidate: null, incompleteReasons: [] };
    await immutableJSON(join(outputDir, 'definition.json'), definition);
    await immutableJSON(join(outputDir, 'plan.json'), plan);
    await immutableJSON(join(outputDir, 'preflight.json'), report.preflight);
    let terminal = null;
    for (const item of plan.semantic) {
      if (!live || owner.stopped || terminal) { report.semantic.push({ ...item, status: 'incomplete', reason: terminal || (owner.stopped ? 'cancelled-before-dispatch' : 'offline-plan-only'), attempts: [] }); continue; }
      const session = await createVisualCueSession({ caseData: cases.find(c => c.id === item.caseId), candidate: candidates.find(c => c.id === item.candidateId),
        aiAdapter, live, budget: phaseBudget, runId: report.runId, trialId: item.trialId });
      const owned = owner.own({ cancel: () => session.cancel(), finish: () => session.finish(), close: async () => session.db.sqlite.close() }, 'session');
      if (owner.stopped) { await session.cancel(); } else await session.observe(cases.find(c => c.id === item.caseId).raw, { complete: true });
      const result = await session.finish(); report.semantic.push(result); terminal ||= result.fatalReason;
      if (!owner.stopped) { await owned.close(); owner.release(owned); }
    }
    if (live && plan.timing.some(item => !item.skipReason) && !owner.stopped && !terminal) {
      const { startCueQualificationFrontend } = await import('../../e2e/helpers/readingCueFrontend.mjs');
      const { openCueBrowserSession } = await import('../../e2e/helpers/readingCueBrowserSession.mjs');
      const { chromium } = await import('@playwright/test');
      const frontend = owner.own(await startCueQualificationFrontend(), 'frontend');
      const browser = owner.own(await chromium.launch({ headless: true }), 'browser');
      for (const item of plan.timing) {
        if (item.skipReason || owner.stopped || terminal) { report.timing.push({ ...item, status: 'incomplete', reason: item.skipReason || terminal || 'cancelled-before-dispatch' }); continue; }
        const context = owner.own(await browser.newContext(), 'context');
        let measured;
        try {
          const page = await context.newPage();
          const session = await openCueBrowserSession({ page, frontend, caseData: cases.find(c => c.id === item.caseId), candidate: candidates.find(c => c.id === item.candidateId),
            aiAdapter, live, budget: phaseBudget, deliveryMode: item.scenario, outputDir: join(outputDir, `timing-${report.timing.length}`) });
          measured = owner.own({ cancel: () => session.relay.close(), finish: () => session.relay.session.finish(), close: async () => {
            try { await session.close(); } finally { session.relay.session.db.sqlite.close(); }
          } }, 'session');
          await session.waitForReader();
          const result = await session.finish();
          report.timing.push({ ...item, ...result, modelEvaluationComplete: result.server.analysisComplete && result.server.admissionComplete && result.server.accountingComplete,
            status: result.server.analysisComplete ? 'complete' : 'incomplete' });
          terminal ||= result.server.fatalReason;
        } finally {
          if (measured) { await measured.close(); owner.release(measured); }
          await context.close(); owner.release(context);
        }
      }
    }
    for (const item of plan.timing) if (!report.timing.some(result => result.caseId === item.caseId && result.candidateId === item.candidateId && result.scenario === item.scenario)) {
      report.timing.push({ ...item, status: 'incomplete', reason: item.skipReason || terminal || (owner.stopped ? 'cancelled-before-dispatch' : 'offline-plan-only') });
    }
    if (owner.stopped) { await owner.stop(); await budget.halt(); }
    else await owner.close();
  } catch (error) {
    await owner.stop('exception');
    if (!report) {
      await immutableJSON(join(outputDir, 'terminal.json'), { version: 2, phase, status: 'configuration-before-dispatch', modelCalls: 0,
        qualified: false, cleanup: owner.cleanup, budget: budget ? await budget.snapshot() : null });
      throw error;
    }
    report.incompleteReasons.push('runner-exception');
    if (budget) await budget.halt();
  } finally { owner.dispose(); }
  // Every item remains in the planned denominator, including thrown/aborted work.
  for (const item of report.plan.semantic) if (!report.semantic.some(result => result.caseId === item.caseId && result.candidateId === item.candidateId && result.trialId === item.trialId)) report.semantic.push({ ...item, status: 'incomplete', reason: 'terminal-stop', attempts: [] });
  for (const item of report.plan.timing) if (!report.timing.some(result => result.caseId === item.caseId && result.candidateId === item.candidateId && result.scenario === item.scenario)) report.timing.push({ ...item, status: 'incomplete', reason: 'terminal-stop' });
  report.budget = await budget.snapshot();
  report.phaseAttemptIds = report.budget.attempts.filter(a => a.registration.phase === report.phaseId).map(a => a.id);
  report.modelCalls = live ? report.phaseAttemptIds.length : 0;
  report.accountingComplete = report.budget.measuredCostComplete && [...report.semantic, ...report.timing.map(r => r.server || r)].every(r => r.accountingComplete === true);
  report.admissionComplete = [...report.semantic, ...report.timing.map(r => r.server || r)].every(r => r.admissionComplete === true);
  report.cleanup = owner.cleanup;
  report.scores = candidates.map(candidate => ({ id: candidate.id, fullyQualified: false, score: scoreReadingCueRun({ cases, expectedTrials: report.plan.expectedTrials,
    ledgers: report.semantic.filter(r => r.candidateId === candidate.id && r.analysisComplete).map(r => ({ caseId: r.caseId, trialId: r.trialId, ledger: r.ledger })) }) }));
  report.incompleteReasons.push('independent-output-adjudication-required', 'independent-browser-and-accompaniment-inputs-required',
    ...(!live ? ['offline-plan-only; not model evidence'] : []), ...(!report.admissionComplete ? ['model-admission-incomplete'] : []),
    ...(!report.accountingComplete ? ['accounting-incomplete'] : []), ...(owner.stopped ? ['round-interrupted-or-exception'] : []));
  const { packets, joins } = createBlindedCuePackets({ results: report.semantic });
  await immutableJSON(join(outputDir, 'blind-packets.json'), packets);
  await immutableJSON(join(outputDir, 'private-joins.json'), joins);
  await immutableJSON(join(outputDir, 'report.json'), report);
  return report;
}

export function parseCueQualificationRoundArgs(args) {
  const legacy = [];
  let privateConfigPath;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--private-config') {
      if (privateConfigPath || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('One explicit private configuration file required.');
      privateConfigPath = args[++index];
    } else legacy.push(args[index]);
  }
  const options = parseCueEvaluationArgs(legacy);
  if (privateConfigPath && !options.live) throw new Error('Private configuration is only read with explicit --live.');
  if (options.repeats !== undefined && options.repeats !== 2) throw new Error('Invalid frozen repeat count.');
  if (options.concurrency !== undefined && options.concurrency !== 1) throw new Error('Qualification coordinator requires serial candidate blocks.');
  delete options.repeats; delete options.concurrency;
  return { ...options, privateConfigPath };
}

async function readPrivateConfiguration(path) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || stat.uid !== process.getuid() || stat.size > 65536) throw new Error('Explicit private configuration requires owned regular 0600 file.');
    return JSON.parse(await handle.readFile('utf8'));
  } catch { throw new Error('Explicit private configuration requires owned regular 0600 file; symlinks rejected.'); }
  finally { await handle?.close(); }
}

export async function main(args = process.argv.slice(2)) {
  const { privateConfigPath, ...options } = parseCueQualificationRoundArgs(args);
  validateOptions({ phase: options.phase || 'all', candidates: options.candidates || DEFAULT_CUE_CANDIDATES, maxCalls: options.maxCalls ?? 600, maxEstimatedUsd: options.maxEstimatedUsd ?? 15 });
  if (options.live && !privateConfigPath) throw new Error('Standalone --live requires --private-config with explicit owned 0600 file.');
  if (options.live) options.explicitLiveConfiguration = await readPrivateConfiguration(privateConfigPath);
  const report = await runCueQualificationRound(options);
  process.stdout.write(`${JSON.stringify({ runId: report.runId, modelCalls: report.modelCalls, fakeDispatches: report.fakeDispatches, qualified: report.qualified, incompleteReasons: report.incompleteReasons }, null, 2)}\n`);
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  process.stderr.write('Qualification round failed; check explicit configuration and immutable new round/phase paths.\n'); process.exitCode = 1;
});
