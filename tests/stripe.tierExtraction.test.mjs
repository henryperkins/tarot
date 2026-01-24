import assert from 'node:assert/strict';
import test from 'node:test';

import { extractTierFromSubscription } from '../functions/lib/stripe.js';

test('extractTierFromSubscription prefers price data over subscription metadata', () => {
  const subscription = {
    metadata: { tier: 'plus' },
    items: {
      data: [
        {
          price: {
            lookup_key: 'pro_monthly',
            metadata: { tier: 'pro' },
            unit_amount: 1999,
            recurring: { interval: 'month' }
          }
        }
      ]
    }
  };

  assert.equal(extractTierFromSubscription(subscription), 'pro');
});

test('extractTierFromSubscription falls back to subscription metadata', () => {
  const subscription = {
    metadata: { tier: 'plus' },
    items: { data: [] }
  };

  assert.equal(extractTierFromSubscription(subscription), 'plus');
});
