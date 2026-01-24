import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac, randomUUID, webcrypto } from 'node:crypto';

import { onRequestPost } from '../functions/api/webhooks/stripe.js';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = randomUUID;
}

class MockStatement {
  constructor(query, db) {
    this.query = query;
    this.db = db;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async first() {
    return this.db.first(this.query, this.params);
  }

  async run() {
    return this.db.run(this.query, this.params);
  }
}

class MockDb {
  constructor(users = []) {
    this.users = new Map(users.map(user => [user.id, { ...user }]));
    this.processedEvents = new Set();
  }

  prepare(query) {
    return new MockStatement(query, this);
  }

  first(query, params) {
    if (query.includes('FROM users WHERE stripe_customer_id')) {
      const customerId = params[0];
      return Array.from(this.users.values())
        .find(user => user.stripe_customer_id === customerId) || null;
    }

    if (query.includes('FROM users WHERE id')) {
      const userId = params[0];
      return this.users.get(userId) || null;
    }

    return null;
  }

  run(query, params) {
    if (query.includes('INSERT OR IGNORE INTO processed_webhook_events')) {
      const eventId = params[1];
      if (this.processedEvents.has(eventId)) {
        return { meta: { changes: 0 } };
      }
      this.processedEvents.add(eventId);
      return { meta: { changes: 1 } };
    }

    if (query.includes('DELETE FROM processed_webhook_events')) {
      const eventId = params[1];
      this.processedEvents.delete(eventId);
      return { meta: { changes: 1 } };
    }

    if (query.includes('SET stripe_customer_id = ?')) {
      const [customerId, userId] = params;
      const user = this.users.get(userId);
      if (!user || user.stripe_customer_id) {
        return { meta: { changes: 0 } };
      }
      user.stripe_customer_id = customerId;
      return { meta: { changes: 1 } };
    }

    if (query.includes('SET subscription_tier = ?') && query.includes('subscription_status = ?')) {
      const [tier, status, userId] = params;
      const user = this.users.get(userId);
      if (!user) {
        return { meta: { changes: 0 } };
      }
      user.subscription_tier = tier;
      user.subscription_status = status;
      user.subscription_provider = 'stripe';
      return { meta: { changes: 1 } };
    }

    if (query.includes("SET subscription_tier = 'free'") && query.includes("subscription_status = 'canceled'")) {
      const [userId] = params;
      const user = this.users.get(userId);
      if (!user) {
        return { meta: { changes: 0 } };
      }
      user.subscription_tier = 'free';
      user.subscription_status = 'canceled';
      user.subscription_provider = 'stripe';
      return { meta: { changes: 1 } };
    }

    return { meta: { changes: 0 } };
  }
}

function buildSubscriptionEvent({ id, type, customerId, subscriptionOverrides = {} }) {
  return {
    id: id || `evt_${randomUUID()}`,
    type: type || 'customer.subscription.updated',
    data: {
      object: {
        id: subscriptionOverrides.id || `sub_${randomUUID()}`,
        customer: customerId,
        status: subscriptionOverrides.status || 'active',
        metadata: subscriptionOverrides.metadata || {},
        items: subscriptionOverrides.items || { data: [] }
      }
    }
  };
}

function createStripeSignature(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

test('links stripe customer via subscription metadata and updates tier', async () => {
  const db = new MockDb([
    {
      id: 'user-1',
      stripe_customer_id: null,
      subscription_tier: 'free',
      subscription_status: 'inactive',
      subscription_provider: null
    }
  ]);

  const event = buildSubscriptionEvent({
    customerId: 'cus_123',
    subscriptionOverrides: {
      metadata: { user_id: 'user-1' },
      items: {
        data: [
          { price: { lookup_key: 'plus_monthly', unit_amount: 799, recurring: { interval: 'month' } } }
        ]
      }
    }
  });

  const request = new Request('https://example.com/api/webhooks/stripe', {
    method: 'POST',
    body: JSON.stringify(event)
  });

  const response = await onRequestPost({ request, env: { DB: db } });

  assert.equal(response.status, 200);
  const user = db.users.get('user-1');
  assert.equal(user.stripe_customer_id, 'cus_123');
  assert.equal(user.subscription_tier, 'plus');
  assert.equal(user.subscription_status, 'active');
  assert.equal(user.subscription_provider, 'stripe');
});

test('keeps existing tier when Stripe tier cannot be determined', async () => {
  const db = new MockDb([
    {
      id: 'user-2',
      stripe_customer_id: 'cus_456',
      subscription_tier: 'pro',
      subscription_status: 'inactive',
      subscription_provider: 'stripe'
    }
  ]);

  const event = buildSubscriptionEvent({
    customerId: 'cus_456',
    subscriptionOverrides: {
      items: { data: [{ price: {} }] }
    }
  });

  const request = new Request('https://example.com/api/webhooks/stripe', {
    method: 'POST',
    body: JSON.stringify(event)
  });

  const response = await onRequestPost({ request, env: { DB: db } });

  assert.equal(response.status, 200);
  const user = db.users.get('user-2');
  assert.equal(user.subscription_tier, 'pro');
  assert.equal(user.subscription_status, 'active');
});

test('rejects invalid webhook signatures when secret configured', async () => {
  const db = new MockDb();
  const event = buildSubscriptionEvent({ customerId: 'cus_789' });
  const payload = JSON.stringify(event);
  const request = new Request('https://example.com/api/webhooks/stripe', {
    method: 'POST',
    body: payload,
    headers: {
      'stripe-signature': createStripeSignature(payload, 'wrong_secret')
    }
  });

  const response = await onRequestPost({
    request,
    env: { DB: db, STRIPE_WEBHOOK_SECRET: 'correct_secret' }
  });

  assert.equal(response.status, 400);
});

test('treats duplicate events as idempotent', async () => {
  const db = new MockDb([
    {
      id: 'user-3',
      stripe_customer_id: 'cus_999',
      subscription_tier: 'plus',
      subscription_status: 'inactive',
      subscription_provider: 'stripe'
    }
  ]);

  const event = buildSubscriptionEvent({
    id: 'evt_duplicate',
    customerId: 'cus_999'
  });
  const payload = JSON.stringify(event);

  const firstRequest = new Request('https://example.com/api/webhooks/stripe', {
    method: 'POST',
    body: payload
  });
  const secondRequest = new Request('https://example.com/api/webhooks/stripe', {
    method: 'POST',
    body: payload
  });

  const firstResponse = await onRequestPost({ request: firstRequest, env: { DB: db } });
  const secondResponse = await onRequestPost({ request: secondRequest, env: { DB: db } });

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);

  const secondBody = await secondResponse.json();
  assert.equal(secondBody.duplicate, true);
});
