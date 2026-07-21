/**
 * Hardening tests for service-account authentication.
 *
 * These pin three failure modes that the original implementation allowed:
 *
 *  1. `GPT_SERVICE_USER_ID` pointing at an existing *human* account. Provisioning
 *     only checked that the id existed, not that the row was a service row, so
 *     the shared service token would authenticate as that person — reading their
 *     memories and touching their media.
 *  2. Provisioning failing while authentication still succeeded. Combined with
 *     the fail-open quota path, that yields an unmetered, unlimited account.
 *  3. A configured token with the `sk_` prefix silently never matching, because
 *     `getUserFromRequest` skips service matching for `sk_` tokens.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';

import { getUserFromRequest, isValidEmail } from '../functions/lib/auth.js';
import {
  buildServiceUser,
  ensureServiceUserRow,
  isServiceAuthConfigured,
  matchesServiceToken,
  resolveServiceUser
} from '../functions/lib/serviceAuth.js';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const SERVICE_TOKEN = 'svc_0123456789abcdef0123456789abcdef01234567';

/**
 * D1 double backing the `users` table. Unlike the one in serviceAuth.test.mjs
 * this returns the columns provisioning needs to tell a service row from a
 * human one.
 */
class FakeDB {
  constructor(seedUsers = []) {
    this.users = new Map(seedUsers.map((u) => [u.id, u]));
    this.statements = [];
  }

  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async run() {
            db.statements.push({ sql, args });
            if (/INSERT OR IGNORE INTO users/i.test(sql)) {
              const [id, email, username] = args;
              const collides = [...db.users.values()].some(
                (u) => u.email === email || u.username === username
              );
              if (db.users.has(id) || collides) return { meta: { changes: 0 } };
              db.users.set(id, { id, email, username, auth_provider: 'service' });
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          },
          async first() {
            db.statements.push({ sql, args });
            if (/FROM users WHERE id = \?/i.test(sql)) {
              return db.users.get(args[0]) || null;
            }
            return null;
          },
          async all() {
            return { results: [] };
          }
        };
      }
    };
  }
}

function bearer(token) {
  return new Request('https://example.com/api/tarot-reading', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

function captureErrors(fn) {
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      console.error = original;
    })
    .then((value) => ({ value, errors }));
}

// ---------------------------------------------------------------------------
// Finding #2 — GPT_SERVICE_USER_ID must never resolve onto a human account.
// ---------------------------------------------------------------------------

test('ensureServiceUserRow refuses an id already held by a non-service account', async () => {
  // A real person owns this id. INSERT OR IGNORE is a no-op, and the old
  // existence-only check then reported success.
  const db = new FakeDB([
    {
      id: 'user_abc123',
      email: 'someone@example.com',
      username: 'someone',
      auth_provider: 'email'
    }
  ]);
  const env = { DB: db, GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_USER_ID: 'user_abc123' };

  const { value: ok, errors } = await captureErrors(() =>
    ensureServiceUserRow(env, buildServiceUser(env))
  );

  assert.equal(ok, false, 'a human-owned id must not be accepted as the service row');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /not a service account/i);
});

test('resolveServiceUser does not authenticate onto a human account', async () => {
  const db = new FakeDB([
    {
      id: 'user_victim',
      email: 'victim@example.com',
      username: 'victim',
      auth_provider: 'email'
    }
  ]);
  const env = { DB: db, GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_USER_ID: 'user_victim' };

  const { value: user } = await captureErrors(() => resolveServiceUser(SERVICE_TOKEN, env));

  assert.equal(user, null, 'the service token must not resolve to the victim identity');
});

test('getUserFromRequest rejects the service token when it points at a human account', async () => {
  const db = new FakeDB([
    {
      id: 'user_victim_req',
      email: 'victim2@example.com',
      username: 'victim2',
      auth_provider: 'email'
    }
  ]);
  const env = { DB: db, GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_USER_ID: 'user_victim_req' };

  const { value: user } = await captureErrors(() => getUserFromRequest(bearer(SERVICE_TOKEN), env));

  // Falls through to the session path, which the fake never matches.
  assert.equal(user, null);
});

