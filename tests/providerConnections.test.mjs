import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { connection, overview } from '../functions/api/admin/ai-configuration.js';
import { listManagedConnections, resolveProviderEnvironment } from '../functions/lib/providerConnections.js';
import { ensureModalConfig } from '../functions/lib/modalChatCompletions.js';

const prefix = 'https://dashboard.test/api/admin/ai-configuration';
const key = '01'.repeat(32);
const oldSecret = 'deployment-secret-fixture';
const newSecret = 'portal-secret-fixture';
async function deployment(extra) {
  return { DB: await createD1(), ADMIN_API_KEY: 'operator', OPENAI_API_KEY: oldSecret,
    AI_CONNECTIONS_ENCRYPTION_KEY: key, AI_CONFIG_ENABLED: 'true', AI_CONFIG_ENVIRONMENT: 'preview', ...extra };
}
function call(env, { path = '/connections', providerId, body, auth = 'operator' } = {}) {
  const handler = body ? connection.onRequestPut : overview.onRequestGet;
  return handler({ env, params: { providerId }, request: new Request(prefix + path, {
    method: body ? 'PUT' : 'GET', headers: { Authorization: 'Bearer ' + auth, 'Content-Type': 'application/json' },
    ...(body && { body: JSON.stringify(body) })
  }) });
}
function change(env, id, action, baseRevision, values) {
  return call(env, { providerId: id, path: '/connections/' + id, body: { action, baseRevision, ...(values && { values }) } });
}

