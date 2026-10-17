const modelClientEnv = { DEV: false, MODE: 'production', VITE_READING_ALIGNER_ENABLED: 'true', VITE_READING_MODEL_ANNOTATIONS: 'true' };
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runReadingCueEvaluation, createVisualCueSession, createReadingCueRelay,
  openCueRoundBudget, createBoundedCueAdapter, createWorkersAiRestAdapter,
  estimateCueUsageCost, buildCueDeliverySchedule, createCueRunIdentity,
  DEFAULT_CUE_CANDIDATES, CUE_PRICING_SNAPSHOT
} from '../scripts/evaluation/lib/visualCueEvaluationHarness.mjs';
import { loadReadingCueCases } from '../scripts/evaluation/lib/readingCueQualification.mjs';
import { buildVisualCuePrompt } from '../shared/generation/visualCuePrompt.js';
import { initialVisualLimits } from './helpers/visualInitialAdmissionFixtures.mjs';
import { createReadingCueTestManifest } from './helpers/readingCueQualificationFixtures.mjs';
import { captureVisualCueUndispatchedReservation } from '../functions/lib/visualCueAdmission.js';

const testManifest = await createReadingCueTestManifest();
const cases = await loadReadingCueCases({ manifest: testManifest });
const star = cases.find(c => c.id === 'star-2347-excerpt');
const candidate = DEFAULT_CUE_CANDIDATES[0];
const temporary = () => mkdtemp(join(tmpdir(), 'cue-evaluation-test-'));
const tick = () => new Promise(resolve => setImmediate(resolve));
const fake = run => ({ offline: true, run });
const response = proposals => ({ response: JSON.stringify({ proposals }), model: candidate.model,
  usage: { prompt_tokens: 10, completion_tokens: 10 } });
const register = adapter => adapter.registerSession({ runId: 'run', caseId: star.id });
const literal = { localAlias: 'pool', kind: 'literal', quote: star.opportunities.find(o => o.kind === 'literal').anchors[0].quote,
  targets: [{ spreadIndex: 2, detailIds: ['pool-pour'] }] };

test('controlled offline session dispatches through finite fixture initial admission', async () => {
  let calls = 0;
  const session = await createVisualCueSession({ caseData: star, aiAdapter: fake(async () => { calls += 1; return response([]); }) });
  await session.observe(star.raw, { complete: true });
  const report = await session.finish();
  assert.equal(calls, 1);
  assert.equal(report.attempts.length, 1);
  assert.equal(report.inferenceAttempts.length, 1);
  assert.equal(report.analysisComplete, true);
  const limits = JSON.parse(session.env.VISUAL_INITIAL_LIMITS);
  assert.equal(limits.model, candidate.model);
  assert.equal(limits.globalTotalLimit, 600);
  assert.equal(limits.maxDispatchCostMicrousd, 1);
  assert.equal(session.db.rows('SELECT * FROM visual_initial_admissions').length, 1);
  assert.equal(session.db.rows('SELECT * FROM visual_initial_reservations').length, 1);
});

test('live sessions and evaluation reject missing initial authorization before resources or dispatch', async () => {
  let calls = 0;
  let reserves = 0;
  const aiAdapter = { liveConfigured: true, availableModels: [candidate.model], async run() { calls += 1; return response([]); } };
  const budget = { mode: 'live', async reserve() { reserves += 1; assert.fail('unconfigured live admission reserved'); } };
  await assert.rejects(createVisualCueSession({ caseData: star, live: true, aiAdapter, budget }), /explicit.*initial/i);
  const outputDir = join(await temporary(), 'must-not-create');
  await assert.rejects(runReadingCueEvaluation({ manifest: testManifest, live: true, candidates: [candidate], aiAdapter, budget, outputDir }), /explicit.*initial/i);
  await assert.rejects(readFile(join(outputDir, 'identity.json')), { code: 'ENOENT' });
  assert.equal(calls, 0);
  assert.equal(reserves, 0);
});

test('live initial allowance rejects invalid limits, model pins and untrusted scope before dispatch', async () => {
  let calls = 0;
  const aiAdapter = { liveConfigured: true, availableModels: [candidate.model], async run() { calls += 1; assert.fail('invalid live allowance dispatched'); } };
  const budget = { mode: 'live', async reserve() { calls += 1; assert.fail('invalid live allowance reserved'); } };
  const fixture = () => ({ aggregateScope: `guest-edge:${'b'.repeat(64)}`, limitsByModel: {
    [candidate.model]: JSON.parse(initialVisualLimits({ VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: candidate.model }))
  } });
  for (const change of [
    input => { input.limitsByModel[candidate.model].model = '@cf/different-model'; },
    input => { input.limitsByModel[candidate.model].maxDispatchCostMicrousd = 0; },
    input => { delete input.limitsByModel[candidate.model].scopeCostLimitMicrousd; },
    input => { input.aggregateScope = 'raw-untrusted-edge'; }
  ]) {
    const initialAdmission = fixture(); change(initialAdmission);
    await assert.rejects(createVisualCueSession({ caseData: star, live: true, aiAdapter, budget, initialAdmission }), /explicit.*initial/i);
    await assert.rejects(runReadingCueEvaluation({ manifest: testManifest, live: true, candidates: [candidate], aiAdapter, budget, initialAdmission }), /explicit.*initial/i);
  }
  assert.equal(calls, 0);
});

test('successful original initial reservations survive process restart and config changes refuse new allowance', async () => {
  const path = join(await temporary(), 'initial-restart.json');
  const initialAdmission = { aggregateScope: `guest-edge:${'c'.repeat(64)}`, limitsByModel: {
    [candidate.model]: JSON.parse(initialVisualLimits({ VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: candidate.model }, { globalTotalLimit: 1 }))
  } };
  const budget = await openCueRoundBudget({ path, roundId: 'initial-restart', mode: 'live', maxCalls: 10, maxEstimatedUsd: 3 });
  let calls = 0;
  const session = await createVisualCueSession({ caseData: star, live: true, budget, initialAdmission, aiAdapter: {
    liveConfigured: true, availableModels: [candidate.model], async run() { calls += 1; return response([]); }
  } });
  await session.observe(star.raw, { complete: true });
  const report = await session.finish();
  assert.equal(calls, 1);
  assert.equal(report.accountingComplete, true);
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const module = new URL('../scripts/evaluation/lib/visualCueEvaluationBudget.mjs', import.meta.url).href;
  const child = await promisify(execFile)(process.execPath, ['--input-type=module', '-e',
    `import { openCueRoundBudget } from ${JSON.stringify(module)}; const b=await openCueRoundBudget({path:process.argv[1],roundId:'initial-restart',mode:'live',maxCalls:10,maxEstimatedUsd:3,requireExisting:true}); let reason; try { await b.reserve({candidate:${JSON.stringify(candidate)}}); } catch(error) { reason=error.reason; } process.stdout.write(JSON.stringify({reason,state:await b.snapshot()}));`, path]);
  const reopened = JSON.parse(child.stdout);
  assert.equal(reopened.reason, 'call-cap');
  assert.equal(reopened.state.attempts.length, 1);
  assert.equal(reopened.state.initialReservations.length, 1);
  assert.equal(reopened.state.initialReservations[0].reservedCostMicrousd, 100);
  assert.ok(reopened.state.heldUsd < .001, 'successful usage settlement cannot refund conservative initial cost');
  for (const change of [
    input => { input.aggregateScope = `guest-edge:${'d'.repeat(64)}`; },
    input => { input.limitsByModel[candidate.model].globalTotalLimit = 2; },
    input => { input.limitsByModel[candidate.model].maxDispatchCostMicrousd = 1; }
  ]) {
    const altered = structuredClone(initialAdmission); change(altered);
    await assert.rejects(budget.bindInitialAdmission(altered), /frozen.*initial.*mismatch/i);
  }
  assert.equal((await budget.snapshot()).initialReservations.length, 1);
});

