import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiConfigWorker, ADMIN_FIXTURE_KEY } from './helpers/aiConfigWorker.mjs';
import { fetchCodexSubscriptionModels } from '../functions/lib/codexSubscriptionModels.js';

test('hosted admins fetch the deployment subscription catalog without changing public routing', async t => {
  const gatewayToken = 'fixture-gateway-bearer';
  const catalog = { provider: 'codex-subscription', models: [{ id: 'gpt-test', label: 'Test model' }] };
  let calls = 0;
  let reply = () => Response.json(catalog);
  const worker = await createAiConfigWorker({
    bindings: { AI_CONFIG_ENVIRONMENT: 'production', TEXT_PROVIDER: 'legacy',
      CODEX_SUBSCRIPTION_OWNER_ROUTING_ENABLED: 'true', CODEX_SUBSCRIPTION_OWNER_USER_ID: 'personal-reader',
      CODEX_SUBSCRIPTION_GATEWAY_URL: 'https://codex-gateway.invalid/subscription/v1/generate',
      CODEX_SUBSCRIPTION_GATEWAY_TOKEN: gatewayToken },
    ownerGatewayStub: request => {
      calls++;
      assert.equal(request.url, 'https://codex-gateway.invalid/subscription/v1/models');
      assert.equal(request.method, 'GET');
      assert.equal(request.headers.get('Authorization'), 'Bearer ' + gatewayToken);
      return reply();
    }
  });
  t.after(() => worker.close());
  const url = worker.url + '/api/admin/ai-configuration/connections/codex-subscription/models';
  const get = () => fetch(url, { headers: { Authorization: 'Bearer ' + ADMIN_FIXTURE_KEY } });
  const save = (modelId, base) => fetch(url, { method: 'PUT',
    headers: { Authorization: 'Bearer ' + ADMIN_FIXTURE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, baseRevision: base.revision, baseToken: base.baseToken }) });
  assert.equal((await fetch(url)).status, 401);
  assert.equal(calls, 0);
  const result = await get();
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  const { editable, selection, ...discovered } = await result.json();
  assert.deepEqual(discovered, catalog);
  assert.equal(editable, true);
  assert.deepEqual(selection, { modelId: null, revision: 0, baseToken: selection.baseToken });
  assert.match(selection.baseToken, /^[a-f0-9]{64}$/);
  assert.equal(calls, 1);
  assert.equal((await save('withdrawn-model', selection)).status, 422);
  assert.equal((await save('gpt-test', { ...selection, baseToken: 'old-owner' })).status, 409);
  const raced = await Promise.all([save('gpt-test', selection), save('gpt-test', selection)]);
  assert.deepEqual(raced.map(res => res.status).sort(), [200, 409]);
  const saved = (await (await get()).json()).selection;
  assert.deepEqual(saved, { ...selection, revision: 1, modelId: 'gpt-test' });
  assert.equal((await worker.db.prepare('SELECT COUNT(*) AS n FROM ai_feature_config_revisions').first()).n, 0);
  for (const [response, status, code] of [
    [() => Response.redirect('https://foreign.invalid'), 503, 'subscription_catalog_unavailable'],
    [() => new Response('private host output', { status: 404 }), 503, 'subscription_catalog_unsupported'],
    [() => new Response(null, { status: 429 }), 429, 'subscription_gateway_busy'],
    [() => Response.json({ models: [] }), 503, 'subscription_catalog_unavailable'],
    [() => new Response('x'.repeat(140000)), 503, 'subscription_catalog_unavailable']
  ]) {
    reply = response;
    const res = await get();
    assert.equal(res.status, status);
    const body = await res.json();
    assert.equal(body.code, code);
    assert.doesNotMatch(JSON.stringify(body), /codex-gateway.invalid|fixture-gateway-bearer|private host output/);
  }
  // Revert to the provider's default even if catalog discovery is offline.
  const cleared = await save(null, saved);
  assert.deepEqual((await cleared.json()).selection, { ...selection, revision: 2 });
  assert.deepEqual(worker.outboundOrigins, []);
});

test('an unconfigured subscription produces an actionable error even if a paid OpenAI key exists', async () => {
  await assert.rejects(fetchCodexSubscriptionModels({ OPENAI_API_KEY: 'unrelated-api-fixture' }),
    { code: 'subscription_gateway_unconfigured' });
});
