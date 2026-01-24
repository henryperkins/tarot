import assert from 'node:assert/strict';
import test from 'node:test';

import { selectStripeSubscription } from '../functions/lib/stripe.js';

test('selectStripeSubscription prefers active subscriptions', () => {
  const subscriptions = [
    { id: 'sub_latest', status: 'canceled', created: 3 },
    { id: 'sub_active', status: 'active', created: 2 },
    { id: 'sub_older', status: 'canceled', created: 1 }
  ];

  assert.equal(selectStripeSubscription(subscriptions)?.id, 'sub_active');
});

test('selectStripeSubscription falls back to the first entry when none are active', () => {
  const subscriptions = [
    { id: 'sub_new', status: 'canceled', created: 3 },
    { id: 'sub_old', status: 'canceled', created: 1 }
  ];

  assert.equal(selectStripeSubscription(subscriptions)?.id, 'sub_new');
});

test('selectStripeSubscription returns null for empty input', () => {
  assert.equal(selectStripeSubscription([]), null);
  assert.equal(selectStripeSubscription(null), null);
});
