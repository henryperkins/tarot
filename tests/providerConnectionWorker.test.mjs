import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { test } from 'node:test';
import { ADMIN_FIXTURE_KEY, createAiConfigWorker } from './helpers/aiConfigWorker.mjs';

test('portal credential changes reach real Worker health routes and the sample Durable Object', { timeout: 60000 }, async t => {
  const authorizations = [];
  const generated = [
    '### Opening', 'Give yourself time to think through this change.',
    '### Past — The Hermit', 'The Hermit invites you to pause. Think back on an experience that mattered. Write down one lesson you can carry forward.',
    '### Present — Two of Wands', 'The Two of Wands suggests looking at two possible paths. Give yourself room to weigh them. Choose one small step to explore.',
    '### Future — Eight of Pentacles', 'The Eight of Pentacles invites steady practice. Pick one skill to work on today. See what the repetition teaches you.',
    '### Synthesis', 'Bring the lesson you identified into your next small step. Leave time to reflect on what you learn.'
  ].join('\n\n');
  const worker = await createAiConfigWorker({
    openAIStub: request => {
      authorizations.push(request.headers.get('Authorization'));
      return Response.json({ model: 'gpt-6.1-sol-stub', status: 'completed',
        output_text: JSON.stringify({ format: 'card-scenes-v1', blocks: [{ type: 'prose', text: generated }] }) });
    }
  });
  t.after(() => worker.close());
  const root = worker.url + '/api/admin/ai-configuration';
  const headers = { Authorization: 'Bearer ' + ADMIN_FIXTURE_KEY, 'Content-Type': 'application/json' };
  async function put(id, action, baseRevision, values) {
    const response = await fetch(root + '/connections/' + id, { method: 'PUT', headers,
      body: JSON.stringify({ action, baseRevision, values }) });
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()).connection;
  }
  async function tts() {
    const response = await fetch(worker.url + '/api/tts');
    assert.equal(response.status, 200);
    return (await response.json()).providers.find(provider => provider.id === 'elevenlabs').available;
  }
  async function primary() {
    const response = await fetch(worker.url + '/api/health/tarot-reading');
    assert.equal(response.status, 200);
    return (await response.json()).provider;
  }
  const initial = await (await fetch(root, { headers })).json();
  const { policy } = initial.features.find(f => f.id === 'readings');
  async function sample(runId) {
    const start = await fetch(root + '/features/readings/samples', { method: 'POST', headers,
      body: JSON.stringify({ runId, catalogVersion: initial.catalogVersion, policy }) });
    assert.equal(start.status, 202, await start.clone().text());
    const url = new URL((await start.json()).pollUrl, worker.url);
    const end = Date.now() + 15000;
    do {
      const response = await fetch(url, { headers });
      assert.equal(response.status, 200);
      const receipt = await response.json();
      if (receipt.status === 'completed') return { url, receipt };
      assert.equal(receipt.status, 'running', JSON.stringify(receipt));
      await sleep(50);
    } while (Date.now() < end);
    assert.fail('Timed out awaiting the sample receipt');
  }

  assert.equal(await tts(), false);
  assert.equal((await put('elevenlabs', 'replace', 0, { apiKey: 'fixture-tts-key' })).configured, true);
  assert.equal(await tts(), true);
  assert.equal((await put('elevenlabs', 'disconnect', 1)).configured, false);
  assert.equal(await tts(), false);

  assert.equal((await put('openai-native', 'replace', 0, { apiKey: 'fixture-portal-openai' })).source, 'portal');
  assert.equal(await primary(), 'openai-native');
  const { url, receipt } = await sample('portal-credential');
  assert.equal(receipt.outcome, 'primary_accepted');
  assert.equal(receipt.attempts.find(a => a.outcome === 'accepted').providerId, 'openai-native');
  assert.ok(authorizations.length);
  assert.ok(authorizations.every(value => value === 'Bearer fixture-portal-openai'));
  authorizations.length = 0;
  assert.equal((await put('openai-native', 'disconnect', 1)).configured, false);
  assert.equal(await primary(), 'local');
  assert.equal((await sample('disconnected')).receipt.outcome, 'local_fallback');
  assert.deepEqual(authorizations, []);

  assert.equal((await put('openai-native', 'reset', 2)).source, 'deployment');
  assert.equal(await primary(), 'openai-native');
  assert.equal((await sample('reset-credential')).receipt.outcome, 'primary_accepted');
  assert.ok(authorizations.length);
  assert.ok(authorizations.every(value => value === 'Bearer stub-transport-only'));

  await worker.db.prepare('ALTER TABLE ai_provider_connections RENAME TO simulated_storage_outage').run();
  assert.equal((await fetch(root + '/connections', { headers })).status, 503);
  assert.deepEqual(await (await fetch(url, { headers })).json(), receipt);
  assert.deepEqual(worker.outboundOrigins, []);
});