describe('portal provider connections', () => {
  it('requires admin authorization, isolates the environment, and never echoes stored credentials', async () => {
    const env = await deployment();
    for (const body of [undefined, { action: 'disconnect', baseRevision: 0 }]) {
      assert.equal((await call(env, { providerId: 'openai-native', auth: 'reader', body })).status, 401);
    }
    const response = await change(env, 'openai-native', 'replace', 0, { apiKey: newSecret });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await response.json()).connection.source, 'portal');
    const effective = await resolveProviderEnvironment(env);
    assert.equal(effective.OPENAI_API_KEY, newSecret);
    assert.equal(env.OPENAI_API_KEY, oldSecret);
    assert.equal(await resolveProviderEnvironment(effective), effective);
    assert.equal((await resolveProviderEnvironment({ ...env, AI_CONFIG_ENVIRONMENT: 'local' })).OPENAI_API_KEY, oldSecret);
    assert.equal((await resolveProviderEnvironment({ ...env, AI_CONFIG_ENABLED: false })).OPENAI_API_KEY, oldSecret);
    for (const path of ['', '/connections', '/history']) {
      const info = await call(env, { path });
      assert.equal(info.status, 200);
      assert.doesNotMatch(await info.text(), /portal-secret-fixture|deployment-secret-fixture|0101010101010101/);
    }
    const [row] = env.DB.rows('SELECT * FROM ai_provider_connections');
    assert.doesNotMatch(JSON.stringify(row), /portal-secret-fixture|deployment-secret-fixture/);
    assert.equal(Buffer.from(row.iv, 'base64').length, 12);
    assert.equal(row.source, 'portal');
    const connections = await listManagedConnections(env);
    assert.equal(connections.find(entry => entry.id === 'workers-ai').source, 'binding');
    assert.equal(connections.find(entry => entry.id === 'local-composer').editable, false);
  });

  it('serializes competing writes, suppresses inherited credentials on disconnect, and restores deployment values on reset', async () => {
    const env = await deployment();
    const concurrent = await Promise.all(['a', 'b'].map(apiKey => change(env, 'openai-native', 'replace', 0, { apiKey })));
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
    const conflict = await concurrent.find(res => res.status === 409).json();
    assert.equal(conflict.code, 'connection_conflict');
    const disconnected = await change(env, 'openai-native', 'disconnect', 1);
    assert.equal((await disconnected.json()).connection.configured, false);
    assert.equal((await resolveProviderEnvironment(env)).OPENAI_API_KEY, undefined);
    const read = await call(env);
    assert.equal((await read.json()).connections.find(x => x.id === 'openai-native').revision, 2);
    const restored = await change(env, 'openai-native', 'reset', 2);
    assert.equal((await restored.json()).connection.configured, true);
    assert.equal((await resolveProviderEnvironment(env)).OPENAI_API_KEY, oldSecret);
    assert.equal((await change(env, 'openai-native', 'replace', 1, { apiKey: newSecret })).status, 409);
    const [row] = env.DB.rows('SELECT * FROM ai_provider_connections');
    assert.equal(row.ciphertext, null);
    assert.equal(row.revision, 3);
  });

  it('allows either complete Modal authentication format and enforces the destination for its credentials', async () => {
    const env = await deployment({ MODAL_ENDPOINT_URL: 'https://trusted.example/v1',
      MODAL_PROXY_TOKEN_ID: 'deployment-id', MODAL_PROXY_TOKEN_SECRET: oldSecret });
    for (const values of [
      { endpointUrl: 'https://different.example', token: newSecret },
      { endpointUrl: 'http://new.modal.run', token: newSecret },
      { endpointUrl: 'https://user:pass@new.modal.run', token: newSecret },
      { endpointUrl: 'https://new.modal.run/#secrets', token: newSecret },
      { endpointUrl: 'https://new.modal.run' }, { endpointUrl: 'https://new.modal.run', tokenId: 'only-half' },
      { endpointUrl: 'https://new.modal.run', token: 'one', tokenId: 'two', tokenSecret: 'three' }
    ]) {
      assert.equal((await change(env, 'modal-qwen', 'replace', 0, values)).status, 422);
    }
    const endpointUrl = 'https://workspace--application.modal.run';
    const response = await change(env, 'modal-qwen', 'replace', 0, { endpointUrl, token: newSecret });
    assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), /workspace--application|portal-secret/);
    let effective = await resolveProviderEnvironment(env);
    assert.equal(effective.MODAL_PROXY_TOKEN_ID, undefined);
    assert.equal(ensureModalConfig(effective).proxyToken, newSecret);
    const rotate = await change(env, 'modal-qwen', 'replace', 1, { endpointUrl: 'https://trusted.example/v1', tokenId: 'new-id', tokenSecret: 'new-secret' });
    assert.equal(rotate.status, 200);
    effective = await resolveProviderEnvironment(env);
    assert.equal(effective.MODAL_PROXY_TOKEN, undefined);
    assert.equal(ensureModalConfig(effective).proxyToken, 'new-id.new-secret');
    assert.equal((await change(env, 'modal-qwen', 'reset', 2)).status, 200);
    assert.equal(ensureModalConfig(await resolveProviderEnvironment(env)).proxyToken, 'deployment-id.' + oldSecret);
  });

  it('manages ElevenLabs and Anthropic alongside Models, and only accepts allowlisted credentials', async () => {
    const env = await deployment();
    for (const [id, name] of [['elevenlabs', 'ELEVENLABS_API_KEY'], ['claude-api', 'ANTHROPIC_API_KEY']]) {
      assert.equal((await change(env, id, 'replace', 0, { apiKey: newSecret, ADMIN_API_KEY: 'bad' })).status, 422);
      assert.equal((await change(env, id, 'replace', 0, { apiKey: 'bad\r\nvalue' })).status, 422);
      assert.equal((await change(env, id, 'replace', 0, { apiKey: newSecret })).status, 200);
      assert.equal((await resolveProviderEnvironment(env))[name], newSecret);
      assert.equal((await listManagedConnections(env)).find(provider => provider.id === id).configured, true);
      assert.equal((await change(env, id, 'disconnect', 1, { apiKey: 'unexpected' })).status, 422);
    }
    for (const id of ['local-composer', 'workers-ai', 'unsupported-provider', '__proto__']) {
      assert.equal((await change(env, id, 'replace', 0, { apiKey: 'bad' })).status, 422);
    }
    assert.equal((await change({ ...env, AI_CONFIG_ENABLED: 'false' }, 'elevenlabs', 'disconnect', 1)).status, 403);
  });

  it('keeps unaffected providers usable and permits recovery when ciphertext or the encryption key changes', async () => {
    const env = await deployment({ ANTHROPIC_API_KEY: 'other' });
    assert.equal((await change(env, 'openai-native', 'replace', 0, { apiKey: newSecret })).status, 200);
    assert.equal((await change(env, 'elevenlabs', 'replace', 0, { apiKey: 'eleven-secret' })).status, 200);
    await env.DB.prepare("UPDATE ai_provider_connections SET ciphertext = (SELECT ciphertext FROM ai_provider_connections WHERE provider_id = 'elevenlabs'), iv = (SELECT iv FROM ai_provider_connections WHERE provider_id = 'elevenlabs') WHERE provider_id = 'openai-native'").run();
    let effective = await resolveProviderEnvironment(env);
    assert.equal(effective.OPENAI_API_KEY, undefined);
    assert.equal(effective.ELEVENLABS_API_KEY, 'eleven-secret');
    assert.equal(effective.ANTHROPIC_API_KEY, 'other');
    assert.equal((await listManagedConnections(env)).find(c => c.id === 'openai-native').configured, false);
    const lostKey = { ...env, AI_CONNECTIONS_ENCRYPTION_KEY: undefined };
    const missing = (await listManagedConnections(lostKey)).find(c => c.id === 'openai-native');
    assert.equal(missing.recoveryOnly, true);
    assert.equal(missing.editable, true);
    assert.ok(missing.managementWarning);
    assert.equal((await change(lostKey, 'openai-native', 'replace', 1, { apiKey: 'new' })).status, 503);
    assert.equal((await change(lostKey, 'openai-native', 'reset', 1)).status, 200);
    assert.equal((await change(lostKey, 'elevenlabs', 'disconnect', 1)).status, 200);
    effective = await resolveProviderEnvironment(lostKey);
    assert.equal(effective.OPENAI_API_KEY, oldSecret);
    assert.equal(effective.ELEVENLABS_API_KEY, undefined);
    const noVault = (await listManagedConnections(lostKey)).find(c => c.id === 'claude-api');
    assert.equal(noVault.editable, false);
    assert.equal(noVault.configured, true);
  });

  it('keeps legacy deployments compatible and fails closed if active storage becomes unavailable', async () => {
    const env = await deployment();
    const previous = { ...env, DB: await createD1({ throughMigration: '0040_ai_feature_config_revisions.sql' }), AI_CONNECTIONS_ENCRYPTION_KEY: undefined };
    assert.equal(await resolveProviderEnvironment(previous), previous);
    assert.equal((await listManagedConnections(previous)).find(c => c.id === 'openai-native').editable, false);
    await assert.rejects(resolveProviderEnvironment({ ...previous, AI_CONNECTIONS_ENCRYPTION_KEY: key }), { code: 'connection_storage_unavailable' });
    await assert.rejects(resolveProviderEnvironment({ ...previous, DB: undefined }), { code: 'connection_storage_unavailable' });
    const broken = { ...env, DB: { prepare() { throw Error('internal diagnostic'); } } };
    const unavailable = await call(broken);
    assert.equal(unavailable.status, 503);
    assert.doesNotMatch(await unavailable.text(), /diagnostic/);
  });
});