test('persistent initial reservations atomically bound independent handles and retain failure and undispatched withdrawal', async () => {
  const initialAdmission = { aggregateScope: `guest-edge:${'e'.repeat(64)}`, limitsByModel: Object.fromEntries(
    [candidate, DEFAULT_CUE_CANDIDATES[2]].map(selected => [selected.model,
      JSON.parse(initialVisualLimits({ VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: selected.model }, { globalTotalLimit: 1 }))])) };
  for (const outcome of ['failed', 'undispatched']) {
    const configuration = { path: join(await temporary(), 'initial-concurrency.json'), roundId: `initial-${outcome}`, mode: 'live', maxCalls: 10, maxEstimatedUsd: 3 };
    const first = await openCueRoundBudget(configuration);
    const other = await openCueRoundBudget(configuration);
    await first.bindInitialAdmission(initialAdmission);
    await other.bindInitialAdmission(initialAdmission);
    const attempts = await Promise.allSettled([first.reserve({ candidate }), other.reserve({ candidate: DEFAULT_CUE_CANDIDATES[2] })]);
    assert.equal(attempts.filter(attempt => attempt.status === 'fulfilled').length, 1);
    assert.equal(attempts.find(attempt => attempt.status === 'rejected').reason.reason, 'call-cap');
    const accepted = attempts.find(attempt => attempt.status === 'fulfilled').value;
    if (outcome === 'failed') await first.settle(accepted.id, { outcome: 'failed', reason: 'provider_error' });
    else await first.withdrawUndispatched(accepted.id, captureVisualCueUndispatchedReservation(accepted.id));
    const state = await other.snapshot();
    assert.equal(state.attempts.length, outcome === 'failed' ? 1 : 0);
    assert.equal(state.initialReservations.length, 1);
    assert.equal(state.initialReservations[0].reservedCostMicrousd, 100);
    await assert.rejects(other.reserve({ candidate: DEFAULT_CUE_CANDIDATES[2] }), error => error.reason === 'call-cap');
  }
});

for (const boundary of ['cancelled', 'configuration-lost']) {
  test(`original reservation before adapter entry stays durable when ${boundary}`, async () => {
    const initialAdmission = { aggregateScope: `guest-edge:${'f'.repeat(64)}`, limitsByModel: {
      [candidate.model]: JSON.parse(initialVisualLimits({ VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: candidate.model }, { globalTotalLimit: 1 }))
    } };
    const budget = await openCueRoundBudget({ path: join(await temporary(), 'before-adapter.json'), roundId: `before-adapter-${boundary}`,
      mode: 'live', maxCalls: 10, maxEstimatedUsd: 3 });
    let calls = 0;
    const aiAdapter = { liveConfigured: true, availableModels: [candidate.model], async run() { calls += 1; return response([]); } };
    const session = await createVisualCueSession({ caseData: star, live: true, budget, initialAdmission, aiAdapter });
    let release;
    let entered;
    const gate = new Promise(resolve => { release = resolve; });
    const held = new Promise(resolve => { entered = resolve; });
    const prepare = session.env.DB.prepare.bind(session.env.DB);
    session.env.DB.prepare = sql => {
      const statement = prepare(sql);
      if (!sql.startsWith('INSERT INTO visual_initial_reservations')) return statement;
      const intercepted = Object.create(statement);
      intercepted.bind = (...values) => {
        const bound = statement.bind(...values);
        const delayed = Object.create(bound);
        delayed.run = async () => { const result = await bound.run(); entered(); await gate; return result; };
        return delayed;
      };
      return intercepted;
    };
    try {
      await session.observe(star.raw, { complete: true });
      let timer;
      try { await Promise.race([held, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Original reservation did not reach the held boundary.')), 1000); })]); }
      finally { clearTimeout(timer); }
      const before = await budget.snapshot();
      assert.equal(session.db.rows('SELECT * FROM visual_initial_reservations').length, 1);
      assert.equal(before.initialReservations.length, 1);
      assert.equal(before.initialReservations[0].reservedCostMicrousd, 100);
      assert.equal(before.attempts.length, 0);
      if (boundary === 'cancelled') await session.cancel();
      else delete session.env.VISUAL_INITIAL_LIMITS;
      release();
      await session.finish();
    } finally { release(); await session.finish(); }
    assert.equal(calls, 0);
    session.db.sqlite.close();
    const resumed = await createVisualCueSession({ caseData: star, live: true, budget, initialAdmission, aiAdapter, trialId: 'new-case-store' });
    await resumed.observe(star.raw, { complete: true });
    const report = await resumed.finish();
    assert.equal(calls, 0);
    assert.equal(report.admissionComplete, false);
    assert.equal(report.attempts.length, 0);
    const after = await budget.snapshot();
    assert.equal(after.initialReservations.length, 1);
    assert.equal(after.attempts.length, 0);
    assert.ok(after.admissions.some(admission => admission.initialLimit === 'globalTotalLimit'));
  });
}

test('persistent original hold survives failure of the real D1 reservation statement', async () => {
  const { createD1 } = await import('./helpers/d1Sqlite.mjs');
  const db = await createD1();
  const prepare = db.prepare.bind(db);
  db.prepare = sql => {
    const statement = prepare(sql);
    if (!sql.startsWith('INSERT INTO visual_initial_reservations')) return statement;
    const intercepted = Object.create(statement);
    intercepted.bind = (...values) => {
      const bound = statement.bind(...values);
      const failed = Object.create(bound);
      failed.run = async () => { throw new Error('Controlled reservation storage failure.'); };
      return failed;
    };
    return intercepted;
  };
  const initialAdmission = { aggregateScope: `guest-edge:${'1'.repeat(64)}`, limitsByModel: {
    [candidate.model]: JSON.parse(initialVisualLimits({ VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: candidate.model }))
  } };
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'd1-reserve-failure.json'), roundId: 'd1-reserve-failure', mode: 'live' });
  let calls = 0;
  const session = await createVisualCueSession({ caseData: star, live: true, budget, db, initialAdmission,
    aiAdapter: { liveConfigured: true, availableModels: [candidate.model], async run() { calls += 1; assert.fail('failed D1 reservation dispatched'); } } });
  await session.observe(star.raw, { complete: true });
  const report = await session.finish();
  const state = await budget.snapshot();
  assert.equal(calls, 0);
  assert.equal(report.attempts.length, 0);
  assert.equal(db.rows('SELECT * FROM visual_initial_reservations').length, 0);
  assert.equal(state.initialReservations.length, 1);
  assert.equal(state.initialReservations[0].reservedCostMicrousd, 100);
});

test('reservation rejection is admission-incomplete, not a dispatch', async () => {
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'round.json'), roundId: 'admission', maxEstimatedUsd: .1 });
  const session = await createVisualCueSession({ caseData: star, candidate, budget,
    aiAdapter: fake(async () => assert.fail('rejected admission reached provider')) });
  await session.observe(star.raw, { complete: true });
  const report = await session.finish();
  const state = await budget.snapshot();
  assert.equal(report.attempts.length, 0);
  assert.equal(report.inferenceAttempts.length, 0);
  assert.equal(state.attempts.length, 0);
  assert.equal(state.estimatedUsd, 0);
  assert.equal(state.admissions[0].reason, 'candidate-cost-bound');
  assert.equal(report.admissionComplete, false);
  assert.equal(report.analysisComplete, false);
  assert.equal(report.jobAttemptRowsComplete, true);
});

