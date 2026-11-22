import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasConnectionKeySource, loadConnectionKey } from '../functions/lib/providerConnectionKey.js';

test('an explicitly configured encryption key takes precedence and is never extractable', async () => {
  const env = { AI_CONNECTIONS_ENCRYPTION_KEY: 'ab'.repeat(32), PROVIDER_CREDENTIAL_KEYS: {} };
  assert.ok(hasConnectionKeySource(env));
  assert.equal((await loadConnectionKey(env)).extractable, false);
});

test('a malformed explicit key fails without changing key source', async () => {
  const env = { AI_CONNECTIONS_ENCRYPTION_KEY: '', PROVIDER_CREDENTIAL_KEYS: { idFromName: assert.fail, get: assert.fail } };
  assert.equal(hasConnectionKeySource(env), false);
  await assert.rejects(loadConnectionKey(env), /unavailable/);
});
