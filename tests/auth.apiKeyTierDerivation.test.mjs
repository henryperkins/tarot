import assert from 'node:assert';
import test from 'node:test';
import { webcrypto } from 'node:crypto';

import { getUserFromRequest } from '../functions/lib/auth.js';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

class FakeDB {
  constructor({ primaryResult, fallbackResult, throwMissingColumns = false } = {}) {
    this.primaryResult = primaryResult;
    this.fallbackResult = fallbackResult;
    this.throwMissingColumns = throwMissingColumns;
    this.updateCalls = 0;
  }

  prepare(sql) {
    if (sql.includes('UPDATE api_keys SET last_used_at')) {
      return {
        bind: () => ({
          run: async () => {
            this.updateCalls += 1;
            return { meta: { changes: 1 } };
          }
        })
      };
    }

    if (sql.includes('FROM api_keys')) {
      const isSubscriptionAware = sql.includes('subscription_tier');
      return {
        bind: () => ({
          first: async () => {
            if (this.throwMissingColumns && isSubscriptionAware) {
              throw new Error('no such column: subscription_tier');
            }
            return isSubscriptionAware ? this.primaryResult : this.fallbackResult;
          }
        })
      };
    }

    throw new Error(`Unexpected SQL in test FakeDB: ${sql}`);
  }
}

test('getUserFromRequest derives tier/status from owning user for API keys', async () => {
  const db = new FakeDB({
    primaryResult: {
      id: 'key_123',
      user_id: 'user_abc',
      email: 'user@example.com',
      username: 'user',
      key_prefix: 'sk_1234567',
      subscription_tier: 'free',
      subscription_status: 'inactive',
      subscription_provider: 'stripe',
      stripe_customer_id: 'cus_123'
    }
  });

  const request = new Request('https://example.com/api/test', {
    headers: { Authorization: 'Bearer sk_test_abcdef' }
  });

  const user = await getUserFromRequest(request, { DB: db });

  assert.strictEqual(user.id, 'user_abc');
  assert.strictEqual(user.subscription_tier, 'free');
  assert.strictEqual(user.subscription_status, 'inactive');
  assert.strictEqual(user.subscription_provider, 'stripe');
  assert.strictEqual(user.stripe_customer_id, 'cus_123');
  assert.strictEqual(user.auth_provider, 'api_key');
  assert.strictEqual(user.api_key_id, 'key_123');
  assert.strictEqual(user.api_key_prefix, 'sk_1234567');
  assert.strictEqual(db.updateCalls, 1, 'validateApiKey should update last_used_at');
});

test('getUserFromRequest falls back safely when subscription columns are missing', async () => {
  const db = new FakeDB({
    throwMissingColumns: true,
    fallbackResult: {
      id: 'key_456',
      user_id: 'user_def',
      email: 'fallback@example.com',
      username: 'fallback',
      key_prefix: 'sk_7654321'
    }
  });

  const request = new Request('https://example.com/api/test', {
    headers: { Authorization: 'Bearer sk_test_fallback' }
  });

  const user = await getUserFromRequest(request, { DB: db });

  assert.strictEqual(user.id, 'user_def');
  assert.strictEqual(user.subscription_tier, 'free');
  assert.strictEqual(user.subscription_status, 'inactive');
  assert.strictEqual(user.subscription_provider, null);
  assert.strictEqual(user.stripe_customer_id, null);
  assert.strictEqual(user.auth_provider, 'api_key');
  assert.strictEqual(user.api_key_id, 'key_456');
  assert.strictEqual(user.api_key_prefix, 'sk_7654321');
  assert.strictEqual(db.updateCalls, 1, 'validateApiKey should update last_used_at');
});

