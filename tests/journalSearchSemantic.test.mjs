// GET /api/journal/search: exact matches first, an explicit `mode=semantic`
// search by meaning, and journal filters on both, against real SQLite.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedEntry, seedSession, seedUser } from './helpers/journalFixtures.mjs';
import { onRequestGet as search } from '../functions/api/journal/search.js';
import { EXTRACTION_VERSION } from '../functions/lib/coachSuggestion.js';

const QUERY_VECTOR = [1, 0, 0];

async function fixture(t) {
  const db = await createD1();
  t.after(() => db.sqlite.close());
  await seedUser(db, { id: 'owner', tier: 'plus' });
  await seedSession(db, { id: 'session-owner', userId: 'owner' });
  const entries = [
    // Says "lighthouse" but has no embedding: only exact search finds it.
    { id: 'literal', narrative: 'A lighthouse on the shore.', context: 'love', embedding: null },
    // No shared words, close in meaning (same vector as the query).
    { id: 'similar-love', narrative: 'A beacon guiding ships home.', context: 'love', embedding: QUERY_VECTOR },
    { id: 'similar-career', narrative: 'A signal fire for the crew.', context: 'career', embedding: QUERY_VECTOR },
    // Unrelated meaning.
    { id: 'distant', narrative: 'A quiet garden at noon.', context: 'career', embedding: [0, 1, 0] }
  ];
  for (const entry of entries) {
    await seedEntry(db, { id: entry.id, userId: 'owner', narrative: entry.narrative });
    await db.prepare('UPDATE journal_entries SET context = ?, step_embeddings = ?, extraction_version = ? WHERE id = ?')
      .bind(entry.context, entry.embedding ? JSON.stringify([entry.embedding]) : null, entry.embedding ? EXTRACTION_VERSION : null, entry.id)
      .run();
  }
  const aiCalls = [];
  const env = {
    DB: db,
    AI: {
      run: async (model, input) => {
        aiCalls.push(input.text);
        return { data: input.text.map(() => QUERY_VECTOR) };
      }
    }
  };
  const run = async (params) => {
    const response = await search({
      request: new Request(`https://example.test/api/journal/search?${new URLSearchParams(params)}`, {
        headers: { Cookie: 'session=session-owner' }
      }),
      env
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    return { mode: body.mode, ids: body.entries.map((entry) => entry.id).sort() };
  };
  return { run, aiCalls };
}

test('a literal match is returned as exact without computing embeddings', async (t) => {
  const { run, aiCalls } = await fixture(t);
  assert.deepEqual(await run({ q: 'lighthouse' }), { mode: 'exact', ids: ['literal'] });
  assert.equal(aiCalls.length, 0);
});

test('mode=semantic searches by meaning even when exact matches exist', async (t) => {
  const { run, aiCalls } = await fixture(t);
  assert.deepEqual(await run({ q: 'lighthouse', mode: 'semantic' }), {
    mode: 'semantic',
    ids: ['similar-career', 'similar-love']
  });
  assert.deepEqual(aiCalls, [['lighthouse']]);
});

test('journal filters narrow matches by meaning as they narrow exact matches', async (t) => {
  const { run } = await fixture(t);
  assert.deepEqual(await run({ q: 'lighthouse', mode: 'semantic', contexts: 'career' }), {
    mode: 'semantic',
    ids: ['similar-career']
  });
  // No exact match in the filter falls back to meaning, with the filter kept.
  assert.deepEqual(await run({ q: 'lighthouse', contexts: 'career' }), {
    mode: 'semantic',
    ids: ['similar-career']
  });
});
