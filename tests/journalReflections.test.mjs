import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { jsonRequest, seedEntry, seedSession, seedUser } from './helpers/journalFixtures.mjs';
import { onRequestPost } from '../functions/api/journal/reflections.js';
import {
  addJournalReflection,
  MAX_REFLECTION_LENGTH,
  MAX_TARGET_REFLECTION_LENGTH
} from '../functions/lib/journalReflections.js';

const OWNER = Object.freeze({
  id: 'user-1',
  subscription_tier: 'plus',
  subscription_status: 'active',
  auth_provider: 'session'
});

const THOTH_CARDS = [
  { position: 'Past', name: 'Knight of Wands', suit: 'Wands', rank: 'Knight', rankValue: 12, orientation: 'Upright' },
  { position: 'Present', name: 'King of Wands', suit: 'Wands', rank: 'King', rankValue: 14, orientation: 'Upright' }
];

async function setup({ tier = 'plus', entry = {} } = {}) {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1', tier });
  await seedSession(d1, { id: 'session-1', userId: 'user-1' });
  await seedUser(d1, { id: 'user-2' });
  await seedEntry(d1, { id: 'entry-1', userId: 'user-1', ...entry });
  await seedEntry(d1, { id: 'entry-other', userId: 'user-2' });
  return { d1, env: { DB: d1 } };
}

async function post(env, body, { entryId = 'entry-1', cookie = 'session=session-1' } = {}) {
  const response = await onRequestPost({
    request: jsonRequest(`https://example.com/api/journal/${entryId}/reflections`, {
      body,
      headers: cookie ? { Cookie: cookie } : {}
    }),
    env,
    params: { id: entryId }
  });
  return { response, payload: await response.json() };
}

function stored(d1, entryId = 'entry-1') {
  const [row] = d1.rows('SELECT reflections_json FROM journal_entries WHERE id = ?', [entryId]);
  return row.reflections_json === null ? null : JSON.parse(row.reflections_json);
}

/** Route UPDATE statements for the reflections map through `onUpdate`. */
function interceptUpdates(d1, onUpdate) {
  return {
    prepare(sql) {
      const statement = d1.prepare(sql);
      if (!/UPDATE journal_entries SET reflections_json/.test(sql)) return statement;
      return { bind: (...args) => ({ run: () => onUpdate(statement.bind(...args)) }) };
    }
  };
}

describe('reflections: access', () => {
  it('answers 401 without credentials', async () => {
    const { d1, env } = await setup();
    const { response, payload } = await post(env, { text: 'note', scope: 'reading' }, { cookie: null });
    assert.equal(response.status, 401);
    assert.equal(payload.error, 'Not authenticated');
    assert.equal(stored(d1), null);
  });

  it('answers a tier-limited 403 below Plus', async () => {
    const { env } = await setup({ tier: 'free' });
    const { response, payload } = await post(env, { text: 'note', scope: 'reading' });
    assert.equal(response.status, 403);
    assert.equal(payload.tierLimited, true);
    assert.equal(payload.requiredTier, 'plus');
  });

  it("answers the same 404 for a missing entry and for another user's entry", async () => {
    const { d1, env } = await setup();
    const missing = await post(env, { text: 'note', scope: 'reading' }, { entryId: 'nope' });
    const foreign = await post(env, { text: 'note', scope: 'reading' }, { entryId: 'entry-other' });
    assert.equal(missing.response.status, 404);
    assert.equal(foreign.response.status, 404);
    assert.deepEqual(foreign.payload, missing.payload);
    assert.equal(stored(d1, 'entry-other'), null);
  });
});

describe('reflections: validation', () => {
  it('accepts 1 and 2,000 characters; rejects blank and 2,001', async () => {
    const { env } = await setup();
    assert.equal(MAX_REFLECTION_LENGTH, 2000);
    assert.equal((await post(env, { text: 'x', scope: 'reading' })).response.status, 200);
    assert.equal((await post(env, { text: 'y'.repeat(2000), scope: 'reading' })).response.status, 200);
    const tooLong = await post(env, { text: 'z'.repeat(2001), scope: 'reading' });
    assert.equal(tooLong.response.status, 400);
    assert.equal(tooLong.payload.maxLength, 2000);
    assert.equal((await post(env, { text: '   ', scope: 'reading' })).response.status, 400);
  });

  it('rejects `mode`: reflections only append', async () => {
    const { d1, env } = await setup();
    const { response, payload } = await post(env, { text: 'note', scope: 'reading', mode: 'replace' });
    assert.equal(response.status, 400);
    assert.match(payload.error, /append-only/);
    assert.equal(stored(d1), null);
  });

  it('rejects an unknown scope', async () => {
    const { env } = await setup();
    const { response } = await post(env, { text: 'note', scope: 'deck' });
    assert.equal(response.status, 400);
  });
});