test('a row already provisioned as a service account is still accepted', async () => {
  const db = new FakeDB([
    {
      id: 'service:already-there',
      email: 'service:already-there@service.invalid',
      username: 'service:already-there',
      auth_provider: 'service'
    }
  ]);
  const env = {
    DB: db,
    GPT_SERVICE_TOKEN: SERVICE_TOKEN,
    GPT_SERVICE_USER_ID: 'service:already-there'
  };

  assert.equal(await ensureServiceUserRow(env, buildServiceUser(env)), true);
  const user = await resolveServiceUser(SERVICE_TOKEN, env);
  assert.ok(user);
  assert.equal(user.id, 'service:already-there');
});

// ---------------------------------------------------------------------------
// Finding #3 — provisioning failure must fail authentication, not just log.
// ---------------------------------------------------------------------------

test('resolveServiceUser returns null when the backing row cannot be verified', async () => {
  // A real account squats the derived address, so INSERT OR IGNORE is dropped
  // and no service row exists. Authenticating anyway would hand out an
  // unmetered account, because enforceReadingLimit swallows the FK failure.
  const db = new FakeDB([
    {
      id: 'someone-else',
      email: 'service:blocked@service.invalid',
      username: 'realuser',
      auth_provider: 'email'
    }
  ]);
  const env = { DB: db, GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_USER_ID: 'service:blocked' };

  const { value: user } = await captureErrors(() => resolveServiceUser(SERVICE_TOKEN, env));

  assert.equal(user, null, 'unverifiable provisioning must not authenticate');
});

test('resolveServiceUser returns null when the DB throws', async () => {
  const env = {
    DB: {
      prepare() {
        throw new Error('D1 unavailable');
      }
    },
    GPT_SERVICE_TOKEN: SERVICE_TOKEN,
    GPT_SERVICE_USER_ID: 'service:db-throws'
  };

  const { value: user } = await captureErrors(() => resolveServiceUser(SERVICE_TOKEN, env));

  assert.equal(user, null);
});

test('resolveServiceUser still works with no DB binding at all', async () => {
  // Routes without a DB binding need no row: there is nothing to meter and no
  // FK to satisfy. This must keep working (regression guard).
  const env = { GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_USER_ID: 'service:no-db' };
  const user = await resolveServiceUser(SERVICE_TOKEN, env);

  assert.ok(user, 'service auth must not require a database');
  assert.equal(user.auth_provider, 'service');
});

test('isValidEmail rejects the reserved .invalid TLD used by service rows', () => {
  // Registration accepting `.invalid` lets an attacker pre-register the derived
  // service address and permanently block provisioning.
  assert.equal(isValidEmail('service:gpt@service.invalid'), false);
  assert.equal(isValidEmail('anything@service.invalid'), false);
  assert.equal(isValidEmail('someone@foo.invalid'), false);
  assert.equal(isValidEmail('SOMEONE@FOO.INVALID'), false);
  // Ordinary addresses are unaffected.
  assert.equal(isValidEmail('henry@lakefrontdigital.io'), true);
  assert.equal(isValidEmail('a@b.co'), true);
  assert.equal(isValidEmail('user@invalid.example.com'), true);
});

// ---------------------------------------------------------------------------
// Finding #6 — an `sk_` service token can never match, so reject it as config.
// ---------------------------------------------------------------------------

test('an sk_-prefixed service token is rejected as misconfiguration', async () => {
  const skToken = 'sk_0123456789abcdef0123456789abcdef';
  const env = { GPT_SERVICE_TOKEN: skToken };

  assert.equal(
    isServiceAuthConfigured(env),
    false,
    'sk_ is the API-key namespace and is skipped by getUserFromRequest'
  );
  assert.equal(await matchesServiceToken(skToken, env), false);
});

test('an sk_-prefixed service token does not authenticate end to end', async () => {
  const skToken = 'sk_0123456789abcdef0123456789abcdef';
  const env = { DB: new FakeDB(), GPT_SERVICE_TOKEN: skToken };
  const user = await getUserFromRequest(bearer(skToken), env);

  assert.equal(user, null, 'it must fail loudly at config time, not silently at request time');
});

test('a normal token is still configured and still matches', async () => {
  const env = { GPT_SERVICE_TOKEN: SERVICE_TOKEN };
  assert.equal(isServiceAuthConfigured(env), true);
  assert.equal(await matchesServiceToken(SERVICE_TOKEN, env), true);
});
