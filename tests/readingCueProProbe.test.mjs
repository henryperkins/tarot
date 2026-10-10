import assert from 'node:assert/strict';
import { access, chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { preflightRealProProbes } from '../scripts/lib/readingCueProProbe.mjs';
import { openCueRoundBudget } from '../scripts/evaluation/lib/visualCueEvaluationBudget.mjs';

const DEFINITION = 'a'.repeat(64);
const CANDIDATE = 'glm-5.3-flash-low';

async function privateFiles(t, { config = {}, eligibility = {} } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cue-pro-probe-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const eligibilityPath = path.join(dir, 'eligibility.json');
  await writeFile(eligibilityPath, JSON.stringify({ semanticEligible: true, runIdentityDigest: DEFINITION, candidateId: CANDIDATE, ...eligibility }), { mode: 0o600 });
  await writeFile(path.join(dir, 'round.json'), '{}', { mode: 0o600 });
  const configPath = path.join(dir, 'probe.json');
  await writeFile(configPath, JSON.stringify({ scope: 'real-pro-probe', narrativeProvider: 'codex-subscription',
    narrativeModel: 'gpt-6.1-sol', narrativeEffort: 'high', visualBudgetGateway: 'http://127.0.0.1:41000/', visualCandidateId: CANDIDATE,
    plannedVisualCalls: 4, roundId: 'round', roundBudgetPath: path.join(dir, 'round.json'), roundMaxCalls: 20, roundMaxEstimatedUsd: 3,
    eligibilityRecordPath: eligibilityPath,
    isolation: { ports: { worker: 41001, frontend: 41002, gateway: 41003, inspector: 41004 }, privateDirectory: path.join(dir, 'runtime') },
    ...config }), { mode: 0o600 });
  return { dir, configPath, eligibilityPath };
}
const budget = (snapshot = {}, decision = { allowed: true, reservedUsd: 0.2, remainingUsd: 3, reason: null }) => async () => ({
  snapshot: async () => ({ maxCalls: 20, attempts: [], halted: false, closed: false, maxEstimatedUsd: 3, heldUsd: 0,
    definitionSha256: DEFINITION, phases: [{ phaseId: 'phase:semantic', definitionSha256: DEFINITION }], ...snapshot }),
  canReserve: async () => decision });
const env = configPath => ({ CUE_REAL_PRO_PROBES: 'true', CUE_REAL_PRO_CONFIG: configPath });

test('without explicit opt-in nothing is read and no ledger is touched', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('preflight must not reach the network'));
  const untouched = { lstat: () => assert.fail('no file read'), readFile: () => assert.fail('no file read'), realpath: () => assert.fail('no file read') };
  const { configPath } = await privateFiles(t);
  for (const optIn of [undefined, 'false', '1']) {
    const result = await preflightRealProProbes({ env: { CUE_REAL_PRO_PROBES: optIn, CUE_REAL_PRO_CONFIG: configPath }, fs: untouched,
      openBudget: () => assert.fail('no ledger opened') });
    assert.deepEqual(result, { allowed: false, reasons: ['opt-in-absent'], plan: null });
  }
  const missing = await preflightRealProProbes({ env: { CUE_REAL_PRO_PROBES: 'true' } });
  assert.deepEqual(missing.reasons, ['private-config-absent', 'eligibility-record-absent', 'round-budget-unavailable']);
});

test('private configuration must be an owned 0600 regular file', async t => {
  const { dir, configPath } = await privateFiles(t);
  await chmod(configPath, 0o644);
  assert.ok((await preflightRealProProbes({ env: env(configPath), openBudget: budget() })).reasons.includes('private-config-permissions'));
  await chmod(configPath, 0o600);
  const link = path.join(dir, 'link.json'); await symlink(configPath, link);
  assert.ok((await preflightRealProProbes({ env: env(link), openBudget: budget() })).reasons.includes('private-config-not-regular-file'));
  assert.ok((await preflightRealProProbes({ env: env(configPath), uid: 1, openBudget: budget() })).reasons.includes('private-config-owner'));
  assert.ok((await preflightRealProProbes({ env: env('relative.json'), openBudget: budget() })).reasons.includes('private-config-absent'));
});

test('protected or invalid ports, an unnamed candidate and the wrong narrative configuration refuse probes', async t => {
  for (const [config, reason] of [
    [{ isolation: { ports: { worker: 8787, frontend: 41002, gateway: 41003, inspector: 41004 }, privateDirectory: '/tmp/x' } }, 'isolation'],
    [{ isolation: { ports: { worker: 41001, frontend: 41001, gateway: 41003, inspector: 41004 }, privateDirectory: '/tmp/x' } }, 'isolation'],
    [{ visualBudgetGateway: undefined }, 'visual-budget-gateway-absent'],
    [{ visualBudgetGateway: 'https://example.com/' }, 'visual-budget-gateway-absent'],
    [{ visualBudgetGateway: 'http://127.0.0.1:8787/' }, 'visual-budget-gateway-absent'],
    [{ visualBudgetGateway: 'http://127.0.0.1:99999/' }, 'visual-budget-gateway-absent'],
    [{ visualBudgetGateway: 'http://127.0.0.1:0/' }, 'visual-budget-gateway-absent'],
    [{ visualCandidateId: undefined }, 'visual-candidate'],
    [{ visualCandidateId: 'unlisted' }, 'visual-candidate'],
    [{ narrativeModel: 'gpt-5' }, 'narrative-configuration'],
    [{ scope: 'other' }, 'config-scope'],
    [{ plannedVisualCalls: 0 }, 'planned-visual-calls']]) {
    const { configPath } = await privateFiles(t, { config });
    const result = await preflightRealProProbes({ env: env(configPath), openBudget: budget() });
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.includes(reason), `${reason}: ${result.reasons}`);
  }
});