describe('reflections: targeting', () => {
  it('files a card note under the resolved index and reports the target', async () => {
    const { d1, env } = await setup();
    const { response, payload } = await post(env, { text: 'six months alone', scope: 'card', card: 'The Hermit', position: 'Past' });

    assert.equal(response.status, 200);
    assert.deepEqual(stored(d1), { 0: 'six months alone' });
    assert.equal(payload.success, true);
    assert.equal(payload.entryId, 'entry-1');
    assert.equal(payload.key, '0');
    assert.deepEqual(payload.reflection, {
      key: '0', scope: 'card', cardIndex: 0, card: 'The Hermit', position: 'Past', text: 'six months alone'
    });
    assert.equal(payload.alreadyPresent, undefined);
  });

  it('resolves a card by name alone, ignoring case and a leading "the"', async () => {
    const { d1, env } = await setup();
    const { payload } = await post(env, { text: 'hope returns', scope: 'card', card: 'star' });
    assert.equal(payload.key, '2');
    assert.deepEqual(stored(d1), { 2: 'hope returns' });
  });

  it('resolves a card by position alone and by cardIndex', async () => {
    const { d1, env } = await setup();
    await post(env, { text: 'friends around me', scope: 'card', position: 'present' });
    await post(env, { text: 'index note', cardIndex: 0 });
    assert.deepEqual(stored(d1), { 1: 'friends around me', 0: 'index note' });
  });

  it('requires a position when the card appears twice', async () => {
    const cards = [
      { position: 'Past', name: 'The Hermit', number: 9, orientation: 'Upright' },
      { position: 'Future', name: 'The Hermit', number: 9, orientation: 'Reversed' }
    ];
    const { env } = await setup({ entry: { cards } });
    const ambiguous = await post(env, { text: 'which one?', scope: 'card', card: 'The Hermit' });
    assert.equal(ambiguous.response.status, 400);
    assert.match(ambiguous.payload.error, /more than once/);

    const precise = await post(env, { text: 'the later one', scope: 'card', card: 'The Hermit', position: 'Future' });
    assert.equal(precise.payload.key, '1');
  });

  it('rejects a card that is not in the entry and lists the entry cards', async () => {
    const { d1, env } = await setup();
    const { response, payload } = await post(env, { text: 'note', scope: 'card', card: 'The Tower' });
    assert.equal(response.status, 400);
    assert.match(payload.error, /Tower/);
    assert.deepEqual(payload.cards.map((card) => card.name), ['The Hermit', 'Three of Cups', 'The Star']);
    assert.equal(stored(d1), null);
  });

  it('resolves a deck label through the entry deck (Thoth)', async () => {
    const { d1, env } = await setup({ entry: { deckId: 'thoth-a1', cards: THOTH_CARDS } });
    const prince = await post(env, { text: 'the Prince', scope: 'card', card: 'Prince of Wands', position: 'Past' });
    const knight = await post(env, { text: 'the Thoth Knight', scope: 'card', card: 'Knight of Wands', position: 'Present' });
    assert.equal(prince.payload.key, '0', 'Thoth Prince of Wands is canonical Knight of Wands');
    assert.equal(knight.payload.key, '1', 'Thoth Knight of Wands is canonical King of Wands');
    assert.equal(prince.payload.reflection.card, 'Prince of Wands');
    assert.equal(knight.payload.reflection.card, 'Knight of Wands');
    const [entry] = d1.rows('SELECT cards_json FROM journal_entries WHERE id = ?', ['entry-1']);
    assert.deepEqual(JSON.parse(entry.cards_json).map((card) => card.name), ['Knight of Wands', 'King of Wands']);

    // Each returned card is a reusable input, even where a Thoth label collides
    // with the canonical name of the other stored card.
    const princeRetry = await post(env, {
      text: 'the Prince', scope: 'card',
      card: prince.payload.reflection.card, position: prince.payload.reflection.position
    });
    const knightRetry = await post(env, {
      text: 'the Thoth Knight', scope: 'card', card: knight.payload.reflection.card
    });
    assert.equal(princeRetry.payload.key, '0');
    assert.equal(knightRetry.payload.key, '1');
    assert.equal(princeRetry.payload.alreadyPresent, true);
    assert.equal(knightRetry.payload.alreadyPresent, true);
    assert.deepEqual(stored(d1), { 0: 'the Prince', 1: 'the Thoth Knight' });
  });

  it('lists deck labels next to canonical names for non-RWS entries', async () => {
    const { env } = await setup({ entry: { deckId: 'thoth-a1', cards: THOTH_CARDS } });
    const { payload } = await post(env, { text: 'note', scope: 'card', card: 'The Tower' });
    assert.deepEqual(payload.cards.map((card) => card.label), ['Prince of Wands', 'Knight of Wands']);
  });

  it('files a reading note under Overall, and defaults to reading scope when no card is named', async () => {
    const { d1, env } = await setup();
    const explicit = await post(env, { text: 'whole reading felt gentle', scope: 'reading' });
    const implicit = await post(env, { text: 'and hopeful' });
    assert.equal(explicit.payload.key, 'Overall');
    assert.equal(implicit.payload.reflection.scope, 'reading');
    assert.deepEqual(stored(d1), { Overall: 'whole reading felt gentle\n\nand hopeful' });
  });
});

