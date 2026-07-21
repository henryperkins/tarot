import assert from 'node:assert';
import test from 'node:test';
import { webcrypto } from 'node:crypto';

import { getUserFromRequest } from '../functions/lib/auth.js';
import {
  buildServiceUser,
  matchesServiceToken,
  resolveServiceTier,
  resolveServiceUser,
  MIN_SERVICE_TOKEN_LENGTH
} from '../functions/lib/serviceAuth.js';
import { getSubscriptionContext } from '../functions/lib/entitlements.js';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

// A realistic long random token (>= MIN_SERVICE_TOKEN_LENGTH chars).
const SERVICE_TOKEN = 'svc_0123456789abcdef0123456789abcdef01234567';

// D1 stub that never matches a session/api-key, so non-service tokens resolve
// to null and we can prove the service path is what's authenticating.
class NullDB {
  prepare() {
    return {
      bind: () => ({
        first: async () => null,
        run: async () => ({ meta: { changes: 0 } }),
        all: async () => ({ results: [] })
      })
    };
  }
}

function bearer(token) {
  return new Request('https://example.com/api/tarot-reading', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

test('resolveServiceTier defaults to plus and clamps below-Plus values', () => {
  assert.strictEqual(resolveServiceTier({}), 'plus');
  assert.strictEqual(resolveServiceTier({ GPT_SERVICE_TIER: 'plus' }), 'plus');
  assert.strictEqual(resolveServiceTier({ GPT_SERVICE_TIER: 'pro' }), 'pro');
  assert.strictEqual(resolveServiceTier({ GPT_SERVICE_TIER: ' PRO ' }), 'pro');
  // Never downgrade below Plus, even if misconfigured.
  assert.strictEqual(resolveServiceTier({ GPT_SERVICE_TIER: 'free' }), 'plus');
  assert.strictEqual(resolveServiceTier({ GPT_SERVICE_TIER: 'nonsense' }), 'plus');
});

test('matchesServiceToken is exact, and disabled unless configured', async () => {
  const env = { GPT_SERVICE_TOKEN: SERVICE_TOKEN };
  assert.strictEqual(await matchesServiceToken(SERVICE_TOKEN, env), true);
  assert.strictEqual(await matchesServiceToken(`${SERVICE_TOKEN}x`, env), false);
  assert.strictEqual(await matchesServiceToken('wrong', env), false);
  assert.strictEqual(await matchesServiceToken('', env), false);

  // Not configured => never matches.
  assert.strictEqual(await matchesServiceToken(SERVICE_TOKEN, {}), false);

  // Too-short configured token is ignored (defense against weak secrets).
  const shortToken = 'a'.repeat(MIN_SERVICE_TOKEN_LENGTH - 1);
  assert.strictEqual(
    await matchesServiceToken(shortToken, { GPT_SERVICE_TOKEN: shortToken }),
    false
  );
});

test('buildServiceUser shapes a Plus-or-higher synthetic user', () => {
  const plus = buildServiceUser({ GPT_SERVICE_TOKEN: SERVICE_TOKEN });
  assert.strictEqual(plus.subscription_tier, 'plus');
  assert.strictEqual(plus.subscription_status, 'active');
  assert.strictEqual(plus.subscription_provider, 'service');
  assert.strictEqual(plus.auth_provider, 'service');
  assert.strictEqual(plus.email_verified, true);
  assert.strictEqual(plus.is_service_account, true);
  assert.strictEqual(plus.id, 'service:gpt');

  const pro = buildServiceUser({ GPT_SERVICE_TIER: 'pro' });
  assert.strictEqual(pro.subscription_tier, 'pro');

  const custom = buildServiceUser({
    GPT_SERVICE_USER_ID: 'service:my-gpt',
    GPT_SERVICE_EMAIL: 'gpt@example.com'
  });
  assert.strictEqual(custom.id, 'service:my-gpt');
  assert.strictEqual(custom.email, 'gpt@example.com');
});

test('resolveServiceUser returns null on mismatch, user on match', async () => {
  const env = { GPT_SERVICE_TOKEN: SERVICE_TOKEN };
  assert.strictEqual(await resolveServiceUser('nope', env), null);
  const user = await resolveServiceUser(SERVICE_TOKEN, env);
  assert.ok(user);
  assert.strictEqual(user.auth_provider, 'service');
});

test('getUserFromRequest authenticates the service token as a Plus user', async () => {
  const env = { DB: new NullDB(), GPT_SERVICE_TOKEN: SERVICE_TOKEN };
  const user = await getUserFromRequest(bearer(SERVICE_TOKEN), env);

  assert.ok(user, 'service token should authenticate');
  assert.strictEqual(user.auth_provider, 'service');
  assert.strictEqual(user.subscription_tier, 'plus');
  assert.strictEqual(user.subscription_status, 'active');

  // The whole point: a Plus service user is entitled to every built-in spread,
  // including the Celtic Cross that was previously blocked.
  const subscription = getSubscriptionContext(user);
  assert.strictEqual(subscription.effectiveTier, 'plus');
  assert.strictEqual(subscription.config.spreads, 'all');
});

test('getUserFromRequest honors GPT_SERVICE_TIER=pro', async () => {
  const env = { DB: new NullDB(), GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_TIER: 'pro' };
  const user = await getUserFromRequest(bearer(SERVICE_TOKEN), env);
  assert.strictEqual(user.subscription_tier, 'pro');
  assert.strictEqual(getSubscriptionContext(user).effectiveTier, 'pro');
});

test('getUserFromRequest ignores the token when service auth is not configured', async () => {
  const env = { DB: new NullDB() }; // no GPT_SERVICE_TOKEN
  const user = await getUserFromRequest(bearer(SERVICE_TOKEN), env);
  assert.strictEqual(user, null, 'without configuration the token must not authenticate');
});

test('getUserFromRequest rejects a wrong bearer token', async () => {
  const env = { DB: new NullDB(), GPT_SERVICE_TOKEN: SERVICE_TOKEN };
  const user = await getUserFromRequest(bearer('Bearer-but-wrong-token-value-1234567890'), env);
  assert.strictEqual(user, null);
});