test('expensive blocked candidate does not falsely halt affordable candidates', async () => {
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'round.json'), roundId: 'local-cost', maxEstimatedUsd: .2 });
  for (const [selected, expectedCalls] of [[DEFAULT_CUE_CANDIDATES[2], 0], [candidate, 1]]) {
    const session = await createVisualCueSession({ caseData: star, candidate: selected, budget,
      aiAdapter: fake(async model => ({ ...response([]), model })) });
    await session.observe(star.raw, { complete: true });
    const report = await session.finish();
    assert.equal(report.attempts.length, expectedCalls);
    assert.equal(report.inferenceAttempts.length, expectedCalls);
    assert.equal(report.fatalReason, null);
  }
  assert.equal((await budget.snapshot()).halted, false);
});

test('frozen expensive-first evaluation block continues to affordable candidate with full denominator', async () => {
  const selectedManifest = structuredClone(testManifest);
  delete selectedManifest.manifestSha256;
  selectedManifest.candidateOrder = ['glm-5.3-high', 'glm-5.3-flash-low', 'glm-5.3-flash-high'];
  const report = await runReadingCueEvaluation({ manifest: selectedManifest, phase: 'semantic', candidates: [DEFAULT_CUE_CANDIDATES[2], candidate],
    outputDir: join(await temporary(), 'expensive-first'), maxEstimatedUsd: .2,
    aiAdapter: fake(async model => ({ ...response([]), model })) });
  assert.equal(report.semantic.length, 148);
  assert.equal(report.semantic.filter(r => r.candidateId === 'glm-5.3-high').every(r => r.attempts.length === 0 && r.inferenceAttempts.length === 0 && !r.admissionComplete), true);
  assert.equal(report.semantic.filter(r => r.candidateId === candidate.id).every(r => r.analysisComplete), true);
  assert.equal(report.fakeDispatches, 74);
  assert.ok(report.incompleteReasons.includes('budget-admission-incomplete'));
  assert.equal(report.budget.halted, false);
});

test('advisory affordability never overrides atomic reserve', async () => {
  const path = join(await temporary(), 'round.json');
  const budget = await openCueRoundBudget({ path, roundId: 'race', maxCalls: 1 });
  assert.equal((await budget.canReserve({ candidate })).allowed, true);
  const other = await openCueRoundBudget({ path, roundId: 'race', maxCalls: 1 });
  await other.reserve({ candidate });
  await assert.rejects(budget.reserve({ candidate }), error => error.reason === 'call-cap');
  assert.equal((await budget.snapshot()).attempts.length, 1);
});

test('delayed successful settlement preserves usage when outer deadline cancels delivery', async () => {
  const real = await openCueRoundBudget({ path: join(await temporary(), 'round.json'), roundId: 'delayed-success' });
  let release;
  let settling;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { settling = resolve; });
  const budget = { ...real, async settle(...args) { settling(); await gate; return real.settle(...args); } };
  const session = await createVisualCueSession({ caseData: star, candidate, budget, aiAdapter: fake(async () => response([])) });
  session.env.VISUAL_CUE_TIMEOUT_MS = 10;
  await session.observe(star.raw, { complete: true });
  await entered;
  await session.state.drain();
  release();
  const report = await session.finish();
  assert.equal(report.attempts.length, 1);
  assert.equal(report.inferenceAttempts.length, 1);
  assert.equal(report.attempts[0].outcome, 'failed');
  assert.equal(report.inferenceAttempts[0].state, 'failed');
  assert.equal(report.inferenceAttempts[0].input_tokens, 10);
  assert.equal(report.jobAttemptRowsComplete, true);
  assert.equal(report.accountingComplete, true);
});

test('cancellation while reservation returns never invokes transport or fabricates dispatch', async () => {
  const real = await openCueRoundBudget({ path: join(await temporary(), 'reserve-cancel.json'), roundId: 'reserve-cancel' });
  let release;
  let reserved;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { reserved = resolve; });
  const budget = { ...real, async reserve(...args) { const result = await real.reserve(...args); reserved(); await gate; return result; } };
  const session = await createVisualCueSession({ caseData: star, candidate, budget,
    aiAdapter: fake(async () => assert.fail('cancelled admission invoked transport')) });
  await session.observe(star.raw, { complete: true }); await entered;
  await session.cancel(); await session.state.drain(); release();
  const report = await session.finish();
  assert.equal(report.attempts.length, 0);
  assert.equal(report.inferenceAttempts.length, 0);
  const state = await real.snapshot();
  assert.equal(state.attempts.length, 0);
  assert.equal(state.estimatedUsd, 0);
  assert.equal(state.admissions.at(-1).reason, 'cancelled-before-dispatch');
});

test('REST structured error envelopes preserve available safe usage before rejection', async () => {
  const adapter = createWorkersAiRestAdapter({ live: true, accountId: 'a'.repeat(32), apiToken: 'offline-fixture-only',
    availableModels: [candidate.model], fetchImpl: async () => new Response(JSON.stringify({ success: false,
      result: { usage: { input_tokens: 10, output_tokens: 1 }, model: candidate.model, private: 'private-body' } }), { status: 401 }) });
  await assert.rejects(adapter.run(candidate.model, {}), error => error.code === 'authorization'
    && error.usage.inputTokens === 10 && error.model === candidate.model && !JSON.stringify(error).includes('private-body'));
});

test('same shared ledger survives process restart with unresolved dispatched cost', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const path = join(await temporary(), 'restart.json');
  const budget = await openCueRoundBudget({ path, roundId: 'restart' });
  const session = await createVisualCueSession({ caseData: star, candidate, budget,
    aiAdapter: fake(async () => { throw new Error('offline failure'); }) });
  await session.observe(star.raw, { complete: true });
  const report = await session.finish();
  assert.equal(report.inferenceAttempts.length, 1);
  const module = new URL('../scripts/evaluation/lib/visualCueEvaluationBudget.mjs', import.meta.url).href;
  const child = await promisify(execFile)(process.execPath, ['--input-type=module', '-e',
    `import { openCueRoundBudget } from ${JSON.stringify(module)}; const b=await openCueRoundBudget({path:process.argv[1],roundId:'restart'}); process.stdout.write(JSON.stringify(await b.snapshot()));`, path]);
  const reopened = JSON.parse(child.stdout);
  assert.equal(reopened.attempts.length, 1);
  assert.ok(Math.abs(reopened.heldUsd - .1613824) < 1e-12);
  assert.equal(reopened.measuredCostComplete, false);
});

test('terminal failure stops inappropriate new work through a separate session handle', async () => {
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'terminal.json'), roundId: 'terminal' });
  const first = await createVisualCueSession({ caseData: star, candidate, budget, aiAdapter: fake(async () => {
    throw Object.assign(new Error('private upstream'), { code: 'authorization', usage: { input_tokens: 10, output_tokens: 1 } });
  }) });
  await first.observe(star.raw, { complete: true });
  assert.equal((await first.finish()).inferenceAttempts.length, 1);
  const second = await createVisualCueSession({ caseData: star, candidate, budget,
    aiAdapter: fake(async () => assert.fail('terminal round dispatched new work')) });
  await second.observe(star.raw, { complete: true });
  const result = await second.finish();
  assert.equal(result.attempts.length, 0);
  assert.equal(result.inferenceAttempts.length, 0);
  assert.equal(result.admissionComplete, false);
  assert.equal(result.fatalReason, 'round-halted');
  const snapshot = await budget.snapshot();
  assert.equal(snapshot.attempts.length, 1);
  assert.equal(snapshot.measuredCostComplete, true);
  assert.ok(snapshot.estimatedUsd > 0);
});

