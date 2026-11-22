import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdminAiSamples } from '../src/worker/adminAiSamples.js';

// Exercise storage lifetime without waiting 15 minutes or invoking a provider.
function sampleState() {
  const rows = new Map();
  const storage = {
    get: key => rows.get(key),
    put: (key, value) => rows.set(key, value),
    delete: key => rows.delete(key),
    list: () => new Map(rows),
    setAlarm: time => { storage.alarmAt = time; },
    transaction: callback => callback(storage)
  };
  return { rows, storage, blockConcurrencyWhile(work) { this.ready = work(); }, waitUntil() {} };
}

test('an unexpired legacy GLM receipt preserves its submitted effort and displays its effective level', async () => {
  const state = sampleState();
  const jobs = new AdminAiSamples(state, {});
  await state.ready;
  const key = '/guided-questions/old-run';
  const policy = { primary: { providerId: 'workers-ai', modelId: '@cf/zai-org/glm-5.3', reasoningEffort: 'medium' }, fallbacks: [] };
  const attempts = [{ slot: 0, ...policy.primary, modelId: 'upstream-reported-alias', effortSent: 'medium', outcome: 'accepted' }];
  state.rows.set(key, { status: 'completed', policy, attempts, expiresAt: Date.now() + 60000 });
  const receipt = await (await jobs.fetch(new Request('https://fixture.internal' + key))).json();
  assert.equal(receipt.attempts[0].effortSent, 'medium');
  assert.equal(receipt.attempts[0].effectiveEffort, 'max');
  assert.equal(state.rows.get(key).attempts[0].effectiveEffort, undefined);
});

test('sample reservations coalesce retries, reject a conflicting payload, and bound concurrent runs', async () => {
  const state = sampleState();
  const jobs = new AdminAiSamples(state, {});
  await state.ready;
  let started = 0;
  jobs.execute = async () => { started++; };
  function start(runId, fingerprint) {
    return jobs.fetch(new Request('https://internal/readings/' + runId, {
      method: 'POST', body: JSON.stringify({ featureId: 'readings', environment: 'local', runId,
        policyFingerprint: fingerprint, fixtureVersion: 'v1', policy: { primary: { providerId: 'openai-native' }, fallbacks: [] } })
    }));
  }
  assert.equal((await start('first', 'abc')).status, 202);
  assert.equal((await start('first', 'abc')).status, 202);
  assert.equal((await start('first', 'def')).status, 409);
  assert.equal((await start('second', 'ghi')).status, 202);
  assert.equal((await start('third', 'jkl')).status, 429);
  assert.equal(started, 2);
  const running = await (await jobs.fetch(new Request('https://internal/readings/first'))).json();
  assert.equal(running.status, 'running');
  assert.equal(running.policy.primary.providerId, 'openai-native');

  const restored = new AdminAiSamples(state, {});
  await state.ready;
  const interrupted = await (await restored.fetch(new Request('https://internal/readings/first'))).json();
  assert.equal(interrupted.status, 'failed');
  assert.match(interrupted.reason, /interrupted/i);
  assert.equal(started, 2);
  state.rows.get('/readings/first').expiresAt = Date.now() - 1;
  await restored.alarm();
  assert.equal((await restored.fetch(new Request('https://internal/readings/first'))).status, 404);
  assert.ok(state.storage.alarmAt > Date.now());
});
