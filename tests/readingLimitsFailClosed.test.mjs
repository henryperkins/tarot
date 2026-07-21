/**
 * Finding #3 (second half): usage tracking fails open.
 *
 * When the D1 write throws, enforceReadingLimit logs and returns allowed:true.
 * For a human that is a deliberate availability trade — a transient database
 * blip should not block someone's reading. For a machine credential (service
 * token, API key) it is a quota bypass: the caller is a program that will keep
 * calling, and "unmetered" is exactly the failure mode the backing users row
 * exists to prevent.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { webcrypto } from 'node:crypto';

import { enforceReadingLimit } from '../functions/lib/readingLimits.js';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const THROWING_DB = {
  prepare() {
    throw new Error('D1 unavailable');
  }
};

const SUBSCRIPTION = { tier: 'plus', effectiveTier: 'plus', config: { monthlyReadings: 50 } };

function request() {
  return new Request('https://example.com/api/tarot-reading', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '203.0.113.7' }
  });
}

async function quiet(fn) {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

describe('enforceReadingLimit failure mode by credential type', () => {
  it('denies a service account when usage tracking fails', async () => {
    const result = await quiet(() =>
      enforceReadingLimit(
        { DB: THROWING_DB },
        request(),
        { id: 'service:gpt', auth_provider: 'service' },
        SUBSCRIPTION,
        'req-service'
      )
    );

    assert.equal(result.allowed, false, 'an unmeterable machine credential must not be served');
  });

  it('denies an API-key caller when usage tracking fails', async () => {
    const result = await quiet(() =>
      enforceReadingLimit(
        { DB: THROWING_DB },
        request(),
        { id: 'user_1', auth_provider: 'api_key' },
        SUBSCRIPTION,
        'req-apikey'
      )
    );

    assert.equal(result.allowed, false);
  });

  it('still serves a human session when usage tracking fails', async () => {
    // Availability wins for interactive users: a D1 blip must not block a
    // reading someone is waiting on.
    const result = await quiet(() =>
      enforceReadingLimit(
        { DB: THROWING_DB },
        request(),
        { id: 'user_2', auth_provider: 'email' },
        SUBSCRIPTION,
        'req-human'
      )
    );

    assert.equal(result.allowed, true);
  });
});