for (const stop of ['cancel', 'deadline']) {
  for (const reason of ['authorization', 'configuration']) {
    test(`late ${reason} after ${stop} halts shared round without rewriting unknown attempt`, async () => {
      const path = join(await temporary(), 'late-terminal.json');
      const realBudget = await openCueRoundBudget({ path, roundId: 'late-terminal' });
      let rejectRemote;
      let dispatched;
      let releaseHalt;
      let haltEntered;
      const started = new Promise(resolve => { dispatched = resolve; });
      const remote = new Promise((_resolve, reject) => { rejectRemote = reject; });
      const haltGate = new Promise(resolve => { releaseHalt = resolve; });
      const halting = new Promise(resolve => { haltEntered = resolve; });
      const budget = { ...realBudget, async halt() { haltEntered(); await haltGate; return realBudget.halt(); } };
      let calls = 0;
      const session = await createVisualCueSession({ caseData: star, candidate, budget,
        aiAdapter: fake(async () => { calls++; dispatched(); return remote; }) });
      session.env.VISUAL_CUE_TIMEOUT_MS = stop === 'deadline' ? 10 : 60000;
      await session.observe(star.raw, { complete: true }); await started;
      if (stop === 'cancel') await session.cancel();
      const original = await session.finish();
      const before = await realBudget.snapshot();
      assert.equal(original.attempts[0].reason, stop === 'deadline' ? 'timeout' : 'cancelled');
      rejectRemote(Object.assign(new Error('private late transport message'), { code: reason }));
      await tick();
      assert.equal(session.bounded.fatalReason, reason);
      await halting;
      let drained = false;
      const draining = session.bounded.drainSettlements().then(() => { drained = true; });
      await tick();
      assert.equal(drained, false, 'terminal halt is owned settlement work');
      releaseHalt(); await draining;
      const reopened = await openCueRoundBudget({ path, roundId: 'late-terminal' });
      const after = await reopened.snapshot();
      assert.equal(after.halted, true);
      assert.deepEqual(after.attempts, before.attempts);
      assert.equal(after.corrections.length, 0);
      assert.equal(after.heldUsd, before.heldUsd);
      assert.equal(after.measuredCostComplete, false);
      const second = await createVisualCueSession({ caseData: star, candidate, budget: reopened,
        aiAdapter: fake(async () => { calls++; return response([]); }) });
      await second.observe(star.raw, { complete: true });
      const denied = await second.finish();
      assert.equal(denied.attempts.length, 0);
      assert.equal(denied.inferenceAttempts.length, 0);
      assert.equal(denied.fatalReason, 'round-halted');
      assert.equal(calls, 1);
      assert.equal((await reopened.snapshot()).attempts.length, 1);
    });
  }
}

test('budget explicitly labels its reservation timestamp independently of dispatch latency', async () => {
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'reservation-clock.json'), roundId: 'reservation-clock' });
  const reserved = await budget.reserve({ candidate });
  assert.equal(reserved.startedAtMsMeaning, 'reservation');
  assert.equal(reserved.reservedAtMs, reserved.startedAtMs);
});

test('untrusted input bound evidence cannot reduce conservative reservations', async () => {
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'bound.json'), roundId: 'bound' });
  for (const verifiedInputBound of [10, { inputTokens: 10 }, { inputTokens: 10, model: candidate.model, requestSha256: 'a'.repeat(64), tokenizer: 'invented' }]) {
    assert.deepEqual(await budget.canReserve({ candidate, verifiedInputBound }), { allowed: false, reservedUsd: null, remainingUsd: 15, reason: 'configuration' });
    await assert.rejects(budget.reserve({ candidate, verifiedInputBound }));
  }
  assert.equal((await budget.snapshot()).attempts.length, 0);
  const fresh = await openCueRoundBudget({ path: join(await temporary(), 'fresh-bound.json'), roundId: 'fresh-bound' });
  const reserved = await fresh.reserve({ candidate });
  assert.ok(Math.abs(reserved.reservedUsd - .1613824) < 1e-12);
});

test('later captured provider usage appends evidence and preserves original unknown attempt', async () => {
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'correction.json'), roundId: 'correction' });
  let release;
  let started;
  const remote = new Promise(resolve => { release = resolve; });
  const dispatched = new Promise(resolve => { started = resolve; });
  const session = await createVisualCueSession({ caseData: star, candidate, budget,
    aiAdapter: fake(async () => { started(); return remote; }) });
  await session.observe(star.raw, { complete: true }); await dispatched;
  await session.cancel(); await session.finish();
  const before = await budget.snapshot();
  const attempt = before.attempts[0];
  await assert.rejects(budget.appendUsageEvidence(attempt.id, { evidenceId: 'fake-receipt', requestSha256: attempt.requestSha256,
    usage: { input_tokens: 10, output_tokens: 1 }, evidence: { requestSha256: attempt.requestSha256, usage: { input_tokens: 10, output_tokens: 1 } } }));
  assert.equal((await budget.snapshot()).measuredCostComplete, false);
  release({ response: '{"proposals":[]}', usage: { input_tokens: 10, output_tokens: 1 }, model: candidate.model });
  await tick(); await session.bounded.drainSettlements();
  const after = await budget.snapshot();
  assert.deepEqual(after.attempts, before.attempts);
  assert.equal(after.corrections.length, 1);
  assert.equal(after.attempts.length, 1);
  assert.equal(after.currentAttempts[0].outcome, 'failed');
  assert.equal(after.measuredCostComplete, true);
  assert.equal(after.heldUsd, .000002);
});

for (const kind of ['malformed', 'rejected', 'provider-error', 'cancelled']) {
  for (const suppliedUsage of [null, { input_tokens: 10 }, { input_tokens: 10, output_tokens: 1 }, { input_tokens: 10, output_tokens: 1, total_tokens: -1 }]) {
    test(`${kind} response preserves exactly one dispatched attempt with ${JSON.stringify(suppliedUsage)}`, async () => {
      let dispatched;
      const ready = new Promise(resolve => { dispatched = resolve; });
      const session = await createVisualCueSession({ caseData: star, candidate, aiAdapter: fake(async (_model, _input, { signal }) => {
        dispatched();
        if (kind === 'cancelled') await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
        if (['provider-error', 'cancelled'].includes(kind)) throw Object.assign(new Error('private payload'), { usage: suppliedUsage, model: candidate.model });
        return { response: kind === 'malformed' ? 'private invalid JSON' : '{"proposals":"private invalid shape"}', usage: suppliedUsage, model: candidate.model };
      }) });
      await session.observe(star.raw, { complete: true });
      await ready;
      if (kind === 'cancelled') await session.cancel();
      const report = await session.finish();
      assert.equal(report.attempts.length, 1);
      assert.equal(report.inferenceAttempts.length, 1);
      assert.equal(JSON.stringify(report.attempts).includes('private'), false);
      const known = suppliedUsage?.output_tokens === 1 && suppliedUsage?.total_tokens !== -1;
      // Cancellation wins before the provider rejects: late evidence is separate.
      if (!known || kind === 'cancelled') {
        assert.equal(report.attempts[0].heldUsd, report.attempts[0].reservedUsd);
        if (!known) assert.equal((await session.budget.snapshot()).measuredCostComplete, false);
      } else {
        assert.equal(report.inferenceAttempts[0].input_tokens, 10);
        assert.equal(report.jobAttemptRowsComplete, true);
      }
    });
  }
}

// These assertions detect credential discovery, overdispatch and fake evidence
// becoming model-quality evidence, while using real provider/job/ledger paths.
test('live requires explicit adapter and round configuration; REST adapter never inherits env', async () => {
  await assert.rejects(runReadingCueEvaluation({ manifest: testManifest, live: true }), /explicit/i);
  assert.throws(() => createWorkersAiRestAdapter({ live: true }), /explicit/i);
  assert.throws(() => createWorkersAiRestAdapter({ accountId: 'abc', apiToken: 'private' }), /live/i);
  assert.throws(() => createBoundedCueAdapter({ live: false, aiAdapter: { run() {} }, candidate }), /offline/i);
});

