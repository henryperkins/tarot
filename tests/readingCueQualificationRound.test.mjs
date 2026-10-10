import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { runCueQualificationRound, parseCueQualificationRoundArgs, main, createCueRoundOwnership, createBlindedCuePackets, verifyCueLivePreflight, verifyCueLiveCatalog } from '../scripts/evaluation/runReadingCueQualificationRound.mjs';
import { openCueRoundBudget, DEFAULT_CUE_CANDIDATES } from '../scripts/evaluation/lib/visualCueEvaluationHarness.mjs';
const temporary = () => mkdtemp(join(tmpdir(), 'cue-round-test-'));
const candidate = DEFAULT_CUE_CANDIDATES[0];
const manifest = JSON.parse(await readFile(new URL('../scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json', import.meta.url), 'utf8'));
const subset = { ...manifest, cases: manifest.cases.filter(c => c.id === 'star-2347-excerpt') };
delete subset.manifestSha256;
const options = async phase => { const parent = await temporary(); return { phase, manifest: subset, candidates: [candidate], outputDir: join(parent, phase), roundId: 'new-offline-round', roundBudgetPath: join(parent, 'budget.json') }; };

test('offline semantic subset preserves both trials without browser, credential discovery or model calls', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('offline attempted network'));
  const config = await options('semantic');
  const report = await runCueQualificationRound({ ...config, explicitLiveConfiguration: { get apiToken() { throw new Error('offline touched credentials'); } } });
  assert.equal(report.modelCalls, 0);
  assert.equal(report.fakeDispatches, 0);
  assert.equal(report.plan.semantic.length, 2);
  assert.equal(report.semantic.length, 2);
  assert.equal(report.plan.timing.length, 0);
  assert.equal(report.fullyQualified, false);
  assert.equal(report.admissionComplete, false);
  assert.equal(report.independentSemanticComplete, false);
  assert.deepEqual(report.plan.expectedTrials.map(t => t.caseIds), [['star-2347-excerpt'], ['star-2347-excerpt']]);
  await assert.rejects(runCueQualificationRound(config), /immutable|exists/i);
});

test('immutable phases share a persistent ledger and reject changed frozen inputs', async () => {
  const config = await options('semantic');
  const first = await runCueQualificationRound(config);
  const budget = await openCueRoundBudget({ path: config.roundBudgetPath, roundId: config.roundId });
  const attempt = await budget.reserve({ candidate, registration: { phase: 'external-fresh-probe' } });
  await budget.settle(attempt.id, { outcome: 'failed', reason: 'timeout' });
  const second = await runCueQualificationRound({ ...config, phase: 'timing', outputDir: join(config.outputDir, '..', 'timing') });
  assert.equal(first.definition.digest, second.definition.digest);
  assert.equal(second.initialBudget.attempts.length, 1);
  assert.equal(second.budget.attempts.length, 1);
  assert.equal(second.modelCalls, 0);
  assert.equal(second.phaseAttemptIds.length, 0);
  assert.equal(second.accountingComplete, false);
  assert.ok(second.timing.some(r => r.reason === 'missing-required-timing-case'));
  await assert.rejects(runCueQualificationRound({ ...config, candidates: [DEFAULT_CUE_CANDIDATES[1]], outputDir: join(config.outputDir, '..', 'changed') }), /definition|identity/i);
});

test('explicit candidate order and exact parent-only repeats remain frozen', async () => {
  const config = await options('semantic');
  const report = await runCueQualificationRound({ ...config, manifest, candidates: [DEFAULT_CUE_CANDIDATES[2], candidate] });
  assert.deepEqual(report.definition.candidates.map(c => c.id), ['glm-5.3-flash-low', 'glm-5.3-high']);
  assert.equal(report.plan.semantic.length, 148);
  assert.equal(report.plan.expectedTrials[1].caseIds.length, 12);
  assert.equal(report.preflight.semanticCallsUpperBound, 148);
  assert.ok(report.preflight.conservativeUsdUpperBound > 15);
  assert.equal(report.preflight.wholePlanFits, false);
  assert.equal(report.semantic.length, 148);
});

test('timing preflight counts every possible growing prefix rather than a hidden three-call cap', async () => {
  const config = await options('timing');
  const report = await runCueQualificationRound({ ...config, manifest });
  assert.equal(report.plan.timing.length, 6);
  assert.ok(report.preflight.timingCallsUpperBound > 18);
  assert.ok(report.plan.timing.filter(p => p.scenario === 'paced').every(p => p.callsUpperBound > 3));
  assert.equal(report.timing.length, 6);
});