test('semantic eligibility must be bound to this round, its phase and the chosen candidate', async t => {
  for (const eligibility of [{ semanticEligible: false }, { runIdentityDigest: 'anything' }, { candidateId: 'glm-5.3-high' }]) {
    const { configPath } = await privateFiles(t, { eligibility });
    assert.ok((await preflightRealProProbes({ env: env(configPath), openBudget: budget() })).reasons.includes('semantic-ineligible'), JSON.stringify(eligibility));
  }
  const { configPath } = await privateFiles(t);
  assert.deepEqual((await preflightRealProProbes({ env: env(configPath), openBudget: budget({ definitionSha256: 'b'.repeat(64) }) })).reasons, ['eligibility-unbound']);
  assert.deepEqual((await preflightRealProProbes({ env: env(configPath), openBudget: budget({ phases: [] }) })).reasons, ['eligibility-unbound']);
});

test('the whole planned probe must fit the conservative same-round allowance', async t => {
  const { configPath } = await privateFiles(t);
  for (const snapshot of [{ attempts: Array(18).fill({}) }, { halted: true }, { closed: true }, { heldUsd: 3 }, { heldUsd: 2.9999 }]) {
    assert.deepEqual((await preflightRealProProbes({ env: env(configPath), openBudget: budget(snapshot) })).reasons, ['insufficient-allowance']);
  }
  // Four calls at $1 each cannot fit $3, even though money remains.
  assert.deepEqual((await preflightRealProProbes({ env: env(configPath), openBudget: budget({}, { allowed: true, reservedUsd: 1, remainingUsd: 3 }) })).reasons, ['insufficient-allowance']);
  assert.deepEqual((await preflightRealProProbes({ env: env(configPath), openBudget: budget({}, { allowed: false, reservedUsd: 5, remainingUsd: 3, reason: 'candidate-cost-bound' }) })).reasons, ['insufficient-allowance']);
  assert.deepEqual((await preflightRealProProbes({ env: env(configPath), openBudget: async () => { throw new Error('locked'); } })).reasons,
    ['round-budget-unavailable']);
});

test('an absent, non-canonical or linked ledger path is never opened', async t => {
  const { dir, configPath } = await privateFiles(t);
  let opened = 0;
  const counting = async options => { opened += 1; return budget()(options); };
  await rm(path.join(dir, 'round.json'));
  assert.deepEqual((await preflightRealProProbes({ env: env(configPath), openBudget: counting })).reasons, ['round-budget-unavailable']);
  await mkdir(path.join(dir, 'real')); await writeFile(path.join(dir, 'real', 'round.json'), '{}', { mode: 0o600 });
  await symlink(path.join(dir, 'real'), path.join(dir, 'link'));
  for (const roundBudgetPath of [path.join(dir, 'link', 'round.json'), `${dir}/real/../real/round.json`, 'round.json', 42]) {
    const linked = await privateFiles(t, { config: { roundBudgetPath } });
    assert.deepEqual((await preflightRealProProbes({ env: env(linked.configPath), openBudget: counting })).reasons, ['round-budget-unavailable'], String(roundBudgetPath));
  }
  assert.equal(opened, 0);
});

test('the real round ledger is opened only if it exists and admits a fully bound plan', async t => {
  const { dir, configPath } = await privateFiles(t);
  const ledgerPath = path.join(dir, 'round.json');
  await rm(ledgerPath);
  // requireExisting never creates a fresh allowance, even if the file disappears after the path check.
  await assert.rejects(openCueRoundBudget({ path: ledgerPath, roundId: 'round', mode: 'live', maxCalls: 20, maxEstimatedUsd: 3, requireExisting: true }), /absent/);
  await assert.rejects(access(ledgerPath));
  const shared = await openCueRoundBudget({ path: ledgerPath, roundId: 'round', mode: 'live', maxCalls: 20, maxEstimatedUsd: 3 });
  await shared.snapshot();
  assert.deepEqual((await preflightRealProProbes({ env: env(configPath), openBudget: openCueRoundBudget })).reasons, ['eligibility-unbound']);
  await shared.bindDefinition(DEFINITION);
  await shared.registerPhase({ phaseId: 'phase:semantic', definitionSha256: DEFINITION });
  const other = await privateFiles(t, { config: { roundBudgetPath: ledgerPath }, eligibility: { runIdentityDigest: 'c'.repeat(64) } });
  assert.deepEqual((await preflightRealProProbes({ env: env(other.configPath), openBudget: openCueRoundBudget })).reasons, ['eligibility-unbound']);
  const result = await preflightRealProProbes({ env: env(configPath), openBudget: openCueRoundBudget });
  assert.equal(result.allowed, true, result.reasons.join(','));
  assert.deepEqual(result.plan, { readings: ['three-card-rws', 'five-card-rws'], plannedVisualCalls: 4, candidateId: CANDIDATE,
    model: '@cf/zai-org/glm-5.3-flash', eligibilityRunIdentity: DEFINITION });
  assert.equal((await shared.snapshot()).attempts.length, 0);
});