test('dry-run validates 222 planned semantic evaluations with zero network and immutable output', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('offline mode attempted network'));
  const outputDir = join(await temporary(), 'run');
  const report = await runReadingCueEvaluation({ manifest: testManifest, phase: 'all', outputDir });
  assert.equal(report.plan.semantic.length, 222);
  assert.equal(report.plan.expectedTrials[1].caseIds.length, 12);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.semantic.length, 222);
  assert.ok(report.fakeDispatches >= 222);
  assert.equal(report.timing.length, 18);
  assert.ok(report.semantic.every(result => result.analysisComplete));
  assert.equal(report.incompleteReasons.includes('runner-configuration-failure'), false);
  assert.equal(report.qualified, false);
  assert.equal(report.mode, 'offline fake-adapter checks');
  assert.ok(report.identity.head);
  assert.equal(report.identity.manifestSha256, testManifest.manifestSha256);
  await assert.rejects(runReadingCueEvaluation({ manifest: testManifest, outputDir }), /exist|immutable/i);
  assert.deepEqual(JSON.parse(await readFile(join(outputDir, 'report.json'), 'utf8')).runId, report.runId);
});

test('persistent budget reserves before dispatch and serializes different handles', async () => {
  const path = join(await temporary(), 'round.json');
  const one = await openCueRoundBudget({ path, roundId: 'round', maxCalls: 1, maxEstimatedUsd: 15 });
  const two = await openCueRoundBudget({ path, roundId: 'round', maxCalls: 1, maxEstimatedUsd: 15 });
  const adapter = createBoundedCueAdapter({ live: false, budget: one, candidate,
    aiAdapter: fake(async () => { assert.equal((await two.snapshot()).attempts.length, 1); return response([]); }) });
  await register(adapter).run(candidate.model, adapter.requestTemplate);
  await assert.rejects(two.reserve({ candidate, registration: {} }), /budget/i);
  assert.equal((await two.snapshot()).attempts.length, 1);
  await assert.rejects(openCueRoundBudget({ path, roundId: 'round', maxCalls: 2 }), /configuration/i);
});

test('concurrent reservations cannot overrun cost or calls', async () => {
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'round.json'), roundId: 'round', maxCalls: 3, maxEstimatedUsd: .32 });
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => budget.reserve({ candidate, registration: {} })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await budget.snapshot()).attempts.length, 1);
});

test('failed and unknown-usage requests retain conservative budget across resume', async () => {
  const path = join(await temporary(), 'round.json');
  const budget = await openCueRoundBudget({ path, roundId: 'round', maxCalls: 2, maxEstimatedUsd: 1 });
  const adapter = createBoundedCueAdapter({ live: false, budget, candidate, aiAdapter: fake(async () => { throw new Error('private raw failure'); }) });
  await assert.rejects(register(adapter).run(candidate.model, adapter.requestTemplate), /annotation/i);
  const resumed = await openCueRoundBudget({ path, roundId: 'round', maxCalls: 2, maxEstimatedUsd: 1 });
  const state = await resumed.snapshot();
  assert.equal(state.attempts[0].outcome, 'failed');
  assert.equal(state.attempts[0].estimatedUsd, null);
  assert.equal(state.attempts[0].heldUsd, state.attempts[0].reservedUsd);
  assert.equal(JSON.stringify(state).includes('private raw'), false);
  const next = await resumed.reserve({ candidate, registration: {} });
  await resumed.settle(next.id, { outcome: 'accepted', usage: null });
  await assert.rejects(resumed.reserve({ candidate, registration: {} }), /budget/i);
});

test('token cost treats cache/reasoning as subsets and invalid counts keep bound', async () => {
  const pricing = CUE_PRICING_SNAPSHOT.models[candidate.model];
  assert.equal(estimateCueUsageCost({ inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 20, reasoningTokens: 30 }, pricing).estimatedUsd,
    (80 * .15 + 20 * .03 + 50 * .5) / 1e6);
  for (const usage of [{ inputTokens: 10, outputTokens: 2, cacheReadInputTokens: 11 },
    { inputTokens: 10, outputTokens: 2, reasoningTokens: 3 }, { inputTokens: 10 }]) {
    assert.equal(estimateCueUsageCost(usage, pricing).complete, false);
  }
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'round.json'), roundId: 'round' });
  const attempt = await budget.reserve({ candidate, registration: {} });
  await budget.settle(attempt.id, { usage: { inputTokens: 10, outputTokens: 2, reasoningTokens: 3 }, outcome: 'accepted' });
  assert.equal((await budget.snapshot()).attempts[0].heldUsd, attempt.reservedUsd);
});

test('bounded adapter rejects wrong model/config/schema and missing registration before reserve', async () => {
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'round.json'), roundId: 'round' });
  const adapter = createBoundedCueAdapter({ live: false, budget, candidate, aiAdapter: fake(async () => response([])) });
  const registered = register(adapter);
  await assert.rejects(registered.run('other', adapter.requestTemplate), /configuration/i);
  await assert.rejects(registered.run(candidate.model, { ...adapter.requestTemplate, temperature: 1 }), /configuration/i);
  await assert.rejects(adapter.run(candidate.model, adapter.requestTemplate), /registration/i);
  assert.equal((await budget.snapshot()).attempts.length, 0);
});

test('bounded adapter freezes the system prompt for the registered edition', async () => {
  const { systemPrompt: identityPrompt, userPrompt: identityUser } = buildVisualCuePrompt({ artworkEdition: 'identity:thoth-a1' });
  const open = async (roundId, dispatched = []) => {
    const budget = await openCueRoundBudget({ path: join(await temporary(), 'round.json'), roundId });
    const adapter = createBoundedCueAdapter({ live: false, budget, candidate,
      aiAdapter: fake(async (_model, input) => { dispatched.push(input.messages[0].content); return response([]); }) });
    const withSystem = (content, user = identityUser) => ({ ...adapter.requestTemplate, messages: [{ role: 'system', content }, { role: 'user', content: user }] });
    return { budget, adapter, withSystem, dispatched,
      identityOnly: adapter.registerSession({ runId: 'run', caseId: 'thoth', artworkEdition: 'identity:thoth-a1' }),
      supported: adapter.registerSession({ runId: 'run', caseId: star.id, artworkEdition: 'rws-immanuelle-vector' }) };
  };
  // A configuration rejection halts its adapter, so each mismatch gets its own round.
  const unsupportedWithExamples = await open('edition-identity');
  assert.notEqual(identityPrompt, unsupportedWithExamples.adapter.requestTemplate.messages[0].content);
  await assert.rejects(unsupportedWithExamples.identityOnly.run(candidate.model, unsupportedWithExamples.adapter.requestTemplate), /configuration/i);
  const supportedWithoutExamples = await open('edition-supported');
  await assert.rejects(supportedWithoutExamples.supported.run(candidate.model, supportedWithoutExamples.withSystem(identityPrompt)), /configuration/i);
  // The right system prompt cannot carry a user prompt that names another edition.
  const mismatchedUser = await open('edition-user-line');
  await assert.rejects(mismatchedUser.supported.run(candidate.model, mismatchedUser.withSystem(mismatchedUser.adapter.requestTemplate.messages[0].content, identityUser)), /configuration/i);
  assert.equal(mismatchedUser.adapter.admissions.at(-1).registration.artworkEdition, 'rws-immanuelle-vector');
  for (const rejected of [unsupportedWithExamples, supportedWithoutExamples, mismatchedUser]) {
    assert.equal((await rejected.budget.snapshot()).attempts.length, 0);
    assert.deepEqual(rejected.dispatched, []);
  }
  const accepted = await open('edition-accepted');
  await accepted.identityOnly.run(candidate.model, accepted.withSystem(identityPrompt));
  await accepted.supported.run(candidate.model, accepted.adapter.requestTemplate);
  assert.deepEqual(accepted.dispatched, [identityPrompt, accepted.adapter.requestTemplate.messages[0].content]);
});

