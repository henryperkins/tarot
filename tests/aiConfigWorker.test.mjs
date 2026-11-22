import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { ADMIN_FIXTURE_KEY, createAiConfigWorker } from './helpers/aiConfigWorker.mjs';

async function pollRun(url, headers) {
  const deadline = Date.now() + 15000;
  let result;
  do {
    result = await (await fetch(url, { headers })).json();
    if (result.status !== 'running') break;
    await sleep(50);
  } while (Date.now() < deadline);
  assert.equal(result.status, 'completed', JSON.stringify(result));
  return result;
}

test('real Worker authorizes configuration, publishes one D1 revision and runs an isolated local reading sample', { timeout: 60000 }, async (t) => {
  const worker = await createAiConfigWorker();
  t.after(() => worker.close());
  const root = worker.url + '/api/admin/ai-configuration';
  const headers = { Authorization: 'Bearer ' + ADMIN_FIXTURE_KEY, 'Content-Type': 'application/json' };
  assert.equal((await fetch(root)).status, 401);
  const initial = await (await fetch(root, { headers })).json();
  assert.equal(initial.environment, 'preview', JSON.stringify(initial));
  assert.equal(initial.features.length, 7);
  const feature = initial.features.find(item => item.id === 'readings');
  const policy = structuredClone(feature.policy);
  policy.primary.reasoningEffort = 'low';
  const payload = { policy, baseRevision: feature.revision, baseToken: feature.baseToken, mutationId: 'worker-write' };
  const put = body => fetch(root + '/features/readings', { method: 'PUT', headers, body: JSON.stringify(body) });
  const receipt = await (await put(payload)).json();
  assert.equal(receipt.revision, 1, JSON.stringify(receipt));
  assert.deepEqual(await (await put(payload)).json(), receipt);
  assert.equal((await put({ ...payload, mutationId: 'concurrent-write' })).status, 409);
  const reloaded = await (await fetch(root, { headers })).json();
  assert.deepEqual(reloaded.features.find(item => item.id === 'readings').policy, policy);
  const history = await (await fetch(root + '/history?feature=readings', { headers })).json();
  assert.deepEqual(history.entries[0].diff, [{ field: 'primary.reasoningEffort', before: 'high', after: 'low' }]);
  assert.equal(history.entries.length, 1);
  const sample = { policy, catalogVersion: initial.catalogVersion, runId: 'worker-sample' };
  const start = () => fetch(root + '/features/readings/samples', { method: 'POST', headers, body: JSON.stringify(sample) });
  const started = await start();
  assert.equal(started.status, 202, await started.clone().text());
  const { pollUrl } = await started.json();
  assert.equal((await start()).status, 202);
  assert.equal((await fetch(worker.url + pollUrl)).status, 401);
  const result = await pollRun(worker.url + pollUrl, headers);
  assert.equal(result.outcome, 'local_fallback');
  assert.deepEqual(result.attempts.map(step => step.outcome), ['skipped', 'skipped', 'skipped', 'accepted']);
  assert.equal(result.attempts.at(-1).providerId, 'local-composer');
  assert.equal(result.requestedPrimary.reasoningEffort, 'low');
  assert.ok(result.excerpt);
  for (const table of ['usage_tracking', 'inference_attempts', 'eval_metrics', 'journal_entries']) {
    assert.equal(await worker.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first('n'), 0, table);
  }
  assert.deepEqual(worker.outboundOrigins, []);
});

test('a Medium primary sample retains its true model and effort after Low is published', { timeout: 60000 }, async (t) => {
  const calls = [];
  const worker = await createAiConfigWorker({ openAIStub: async request => {
    calls.push(await request.json());
    const text = [
      '### Opening', 'There is time to consider a new direction.',
      '### Past — The Hermit', 'The Hermit asks you to pause. Give yourself space to reflect on what you have learned. Choose one insight to carry forward.',
      '### Present — Two of Wands', 'The Two of Wands invites you to weigh two possibilities. Consider each against your values. Choose a small step to explore.',
      '### Future — Eight of Pentacles', 'The Eight of Pentacles offers a way to deepen a skill. Give your practice time to develop. Notice what it teaches you.',
      '### Synthesis', 'Reflection can guide a deliberate next step. Consider what practice you want to begin.'
    ].join('\n\n');
    return Response.json({ model: 'gpt-6.1-sol-stub', status: 'completed',
      output_text: JSON.stringify({ format: 'card-scenes-v1', blocks: [{ type: 'prose', text }] }) });
  } });
  t.after(() => worker.close());
  const root = worker.url + '/api/admin/ai-configuration';
  const headers = { Authorization: 'Bearer ' + ADMIN_FIXTURE_KEY, 'Content-Type': 'application/json' };
  const { features, catalogVersion } = await (await fetch(root, { headers })).json();
  const saved = features.find(feature => feature.id === 'readings');
  assert.equal(saved.policy.primary.reasoningEffort, 'high');
  const draft = structuredClone(saved.policy);
  draft.primary.reasoningEffort = 'medium';
  const response = await fetch(root + '/features/readings/samples', { method: 'POST', headers,
    body: JSON.stringify({ runId: 'sampled-medium', catalogVersion, policy: draft }) });
  assert.equal(response.status, 202);
  const { pollUrl } = await response.json();
  const result = await pollRun(worker.url + pollUrl, headers);
  assert.equal(result.outcome, 'primary_accepted');
  assert.deepEqual(calls.map(call => call.reasoning.effort), ['medium']);
  assert.equal(result.attempts[0].modelId, 'gpt-6.1-sol-stub');
  assert.equal(result.attempts[0].modelSource, 'reported');
  draft.primary.reasoningEffort = 'low';
  const committed = await fetch(root + '/features/readings', { method: 'PUT', headers,
    body: JSON.stringify({ baseRevision: saved.revision, baseToken: saved.baseToken, mutationId: 'save-low', policy: draft }) });
  assert.equal((await committed.json()).policy.primary.reasoningEffort, 'low');
  const priorRun = await pollRun(worker.url + pollUrl, headers);
  assert.deepEqual(priorRun, result);
  const refreshed = await (await fetch(root, { headers })).json();
  assert.equal(refreshed.features.find(feature => feature.id === 'readings').policy.primary.reasoningEffort, 'low');
  assert.deepEqual(worker.outboundOrigins, []);
});
