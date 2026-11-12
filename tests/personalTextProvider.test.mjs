import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as provider from '../functions/lib/personalTextProvider.js';

const environment = Object.freeze({
  TEXT_PROVIDER: 'legacy', CODEX_SUBSCRIPTION_OWNER_ROUTING_ENABLED: 'true',
  CODEX_SUBSCRIPTION_OWNER_USER_ID: 'owner', OPENAI_API_KEY: 'api-fixture'
});

test('owner routing selects Codex only for the authenticated owner without mutating shared bindings', () => {
  const selected = provider.resolvePersonalTextProviderEnv(environment, { id: 'owner', auth_provider: 'password' });
  assert.equal(selected.TEXT_PROVIDER, 'codex-subscription');
  assert.equal(environment.TEXT_PROVIDER, 'legacy');
  assert.equal(selected.OPENAI_API_KEY, environment.OPENAI_API_KEY);
  for (const user of [null, {}, { id: 'other' }, { id: 'owner', auth_provider: 'service' }]) {
    assert.equal(provider.resolvePersonalTextProviderEnv(environment, user), environment);
  }
});

test('owner routing requires an explicit opt-in and owner ID, and preserves explicit personal modes', () => {
  for (const overrides of [
    { CODEX_SUBSCRIPTION_OWNER_ROUTING_ENABLED: undefined },
    { CODEX_SUBSCRIPTION_OWNER_ROUTING_ENABLED: 'false' },
    { CODEX_SUBSCRIPTION_OWNER_USER_ID: '' },
    { TEXT_PROVIDER: 'claude-code' },
    { TEXT_PROVIDER: 'codex-subscription' }
  ]) {
    const env = { ...environment, ...overrides };
    assert.equal(provider.resolvePersonalTextProviderEnv(env, { id: 'owner' }), env);
  }
});