test('CLI rejects plain live, mixed modes, unknown candidates and invalid ceilings before resources', async () => {
  await assert.rejects(main(['--live']), /private|explicit/i);
  assert.throws(() => parseCueQualificationRoundArgs(['--live', '--dry-run']), /either|conflict/i);
  assert.throws(() => parseCueQualificationRoundArgs(['--dry-run', '--private-config', '/must-not-read']), /live/i);
  for (const input of [{ phase: 'bad' }, { candidates: ['unknown'] }, { maxCalls: 601 }, { maxEstimatedUsd: 16 }]) {
    await assert.rejects(runCueQualificationRound({ ...(await options('semantic')), ...input }), /invalid|unknown/i);
  }
});

test('closed historical round identity refuses admission even under unused ceilings', async () => {
  const config = await options('semantic');
  await assert.rejects(runCueQualificationRound({ ...config, roundId: 'live-20261010-task6' }), /closed|historical/i);
  await assert.rejects(openCueRoundBudget({ path: config.roundBudgetPath, roundId: 'live-20261010-task6' }), /closed|historical/i);
});

test('legacy ledger inspection preserves exact bytes and cannot resume reservations', async () => {
  const config = await options('semantic');
  await openCueRoundBudget({ path: config.roundBudgetPath, roundId: 'legacy-inspection' });
  const current = JSON.parse(await readFile(config.roundBudgetPath, 'utf8'));
  const legacy = { ...current, version: 1 };
  delete legacy.admissions; delete legacy.corrections; delete legacy.phases;
  const bytes = JSON.stringify(legacy);
  await writeFile(config.roundBudgetPath, bytes);
  const reopened = await openCueRoundBudget({ path: config.roundBudgetPath, roundId: 'legacy-inspection' });
  assert.equal((await reopened.snapshot()).attempts.length, 0);
  await assert.rejects(reopened.reserve({ candidate }), /historical|read-only/i);
  assert.equal(await readFile(config.roundBudgetPath, 'utf8'), bytes);
});

test('resource acquired after an earlier stop still receives owned cleanup', async () => {
  const owner = createCueRoundOwnership({ signals: false });
  await owner.stop('exception');
  let closed = false;
  owner.own({ close: async () => { closed = true; } }, 'frontend');
  await owner.stop('exception');
  assert.equal(closed, true);
  owner.dispose();
});

test('CLI rejects readable-by-others or symlinked private configuration without network', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('invalid private file reached network'));
  const directory = await temporary();
  const path = join(directory, 'config.json');
  await writeFile(path, '{"apiToken":"private-must-not-escape"}', { mode: 0o644 });
  await assert.rejects(main(['--live', '--private-config', path]), /0600|private/i);
  await chmod(path, 0o600);
  const link = join(directory, 'link'); await symlink(path, link);
  await assert.rejects(main(['--live', '--private-config', link]), /regular|symlink|private/i);
});

test('blinded packets allowlist outputs, remap dependency IDs, and retain empty/failed trials', () => {
  const results = [{ candidateId: 'secret-model-low', caseId: 'star', trialId: 'repeat-1', status: 'complete', latency: 333, prompt: 'private-prompt', usage: { input_tokens: 12 },
    ledger: { raw: 'Recorded prose', cues: [{ id: 'private-source-id', kind: 'literal', passage: { start: 0, end: 8, quote: 'Recorded' }, targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }], privateDebug: 'private-prompt' },
      { id: 'private-return-id', kind: 'interpretation', passage: { start: 9, end: 14 }, quote: 'prose', targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }], establishedBy: ['private-source-id'] }] } },
  { candidateId: 'secret-model-low', caseId: 'star', trialId: 'repeat-2', status: 'failed', reason: 'authorization', attempts: [] }];
  const { packets, joins } = createBlindedCuePackets({ results });
  assert.equal(packets.length, 2);
  const serialized = JSON.stringify(packets);
  for (const privateValue of ['secret-model', 'private-source-id', 'private-return-id', 'private-prompt', 'latency', 'usage', 'authorization']) assert.equal(serialized.includes(privateValue), false);
  const findPacket = trialId => packets.find(packet => packet.packetId === joins.find(join => join.trialId === trialId).packetId);
  const complete = findPacket('repeat-1');
  assert.equal(complete.cues[1].establishedBy[0], complete.cues[0].id);
  assert.equal(complete.cues[0].quote, 'Recorded');
  assert.equal(findPacket('repeat-2').cues.length, 0);
  assert.equal(findPacket('repeat-2').status, 'incomplete');
  assert.equal(joins.length, 2);
});