test('real job rejects malformed and unsupported proposals separately from dispatch outcome', async () => {
  const session = await createVisualCueSession({ caseData: star, candidate, aiAdapter: fake(async () => response([
    { ...literal, targets: [{ spreadIndex: 99, detailIds: ['pool-pour'] }] },
    { ...literal, localAlias: 'bad', targets: [{ spreadIndex: 2, detailIds: ['imaginary'] }] }
  ])) });
  await session.observe(star.raw, { complete: true });
  const report = await session.finish();
  assert.equal(report.status, 'complete');
  assert.equal(report.ledger.cues.length, 0);
  assert.equal(report.ledger.receipts[0].rejected.length, 2);
  assert.equal(report.attempts[0].outcome, 'accepted');
  assert.equal(report.inferenceAttempts.length, 1);
});

test('one in flight/latest pending retains full cumulative prefix and coalesced receipts', async () => {
  let release;
  let dispatch;
  const started = new Promise(resolve => { dispatch = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const prefixes = [];
  const session = await createVisualCueSession({ caseData: star, candidate, aiAdapter: fake(async (_model, input) => {
    prefixes.push(input.messages[1].content); dispatch();
    if (prefixes.length === 1) await held;
    return response([]);
  }) });
  await session.observe(star.raw.slice(0, 100)); await started;
  await session.observe(star.raw.slice(0, 200));
  await session.observe(star.raw, { complete: true });
  release();
  const report = await session.finish();
  assert.equal(prefixes.length, 2);
  assert.ok(prefixes[1].includes(star.raw));
  assert.deepEqual(report.observations.map(o => o.outcome), ['accepted', 'coalesced', 'coalesced']);
  assert.deepEqual(report.requests.map(r => r.analyzedEnd), [100, star.raw.length]);
  assert.equal(report.ledger.raw, star.raw);
});

test('accepted literals are in subsequent real prompt and return dependencies resolve', async () => {
  const first = star.opportunities.find(o => o.kind === 'literal' && o.targets[0].detailIds[0] === 'pool-pour');
  const returns = star.opportunities.find(o => o.kind === 'interpretation' && o.targets[0].detailIds[0] === 'pool-pour');
  const prompts = [];
  const session = await createVisualCueSession({ caseData: star, candidate, aiAdapter: fake(async (_model, input) => {
    prompts.push(input.messages[1].content);
    return response(prompts.length === 1 ? [{ ...literal, quote: first.anchors[0].quote }] : [{ localAlias: 'return', kind: 'interpretation',
      quote: returns.anchors[0].quote, targets: returns.targets, establishedBy: [{ acceptedCueId: session.job.ledger.cues[0].id }] }]);
  }) });
  await session.observe(star.raw.slice(0, first.anchors[0].end)); await session.drain();
  await session.observe(star.raw, { complete: true });
  const report = await session.finish();
  assert.equal(report.ledger.cues.length, 2);
  assert.equal(report.ledger.cues[1].establishedBy[0], report.ledger.cues[0].id);
  assert.ok(prompts[1].includes(report.ledger.cues[0].id));
});

test('source replacement abandons late old response without contaminating next ledger', async () => {
  let release;
  let started;
  const dispatched = new Promise(resolve => { started = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  let count = 0;
  const session = await createVisualCueSession({ caseData: star, candidate, aiAdapter: fake(async () => {
    if (++count === 1) { started(); await held; return response([literal]); }
    return response([]);
  }) });
  await session.observe(star.raw); await dispatched;
  await session.replace('Replacement source.', { complete: true });
  release();
  const report = await session.finish();
  assert.equal(report.ledger.raw, 'Replacement source.');
  assert.equal(report.ledger.cues.length, 0);
  assert.equal(report.requests[0].status, 'abandoned');
  assert.equal(report.binding.sourceRevision, 1);
});

test('cancellation aborts provider and cleans late completion/subscribers', async () => {
  let started;
  const dispatched = new Promise(resolve => { started = resolve; });
  const session = await createVisualCueSession({ caseData: star, candidate, aiAdapter: fake(async (_m, _i, { signal }) => {
    started(); await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
    return response([literal]);
  }) });
  await session.observe(star.raw); await dispatched;
  await session.cancel();
  const report = await session.finish();
  assert.equal(report.status, 'cancelled');
  assert.equal(report.ledger.cues.length, 0);
  assert.equal(session.job.subscribers.size, 0);
  assert.equal(session.job.pendingSnapshot, null);
});

test('duplicate observations never dispatch or duplicate accepted cues', async () => {
  const session = await createVisualCueSession({ caseData: star, candidate, aiAdapter: fake(async () => response([literal])) });
  await session.observe(star.raw, { complete: true }); await session.drain();
  await session.observe(star.raw, { complete: true, deliveredEventId: 1 });
  const report = await session.finish();
  assert.equal(report.attempts.length, 1);
  assert.equal(report.ledger.cues.length, 1);
  assert.equal(report.observations[1].outcome, 'duplicate');
});

test('run identity is deterministic and dirty relevant bytes change it', async () => {
  const first = await createCueRunIdentity({ cases, phase: 'semantic' });
  assert.deepEqual(first, await createCueRunIdentity({ cases, phase: 'semantic' }));
  for (const path of ['functions/lib/requestDeadline.js', 'functions/lib/readingVisualResults.js',
    'shared/contracts/readingPassageAssociations.js', 'functions/lib/visualCueObserver.js',
    'functions/lib/readingVisualJobs.js', 'package-lock.json']) assert.ok(first.fileDigests[path], path);
  const path = join(await temporary(), 'relevant.txt');
  await writeFile(path, 'first');
  const before = await createCueRunIdentity({ cases, phase: 'semantic', relevantPaths: [path] });
  await writeFile(path, 'second');
  const after = await createCueRunIdentity({ cases, phase: 'semantic', relevantPaths: [path] });
  assert.notEqual(before.digest, after.digest);
});

test('frozen schedules preserve raw UTF-16 bytes, sentence timing, and unrestricted natural call bound', () => {
  const paced = buildCueDeliverySchedule(star.raw, 'paced');
  assert.equal(paced.map(e => e.text || '').join(''), star.raw);
  assert.equal(paced.at(-1).type, 'done');
  assert.ok(paced.length > 3);
  assert.equal(paced.at(-1).atMs, paced.at(-2).atMs);
  assert.equal(buildCueDeliverySchedule(star.raw, 'burst').at(-1).atMs, 0);
  assert.deepEqual(buildCueDeliverySchedule(star.raw, 'final-only').map(e => e.type), ['done']);
});

test('relay offers scoped ordinary reading/visual routes and JSON upstream observer', async () => {
  const relay = await createReadingCueRelay({ caseData: star, candidate, runId: 'relay-test', schedule: 'final-only',
    sourceMode: 'json', aiAdapter: fake(async () => response([literal])) });
  try {
    assert.match(relay.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
    const bad = await fetch(`${relay.origin}/api/tarot-reading/visuals/another`);
    assert.equal(bad.status, 404);
    const started = await fetch(`${relay.origin}/api/tarot-reading/jobs`, { method: 'POST', body: '{}' });
    assert.deepEqual(await started.json(), relay.startData);
    relay.startSchedule();
    const report = await relay.completion;
    assert.equal(report.narrativeRawSha256, star.rawSha256);
    assert.equal(report.ledger.raw, star.raw);
    assert.equal(report.ledger.cues.length, 1);
    const visual = await fetch(`${relay.origin}/api/tarot-reading/visuals/${relay.startData.readingResultId}`, {
      headers: { 'X-Visual-Token': relay.startData.visualJobToken }
    });
    const payload = await visual.json();
    assert.equal(payload.status, 'complete');
    assert.equal(JSON.stringify(payload).includes('usage'), false);
    assert.equal(report.clockDomain, 'server Date.now');
  } finally { await relay.close(); }
});

test('relay cancellation before schedule cleans owned work without dispatch', async () => {
  const relay = await createReadingCueRelay({ caseData: star, candidate, runId: 'cancel-test', aiAdapter: fake(async () => assert.fail('cancelled dispatch')) });
  await relay.close();
  const report = await relay.completion;
  assert.equal(report.status, 'cancelled');
  assert.equal(report.attempts.length, 0);
  await tick();
});


test('runtime prompt supplies registered detail IDs and keeps unspecified editions identity-only', async () => {
  const prompts = [];
  const session = await createVisualCueSession({ caseData: star, candidate,
    aiAdapter: fake(async (_model, input) => { prompts.push(input.messages[1].content); return response([]); }) });
  await session.observe(star.raw, { complete: true }); await session.finish();
  assert.ok(prompts[0].includes('pool-pour'));
  assert.equal(prompts[0].includes('[object Object]'), false);
  const thoth = cases.find(c => c.id === 'spiritual-thoth-ritual');
  const other = await createVisualCueSession({ caseData: thoth, candidate });
  await other.observe(thoth.raw, { complete: true });
  const result = await other.finish();
  assert.equal(result.analysisComplete, true);
  assert.equal(result.binding.artworkEdition, `identity:${thoth.deckStyle}`);
});

test('failed analysis retains actual ledger and delivered source separately, missing planned denominators remain', async () => {
  const report = await runReadingCueEvaluation({ manifest: testManifest, phase: 'semantic', candidates: [candidate],
    outputDir: join(await temporary(), 'failed'), maxCalls: 1,
    aiAdapter: fake(async () => { throw new Error('failed upstream'); }) });
  assert.equal(report.semantic[0].status, 'failed');
  assert.equal(report.semantic[0].sourceMatchesCase, true);
  assert.equal(report.semantic[0].ledger.raw, '');
  assert.equal(report.semantic[0].analysisComplete, false);
  assert.equal(report.scores[0].score.counts.requiredRecall.denominator, 396);
  assert.equal(report.scores[0].score.hardFailures.some(f => f.code === 'prose-mutation'), false);
  assert.equal(report.semantic.filter(r => r.status === 'incomplete').length, 73);
});

test('natural sequential arrivals may dispatch more than three times without hidden cap', async () => {
  const session = await createVisualCueSession({ caseData: star, candidate });
  for (const end of [100, 200, 300, 400, star.raw.length]) {
    await session.observe(star.raw.slice(0, end), { complete: end === star.raw.length });
    await session.drain();
  }
  const report = await session.finish();
  assert.equal(report.attempts.length, 5);
  assert.equal(report.ledger.raw, star.raw);
});

test('global authorization failure stops remaining planned cases rather than fabricating quality failures', async () => {
  const report = await runReadingCueEvaluation({ manifest: testManifest, phase: 'semantic', candidates: [candidate],
    outputDir: join(await temporary(), 'auth-failure'), aiAdapter: fake(async () => {
      const error = new Error('private upstream credential error'); error.code = 'authorization'; throw error;
    }) });
  assert.equal(report.fakeDispatches, 1);
  assert.equal(report.semantic[0].fatalReason, 'authorization');
  assert.equal(report.semantic[0].attempts[0].reason, 'authorization');
  assert.equal(report.semantic.filter(r => r.status === 'incomplete').length, 73);
  assert.equal(JSON.stringify(report).includes('private upstream credential'), false);
});

test('cache and reasoning malformed nested counters never release reservation or discount inputs', () => {
  const rate = CUE_PRICING_SNAPSHOT.models[candidate.model];
  for (const usage of [{ prompt_tokens: 20, completion_tokens: 3, input_tokens_details: { cached_tokens: -1 } },
    { prompt_tokens: 20, completion_tokens: 3, output_tokens_details: { reasoning_tokens: 'bad' } }]) {
    assert.equal(estimateCueUsageCost(usage, rate).complete, false);
  }
});

test('unknown documented context bound refuses reservation before adapter can dispatch', async () => {
  const pricing = { models: { [candidate.model]: { inputUsdPerMillion: .15, outputUsdPerMillion: .5 } } };
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'round.json'), roundId: 'round', pricing });
  await assert.rejects(budget.reserve({ candidate, registration: {} }), /bound/i);
  assert.equal((await budget.snapshot()).attempts.length, 0);
});

test('REST adapter factory is offline until explicit invocation and sanitizes fatal HTTP failures', async () => {
  let count = 0;
  const adapter = createWorkersAiRestAdapter({ live: true, accountId: 'a'.repeat(32), apiToken: 'fake-not-a-credential',
    availableModels: [candidate.model], fetchImpl: async (_url, options) => {
      count++;
      assert.equal(options.redirect, 'error');
      return new Response('private upstream body', { status: 401 });
    } });
  assert.equal(count, 0);
  await assert.rejects(adapter.run(candidate.model, {}), error => error.code === 'authorization' && !error.message.includes('private'));
  assert.equal(count, 1);
});

test('burst relay preserves real independent SSE ledgers, cursor continuity, and exact source', async () => {
  const relay = await createReadingCueRelay({ caseData: star, candidate, schedule: 'burst', runId: 'burst-test',
    aiAdapter: fake(async () => response([literal])), frontendOrigin: 'http://127.0.0.1:5174' });
  try {
    const unknownOrigin = await fetch(`${relay.origin}/api/tarot-reading/jobs`, { method: 'POST', headers: { Origin: 'https://unowned.example' } });
    assert.equal(unknownOrigin.status, 403);
    const wrongToken = await fetch(`${relay.origin}/api/tarot-reading/visuals/${relay.startData.readingResultId}`, {
      headers: { 'X-Visual-Token': 'another-case' }
    });
    assert.equal(wrongToken.status, 403);
    relay.startSchedule();
    const report = await relay.completion;
    assert.equal(report.narrativeSourceMatchesCase, true);
    assert.equal(report.sourceMatchesCase, true);
    assert.ok(report.scheduleEvents.filter(e => e.type === 'delta').length > 3);
    const narrative = await fetch(`${relay.origin}/api/tarot-reading/jobs/${relay.startData.jobId}/stream?cursor=1`, {
      headers: { 'X-Job-Token': relay.startData.jobToken }
    });
    const text = await narrative.text();
    assert.ok(text.includes('event: done'));
    const visual = await fetch(`${relay.origin}/api/tarot-reading/visuals/${relay.startData.readingResultId}/stream`, {
      headers: { 'X-Visual-Token': relay.startData.visualJobToken }
    });
    const visualText = await visual.text();
    assert.ok(visualText.includes('event: snapshot'));
    assert.ok(visualText.includes(report.ledger.cues[0].id));
    assert.equal(visualText.includes('reasoningTokens'), false);
    assert.equal(relay.session.job.subscribers.size, 0);
  } finally { await relay.close(); }
});

test('D1 completion ordering cannot relabel per-request cancellation and provider rejection', async t => {
  const { createD1 } = await import('./helpers/d1Sqlite.mjs');
  const sourceDb = await createD1();
  const db = { rows: sourceDb.rows.bind(sourceDb), batch: sourceDb.batch.bind(sourceDb), prepare(sql) {
    const prepared = sourceDb.prepare(sql);
    if (!sql.includes('INSERT INTO inference_attempts')) return prepared;
    return { bind(...args) {
      const bound = prepared.bind(...args);
      return { async run() {
        if (args[6] === 'failed') await new Promise(resolve => setTimeout(resolve, 20));
        return bound.run();
      } };
    } };
  } };
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let dispatches = 0;
  const session = await createVisualCueSession({ caseData: star, candidate, db, aiAdapter: fake(async (_model, _input, { signal }) => {
    if (++dispatches === 1) {
      started(); await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
      return response([]);
    }
    return { response: 'malformed JSON', usage: { prompt_tokens: 10, completion_tokens: 1 } };
  }) });
  const instant = Date.now();
  t.mock.method(Date, 'now', () => instant);
  await session.observe(star.raw); await ready;
  await session.replace('A replacement.', { complete: true });
  const report = await session.finish();
  assert.deepEqual(report.attempts.map(a => a.outcome), ['failed', 'rejected']);
  assert.equal(report.attempts[0].reason, 'cancelled');
  assert.equal(report.attempts[1].reason, 'quality_rejected');
});

test('exposed request template mutation cannot weaken frozen output bound', async () => {
  const budget = await openCueRoundBudget({ path: join(await temporary(), 'round.json'), roundId: 'round' });
  const adapter = createBoundedCueAdapter({ live: false, budget, candidate, aiAdapter: fake(async () => response([])) });
  const registered = register(adapter);
  adapter.requestTemplate.max_completion_tokens = 100000;
  await assert.rejects(registered.run(candidate.model, adapter.requestTemplate), /configuration/i);
  assert.equal((await budget.snapshot()).attempts.length, 0);
});

test('actual visual client uses canonical encoded stream, snapshot recovery and reconnect routes', async () => {
  const { readVisualJobEvents } = await import('../src/lib/readingVisualStream.js');
  const relay = await createReadingCueRelay({ caseData: star, candidate, runId: 'encoded-client', schedule: 'burst' });
  const requests = [];
  let cutFirstStream = true;
  const controller = new AbortController();
  const fetchImpl = async (path, options) => {
    requests.push(path);
    const result = await fetch(new URL(path, relay.origin), options);
    assert.equal(result.status, 200);
    if (cutFirstStream && path.includes('/stream')) {
      cutFirstStream = false;
      const reader = result.body.getReader();
      const first = await reader.read();
      await reader.cancel();
      return new Response(new ReadableStream({ start(stream) { stream.enqueue(first.value); stream.close(); } }), {
        headers: { 'Content-Type': 'text/event-stream' }
      });
    }
    return result;
  };
  try {
    const events = readVisualJobEvents({ env: modelClientEnv, readingResultId: relay.startData.readingResultId,
      visualJobToken: relay.startData.visualJobToken, fetchImpl, signal: controller.signal, retryDelay: 1, maxFailures: 2 });
    assert.equal((await events.next()).value.event, 'snapshot');
    assert.equal((await events.next()).value.event, 'snapshot');
    const terminal = events.next();
    relay.startSchedule();
    assert.equal((await terminal).done, false);
    await relay.completion;
    for await (const _event of events) { /* Consume actual client terminal envelope. */ }
    const encoded = encodeURIComponent(relay.startData.readingResultId);
    assert.ok(requests.includes(`/api/tarot-reading/visuals/${encoded}`));
    assert.ok(requests.filter(path => path.includes(`/visuals/${encoded}/stream`)).length >= 2);
    const wrong = await fetch(`${relay.origin}/api/tarot-reading/visuals/${encodeURIComponent('cue:another-case')}`);
    assert.equal(wrong.status, 404);
    const doubleEncoded = await fetch(`${relay.origin}/api/tarot-reading/visuals/${encodeURIComponent(encoded)}`);
    assert.equal(doubleEncoded.status, 404);
  } finally { controller.abort(); await relay.close(); }
});

for (const stop of ['cancel', 'deadline']) {
  test(`${stop} finish drains delayed settlement without waiting for abort-ignoring inference`, { timeout: 10000 }, async t => {
    const realBudget = await openCueRoundBudget({ path: join(await temporary(), 'round.json'), roundId: 'terminal-round' });
    let release;
    let settling;
    let dispatch;
    const gate = new Promise(resolve => { release = resolve; });
    const settlementStarted = new Promise(resolve => { settling = resolve; });
    const started = new Promise(resolve => { dispatch = resolve; });
    const budget = { ...realBudget, async settle(...args) { settling(); await gate; return realBudget.settle(...args); } };
    const session = await createVisualCueSession({ caseData: star, candidate, budget,
      aiAdapter: fake(async () => { dispatch(); return new Promise(() => {}); }) });
    session.env.VISUAL_CUE_TIMEOUT_MS = stop === 'deadline' ? 10 : 60000;
    // This case covers settlement after dispatch. Real filesystem reservation
    // must finish before its 10 ms deadline fires; pre-dispatch expiry has
    // separate coverage and cannot resolve the dispatch barrier below.
    if (stop === 'deadline') t.mock.timers.enable({ apis: ['setTimeout'] });
    await session.observe(star.raw, { complete: true });
    await started;
    if (stop === 'cancel') await session.cancel();
    else t.mock.timers.tick(10);
    await settlementStarted;
    await session.state.drain();
    let finished = false;
    const reportPromise = session.finish().then(report => { finished = true; return report; });
    await tick();
    assert.equal(finished, false, 'immutable report must wait for owned accounting settlement');
    release();
    const report = await reportPromise;
    assert.equal(report.attempts[0].outcome, 'failed');
    assert.equal(report.attempts[0].reason, stop === 'deadline' ? 'timeout' : 'cancelled');
    assert.equal(report.attempts[0].heldUsd, report.attempts[0].reservedUsd);
    assert.equal(report.attempts[0].estimatedUsd, null);
    assert.equal(report.jobAttemptRowsComplete, true);
  });
}

test('identity follows runtime imports: dirty deadline/persistence bytes change it; output artifacts do not', async () => {
  const { mkdir } = await import('node:fs/promises');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execute = promisify(execFile);
  const root = await temporary();
  await mkdir(join(root, 'functions/lib'), { recursive: true });
  await mkdir(join(root, 'src/worker'), { recursive: true });
  await writeFile(join(root, 'functions/lib/visualCueProvider.js'), "import './requestDeadline.js';\n");
  await writeFile(join(root, 'src/worker/readingVisualJob.js'), "import '../../functions/lib/readingVisualResults.js';\n");
  await writeFile(join(root, 'functions/lib/requestDeadline.js'), 'export const deadline = 1;\n');
  await writeFile(join(root, 'functions/lib/readingVisualResults.js'), 'export const persistence = 1;\n');
  await execute('git', ['init', '--quiet'], { cwd: root });
  await execute('git', ['add', '.'], { cwd: root });
  await execute('git', ['-c', 'user.name=Test', '-c', 'user.email=test@invalid', 'commit', '--quiet', '-m', 'fixture'], { cwd: root });
  const options = { cases, root, phase: 'semantic', relevantPaths: ['functions/lib/visualCueProvider.js', 'src/worker/readingVisualJob.js'] };
  const first = await createCueRunIdentity(options);
  await writeFile(join(root, 'functions/lib/requestDeadline.js'), 'export const deadline = 2;\n');
  const changed = await createCueRunIdentity(options);
  assert.equal(first.head, changed.head);
  assert.notEqual(first.digest, changed.digest);
  assert.ok(changed.dirtyPaths.includes('functions/lib/requestDeadline.js'));
  assert.notEqual(first.fileDigests['functions/lib/requestDeadline.js'], changed.fileDigests['functions/lib/requestDeadline.js']);
  await writeFile(join(root, 'functions/lib/readingVisualResults.js'), 'export const persistence = 2;\n');
  const persistence = await createCueRunIdentity(options);
  assert.notEqual(changed.digest, persistence.digest);
  assert.ok(persistence.dirtyPaths.includes('functions/lib/readingVisualResults.js'));
  await writeFile(join(root, 'unrelated-output.json'), '{"receipt":true}');
  assert.deepEqual(await createCueRunIdentity(options), persistence);
});
