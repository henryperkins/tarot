import assert from 'node:assert/strict';
import { it } from 'node:test';
import { overview } from '../functions/api/admin/ai-configuration.js';
import { describeFeature, savePolicy } from '../functions/lib/aiConfigStore.js';
import { readCloudflareReleaseSettings, PRODUCTION_ORIGIN } from '../scripts/evaluation/lib/cloudflareReleaseSettings.js';
import { createD1 } from './helpers/d1Sqlite.mjs';

const versionId = '11111111-1111-4111-8111-111111111111';
const secondVersionId = '22222222-2222-4222-8222-222222222222';
const config = { name: 'tableau', d1_databases: [{ binding: 'DB', database_id: 'test-db' }] };
const defaults = { AI_CONFIG_ENVIRONMENT: 'production', AI_CONFIG_ENABLED: 'false',
  OPENAI_MODEL: 'gpt-6.1-sol', OPENAI_REASONING_EFFORT: 'high', ANTHROPIC_TIMEOUT_MS: '74000' };

function fixture({ variables = defaults, db, databaseId = 'test-db', provider = 'openai-native', second, extraBindings = [] } = {}) {
  const reads = [];
  return {
    reads,
    async read(args) {
      reads.push(args);
      if (args[0] === 'deployments') return { versions: second
        ? [{ version_id: versionId, percentage: 75 }, { version_id: secondVersionId, percentage: 25 }]
        : [{ version_id: versionId, percentage: 100 }] };
      if (args[0] === 'versions') {
        const vars = args[2] === secondVersionId ? { ...variables, ...second } : variables;
        const bindings = Object.entries(vars).map(([name, text]) => ({ name, text, type: 'plain_text' }));
        return { id: args[2], resources: { bindings: [...bindings, ...extraBindings, { type: 'd1', name: 'DB', id: databaseId }] } };
      }
      assert.deepEqual(args.slice(0, 5), ['d1', 'execute', 'DB', '--remote', '--command']);
      assert.match(args[5], /^SELECT revision, catalog_version, policy_json FROM ai_feature_config_revisions /);
      return [{ success: true, results: (await db.prepare(args[5]).all()).results }];
    },
    async fetcher(url, init) {
      assert.equal(url, PRODUCTION_ORIGIN + '/api/health/tarot-reading');
      assert.equal(init.redirect, 'error');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.headers, undefined);
      return Response.json({ status: 'ok', provider });
    }
  };
}

it('matches the authenticated Worker contract for deployed defaults and a saved production assignment', async () => {
  const db = await createD1();
  const env = { ...defaults, DB: db, ADMIN_API_KEY: 'test-admin', OPENAI_API_KEY: 'test-provider', ANTHROPIC_API_KEY: 'test-provider' };
  async function compare(options) {
    const response = await overview.onRequestGet({ env, params: {}, request: new Request(PRODUCTION_ORIGIN + '/api/admin/ai-configuration/release-settings', {
      headers: { Authorization: 'Bearer test-admin' }
    }) });
    assert.equal(response.status, 200);
    const expected = await response.json();
    assert.deepEqual(await readCloudflareReleaseSettings(config, options), expected);
    return expected;
  }
  const deployed = fixture();
  assert.equal((await compare(deployed)).revision, 0);
  assert.equal(deployed.reads.some(args => args[0] === 'd1'), false);
  env.AI_CONFIG_ENABLED = 'true';
  const feature = await describeFeature(env, 'readings');
  const [claude, ...otherFallbacks] = feature.policy.fallbacks;
  await savePolicy(env, 'readings', { mutationId: 'release-test', baseRevision: 0, baseToken: feature.baseToken,
    policy: { primary: { ...claude, reasoningEffort: 'medium' }, fallbacks: [feature.policy.primary, ...otherFallbacks] } }, 'fixture');
  const saved = await compare(fixture({ variables: { ...defaults, AI_CONFIG_ENABLED: 'true' }, db, provider: 'claude-api' }));
  assert.equal(saved.revision, 1);
  assert.equal(saved.deadlineMs, 74000);
});

it('rejects a fallback provider, an opaque setting, or an unrelated D1 binding', async () => {
  await assert.rejects(readCloudflareReleaseSettings(config, fixture({ provider: 'local' })), /live reading service/);
  await assert.rejects(readCloudflareReleaseSettings(config, fixture({ extraBindings: [{ name: 'OPENAI_TIMEOUT_MS', type: 'secret_text' }] })), /cannot read.*OPENAI_TIMEOUT_MS/);
  await assert.rejects(readCloudflareReleaseSettings(config, fixture({
    variables: { ...defaults, AI_CONFIG_ENABLED: 'true' }, databaseId: 'other-db'
  })), /does not match/);
});

it('accepts a traffic split with matching settings and rejects divergent active assignments', async () => {
  const matching = await readCloudflareReleaseSettings(config, fixture({ second: {} }));
  assert.equal(matching.modelId, defaults.OPENAI_MODEL);
  await assert.rejects(readCloudflareReleaseSettings(config, fixture({ second: { OPENAI_REASONING_EFFORT: 'low' } })), /different Readings assignments/);
});