test('blinded presentations independently shuffle identical case/trial candidate blocks', () => {
  const results = ['candidate-a', 'candidate-b', 'candidate-c'].flatMap(candidateId =>
    Array.from({ length: 4 }, (_, index) => ({ candidateId, caseId: 'identical-case', trialId: `repeat-${index + 1}`,
      status: 'complete', ledger: { raw: `output-${candidateId.at(-1)}-${index}`, cues: [] } })));
  const presentations = Array.from({ length: 3 }, () => {
    const { packets, joins } = createBlindedCuePackets({ results });
    assert.equal(packets.length, results.length);
    assert.equal(new Set(packets.map(packet => packet.packetId)).size, results.length);
    assert.equal(new Set(joins.map(join => join.packetId)).size, results.length);
    const sourceOrder = packets.map(packet => {
      const join = joins.find(join => join.packetId === packet.packetId);
      const index = results.findIndex(result => result.candidateId === join.candidateId && result.trialId === join.trialId);
      assert.equal(packet.raw, results[index].ledger.raw);
      assert.equal(packet.caseId, join.caseId);
      assert.equal(packet.trialId, join.trialId);
      assert.equal(Object.hasOwn(packet, 'candidateId'), false);
      return index;
    });
    assert.deepEqual([...sourceOrder].sort((a, b) => a - b), results.map((_result, index) => index));
    return sourceOrder.join(',');
  });
  // Twelve packets give 12! possible orders; three independent presentations
  // must not expose one fixed candidate-block order through public positions.
  assert.ok(new Set(presentations).size > 1);
  assert.ok(presentations.some(order => order !== results.map((_result, index) => index).join(',')));
});

test('owned cleanup cancels active work, drains delayed settlement and closes only registered resources', async () => {
  const owner = createCueRoundOwnership({ signals: false });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const evidence = [];
  owner.own({ cancel: async () => { evidence.push('cancel'); }, finish: async () => { await gate; evidence.push('settled'); } }, 'session');
  owner.own({ close: async () => { evidence.push('close'); } }, 'frontend');
  const stopping = owner.stop('SIGTERM');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(evidence, ['cancel']);
  release(); await stopping;
  assert.deepEqual(evidence, ['cancel', 'settled', 'close']);
  await owner.stop('SIGTERM');
  assert.equal(evidence.length, 3);
  assert.equal(owner.stopped, true);
  owner.dispose();
});

test('SIGTERM invokes owned settlement/cleanup before child exit and leaves unrelated listener intact', async () => {
  const { createServer } = await import('node:http');
  const listener = createServer((_q, response) => response.end('unrelated'));
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const directory = await temporary();
  const path = join(directory, 'terminal.json');
  const module = new URL('../scripts/evaluation/runReadingCueQualificationRound.mjs', import.meta.url).href;
  const fixture = join(directory, 'child.mjs');
  await writeFile(fixture, `import { createCueRoundOwnership } from ${JSON.stringify(module)}; import { writeFile } from 'node:fs/promises'; const owner=createCueRoundOwnership(); owner.own({cancel:async()=>{},finish:async()=>{await new Promise(r=>setTimeout(r,20));await writeFile(process.argv[2],JSON.stringify({settled:true}));}},'session'); process.stdout.write('ready\\n'); const timer=setInterval(()=>{},1000); owner.signal.addEventListener('abort',()=>owner.stop('SIGTERM').then(()=>{clearInterval(timer);owner.dispose();}));`);
  const child = spawn(process.execPath, [fixture, path], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  try {
    await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
    child.kill('SIGTERM');
    assert.deepEqual(await exited, { code: 0, signal: null }, stderr);
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { settled: true });
    assert.equal(await (await fetch(`http://127.0.0.1:${listener.address().port}`)).text(), 'unrelated');
  } finally { child.kill('SIGTERM'); await new Promise(resolve => listener.close(resolve)); }
});

