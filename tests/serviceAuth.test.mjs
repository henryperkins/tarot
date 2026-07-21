import assert from 'node:assert';
import test from 'node:test';
import { webcrypto } from 'node:crypto';

import { getUserFromRequest } from '../functions/lib/auth.js';
import {
  buildServiceUser,
  ensureServiceUserRow,
  matchesServiceToken,
  resolveServiceTier,
  resolveServiceUser,
  MIN_SERVICE_TOKEN_LENGTH
} from '../functions/lib/serviceAuth.js';
import {
  getSubscriptionContext,
  isApiKeyUser,
  isMachineCredential,
  isServiceUser
} from '../functions/lib/entitlements.js';

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
  const env = envWithId('service:plus-entitlement');
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

test('getUserFromRequest authenticates the service token without a DB binding', async () => {
  // Service tokens need no database, so they must resolve even on routes/envs
  // where env.DB is absent.
  const env = { GPT_SERVICE_TOKEN: SERVICE_TOKEN };
  const user = await getUserFromRequest(bearer(SERVICE_TOKEN), env);
  assert.ok(user, 'service token should authenticate without a DB binding');
  assert.strictEqual(user.auth_provider, 'service');
  assert.strictEqual(user.subscription_tier, 'plus');
});

test('getUserFromRequest returns null for a non-service Bearer token when DB is absent', async () => {
  const env = { GPT_SERVICE_TOKEN: SERVICE_TOKEN }; // no DB
  const user = await getUserFromRequest(bearer('sk_live_whatever'), env);
  assert.strictEqual(user, null, 'API-key/session paths still require the DB');
});

test('getUserFromRequest honors GPT_SERVICE_TIER=pro', async () => {
  const env = envWithId('service:pro-entitlement', { GPT_SERVICE_TIER: 'pro' });
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

// ---------------------------------------------------------------------------
// Backing users row.
//
// Per-user tables declare FOREIGN KEY (user_id) REFERENCES users(id) and D1
// enforces foreign keys by default. Without a real row, usage_tracking writes
// throw, enforceReadingLimit swallows the error and returns allowed:true — so
// the service account would get unlimited unmetered readings — and journal
// saves 500. These tests pin the row into existence.
// ---------------------------------------------------------------------------

/** Minimal D1 double backing just the `users` table, with UNIQUE emulation. */
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
              const [id, email, username, password_hash, password_salt] = args;
              const collides = [...db.users.values()].some(
                (u) => u.email === email || u.username === username
              );
              if (db.users.has(id) || collides) return { meta: { changes: 0 } };
              // The real INSERT stamps auth_provider='service'; provisioning
              // reads it back to prove the row is one we own.
              db.users.set(id, {
                id,
                email,
                username,
                password_hash,
                password_salt,
                auth_provider: 'service'
              });
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

  insertCount() {
    return this.statements.filter((s) => /INSERT OR IGNORE INTO users/i.test(s.sql)).length;
  }
}

// Provisioning is memoized per isolate, so every test uses a distinct id.
function envWithId(id, extra = {}) {
  return { DB: new FakeDB(), GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_USER_ID: id, ...extra };
}

test('resolveServiceUser provisions a backing users row so FK-bound writes succeed', async () => {
  const env = envWithId('service:provision-test');
  const user = await resolveServiceUser(SERVICE_TOKEN, env);

  assert.ok(user);
  const row = env.DB.users.get('service:provision-test');
  assert.ok(row, 'a users row must exist or every metered write fails the FK');
  assert.strictEqual(row.id, user.id);
});

test('the provisioned row cannot be signed into or password-reset', async () => {
  const env = envWithId('service:credentials-test');
  await resolveServiceUser(SERVICE_TOKEN, env);
  const row = env.DB.users.get('service:credentials-test');

  // Reserved TLD (RFC 2606) — no reset mail is ever deliverable.
  assert.match(row.email, /@service\.invalid$/);
  // A colon is rejected by isValidUsername, so no real signup can collide.
  assert.ok(row.username.includes(':'));
  // Random with no known preimage: no password can ever derive these.
  assert.match(row.password_hash, /^[0-9a-f]{64}$/);
  assert.match(row.password_salt, /^[0-9a-f]{64}$/);
  assert.notStrictEqual(row.password_hash, row.password_salt);
});

test('an id without a colon is still namespaced away from real usernames', async () => {
  const env = envWithId('mygpt');
  await resolveServiceUser(SERVICE_TOKEN, env);
  const row = env.DB.users.get('mygpt');
  assert.strictEqual(row.username, 'service:mygpt');
  assert.strictEqual(row.email, 'service:mygpt@service.invalid');
});

test('GPT_SERVICE_EMAIL labels the user object but never the backing row', async () => {
  const env = envWithId('service:email-test', { GPT_SERVICE_EMAIL: 'owner@example.com' });
  const user = await resolveServiceUser(SERVICE_TOKEN, env);

  assert.strictEqual(user.email, 'owner@example.com');
  // Deriving the row address keeps a misconfigured value from colliding with a
  // real account and silently blocking provisioning.
  assert.strictEqual(env.DB.users.get('service:email-test').email, 'service:email-test@service.invalid');
});

test('provisioning is memoized per isolate', async () => {
  const env = envWithId('service:memo-test');
  await resolveServiceUser(SERVICE_TOKEN, env);
  const afterFirst = env.DB.insertCount();
  await resolveServiceUser(SERVICE_TOKEN, env);
  await resolveServiceUser(SERVICE_TOKEN, env);

  assert.strictEqual(afterFirst, 1);
  assert.strictEqual(env.DB.insertCount(), 1, 'later requests must not re-issue the insert');
});

test('a unique collision fails loudly rather than silently', async () => {
  // A real account already holding the derived address blocks the insert;
  // INSERT OR IGNORE would swallow that, which is the exact silent failure the
  // verify-after-insert exists to catch.
  const db = new FakeDB([
    { id: 'someone-else', email: 'service:collide@service.invalid', username: 'realuser' }
  ]);
  const env = { DB: db, GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_USER_ID: 'service:collide' };

  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    const ok = await ensureServiceUserRow(env, buildServiceUser(env));
    assert.strictEqual(ok, false);
  } finally {
    console.error = originalError;
  }

  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /could not provision/i);
});

test('ensureServiceUserRow is a no-op without a DB binding', async () => {
  const env = { GPT_SERVICE_TOKEN: SERVICE_TOKEN };
  assert.strictEqual(await ensureServiceUserRow(env, buildServiceUser(env)), false);
});

// ---------------------------------------------------------------------------
// Machine-credential guardrails.
// ---------------------------------------------------------------------------

test('service tokens count as machine credentials, like API keys', () => {
  const service = { auth_provider: 'service' };
  const apiKey = { auth_provider: 'api_key' };
  const session = { auth_provider: 'email' };

  assert.strictEqual(isMachineCredential(service), true);
  assert.strictEqual(isMachineCredential(apiKey), true);
  assert.strictEqual(isMachineCredential(session), false);
  assert.strictEqual(isMachineCredential(null), false);

  assert.strictEqual(isServiceUser(service), true);
  assert.strictEqual(isServiceUser(apiKey), false);

  // Per-key API metering must stay API-key-only: service tokens are exempt by
  // design, so broadening this would start charging them per call.
  assert.strictEqual(isApiKeyUser(service), false);
  assert.strictEqual(isApiKeyUser(apiKey), true);
});