describe('reflections: append and idempotency', () => {
  it('appends with a blank line and keeps other keys', async () => {
    const { d1, env } = await setup({ entry: { reflections: { 0: 'first thought', 1: 'untouched' } } });
    const { payload } = await post(env, { text: 'second thought', scope: 'card', card: 'The Hermit' });
    assert.deepEqual(stored(d1), { 0: 'first thought\n\nsecond thought', 1: 'untouched' });
    assert.deepEqual(payload.reflections, stored(d1));
  });

  it('does not append the same note twice', async () => {
    const { d1, env } = await setup();
    await post(env, { text: 'same note', scope: 'reading' });
    const { response, payload } = await post(env, { text: 'same note', scope: 'reading' });
    assert.equal(response.status, 200);
    assert.equal(payload.alreadyPresent, true);
    assert.deepEqual(stored(d1), { Overall: 'same note' });
  });

  it('does not re-append an earlier note after a later one (A, B, retry A)', async () => {
    const { d1, env } = await setup();
    await post(env, { text: 'A', scope: 'reading' });
    await post(env, { text: 'B', scope: 'reading' });
    const retry = await post(env, { text: 'A', scope: 'reading' });
    assert.equal(retry.payload.alreadyPresent, true);
    assert.deepEqual(stored(d1), { Overall: 'A\n\nB' });
  });

  it('treats Windows line endings and trailing spaces as the same note', async () => {
    const { d1, env } = await setup();
    await post(env, { text: 'line one\nline two', scope: 'reading' });
    const retry = await post(env, { text: 'line one\r\nline two  ', scope: 'reading' });
    assert.equal(retry.payload.alreadyPresent, true);
    assert.deepEqual(stored(d1), { Overall: 'line one\nline two' });
  });

  it('writes once when two identical retries race', async () => {
    const { d1, env } = await setup();
    const body = { text: 'same note', scope: 'reading' };
    const [a, b] = await Promise.all([post(env, body), post(env, body)]);
    assert.deepEqual([Boolean(a.payload.alreadyPresent), Boolean(b.payload.alreadyPresent)].sort(), [false, true]);
    assert.deepEqual(stored(d1), { Overall: 'same note' });
  });

  it('refuses to grow one target past 20,000 characters', async () => {
    const { d1, env } = await setup({ entry: { reflections: { Overall: 'x'.repeat(MAX_TARGET_REFLECTION_LENGTH - 1) } } });
    const { response, payload } = await post(env, { text: 'more', scope: 'reading' });
    assert.equal(response.status, 400);
    assert.equal(payload.error, 'This reflection is full');
    assert.equal(stored(d1).Overall.length, MAX_TARGET_REFLECTION_LENGTH - 1);
  });

  it('treats malformed stored reflections as empty', async () => {
    const { d1, env } = await setup({ entry: { reflections: 'not json at all' } });
    const { response } = await post(env, { text: 'fresh start', scope: 'card', card: 'The Star' });
    assert.equal(response.status, 200);
    assert.deepEqual(stored(d1), { 2: 'fresh start' });
  });

  it('writes a map the journal UI renders (strings, not arrays)', async () => {
    const { env } = await setup();
    const { payload } = await post(env, { text: 'visible in the app', scope: 'card', card: 'The Hermit' });
    const rendered = Object.entries(payload.reflections).filter(([, note]) => typeof note === 'string' && note.trim());
    assert.deepEqual(rendered, [['0', 'visible in the app']]);
  });
});

describe('addJournalReflection: compare-and-swap', () => {
  it('re-reads and appends when the entry changes between read and write', async () => {
    const { d1 } = await setup();
    let interfered = false;
    const db = interceptUpdates(d1, (bound) => {
      if (!interfered) {
        interfered = true;
        d1.rows('UPDATE journal_entries SET reflections_json = ? WHERE id = ?', [JSON.stringify({ Overall: 'concurrent' }), 'entry-1']);
      }
      return bound.run();
    });

    const result = await addJournalReflection({ env: { DB: db }, user: OWNER, entryId: 'entry-1', input: { text: 'mine', scope: 'reading' } });

    assert.equal(result.status, 200);
    assert.deepEqual(stored(d1), { Overall: 'concurrent\n\nmine' });
  });

  it('answers 409 after three conflicting attempts', async () => {
    const { d1 } = await setup();
    let attempts = 0;
    const db = interceptUpdates(d1, async () => {
      attempts += 1;
      return { success: true, meta: { changes: 0 } };
    });

    const result = await addJournalReflection({ env: { DB: db }, user: OWNER, entryId: 'entry-1', input: { text: 'mine', scope: 'reading' } });

    assert.equal(result.status, 409);
    assert.equal(attempts, 3);
    assert.equal(stored(d1), null);
  });
});