test('standalone offline driver ignores ambient secrets and never opens a private file', async () => {
  const config = await options('semantic');
  const path = join(config.outputDir, '..', 'manifest.json'); await writeFile(path, JSON.stringify(subset));
  const script = new URL('../scripts/evaluation/runReadingCueQualificationRound.mjs', import.meta.url);
  const result = await promisify(execFile)(process.execPath, [script.pathname, '--dry-run', '--phase', 'semantic', '--manifest', path,
    '--candidate', candidate.id, '--output', config.outputDir, '--round-id', config.roundId, '--round-budget', config.roundBudgetPath],
  { env: { PATH: process.env.PATH, CLOUDFLARE_API_TOKEN: 'ambient-must-not-escape', PRIVATE_CONFIG: '/not-to-read' } });
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.modelCalls, 0);
  assert.equal(summary.qualified, false);
  assert.equal(result.stdout.includes('ambient'), false);
});

test('live preflight freezes current official bounds and fails closed on unparseable docs', async () => {
  const fetchImpl = async url => new Response(`@cf/zai-org/${url.includes('flash') ? 'glm-5.3-flash' : 'glm-5.3'}\nContext Window | ${url.includes('flash') ? '1,310,720' : '1,048,576'} tokens\nUnit Pricing | $${url.includes('flash') ? '.15' : '1.40'} per M input tokens, $${url.includes('flash') ? '.50' : '4.40'} per M output tokens, $${url.includes('flash') ? '.03' : '.26'} per M cached input tokens\nReasoning | low high max`);
  const preflight = await verifyCueLivePreflight({ candidates: [candidate], fetchImpl });
  assert.equal(preflight.pricing.models[candidate.model].contextWindowTokens, 1310720);
  assert.ok(preflight.documents[0].sha256);
  assert.ok(preflight.retrievedAt);
  await assert.rejects(verifyCueLivePreflight({ candidates: [candidate], fetchImpl: async () => new Response('unknown') }), /official|pricing|bound/i);
});

test('account catalog preflight uses exact explicit scope and rejects unavailable candidates', async () => {
  const result = await verifyCueLiveCatalog({ accountId: 'a'.repeat(32), apiToken: 'offline-not-credential', candidates: [candidate], fetchImpl: async (url, options) => {
    assert.ok(url.includes('/ai/models/search?'));
    assert.equal(new URL(url).searchParams.get('search'), candidate.model);
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({ success: true, result: [{ name: candidate.model, private: 'must-not-persist' }] }));
  } });
  assert.deepEqual(result.availableModels, [candidate.model]);
  assert.equal(JSON.stringify(result).includes('must-not-persist'), false);
  assert.equal(JSON.stringify(result).includes('offline-not-credential'), false);
  await assert.rejects(verifyCueLiveCatalog({ accountId: 'a'.repeat(32), apiToken: 'offline-not-credential', candidates: [candidate],
    fetchImpl: async () => new Response(JSON.stringify({ success: true, result: [] })) }), /catalog|unavailable/i);
});

test('mocked live coordinator preserves phase counts and terminal authorization denominators', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('/ai/models/search')) return new Response(JSON.stringify({ success: true, result: [{ name: candidate.model }] }));
    return new Response(`@cf/zai-org/glm-5.3-flash\nContext Window | 1,310,720 tokens\nUnit Pricing | $0.15 per M input tokens, $0.50 per M output tokens, $0.03 per M cached input tokens\nReasoning | low high max`);
  });
  const report = await runCueQualificationRound({ ...(await options('semantic')), live: true, explicitLiveConfiguration: {
    accountId: 'a'.repeat(32), apiToken: 'offline-not-credential', availableModels: [candidate.model],
    fetchImpl: async () => new Response(JSON.stringify({ success: false, result: { usage: { input_tokens: 10, output_tokens: 1 }, model: candidate.model } }), { status: 401 })
  } });
  assert.equal(report.modelCalls, 1);
  assert.equal(report.phaseAttemptIds.length, 1);
  assert.equal(report.semantic.length, 2);
  assert.equal(report.semantic[0].attempts.length, 1);
  assert.equal(report.semantic[0].jobAttemptRowsComplete, true);
  assert.equal(report.semantic[1].reason, 'authorization');
  assert.equal(report.budget.halted, true);
  assert.equal(report.fullyQualified, false);
  assert.equal(JSON.stringify(report).includes('offline-not-credential'), false);
});
