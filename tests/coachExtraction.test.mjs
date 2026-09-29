import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  EMPTY_EXTRACTION_VERSION,
  EXTRACTION_VERSION,
  extractNextStepsWithAI,
  generateEmbeddings
} from '../functions/lib/coachSuggestion.js';
import { findSimilarJournalEntries } from '../functions/lib/journalSearch.js';
import { onRequestGet as listJournal } from '../functions/api/journal.js';
import { onRequestGet as readEntry } from '../functions/api/journal/[id].js';
import {
  onRequestGet as backfillStatus,
  onRequestPost as backfill
} from '../functions/api/coach-extraction-backfill.js';
import { apiRequest, journalFixture } from './helpers/journalD1.mjs';

const STEPS = ['Name the hilltop I am defending', 'Take one slow walk'];

// Workers AI stand-in: chat calls return STEPS, embedding calls one unit vector per text.
// By default `response` holds the already-parsed array, as the live binding returns it.
const CHAT_SHAPES = {
  parsed: () => ({ response: STEPS, choices: [{ message: { content: JSON.stringify(STEPS) } }] }),
  text: () => ({ response: `Here you go:\n${JSON.stringify(STEPS)}` }),
  choices: () => ({ choices: [{ message: { content: JSON.stringify(STEPS) } }] })
};

function fakeAI({ shape = 'parsed' } = {}) {
  const calls = [];
  return {
    calls,
    async run(model, input) {
      calls.push({ model, input });
      if (input.messages) return CHAT_SHAPES[shape]();
      return { data: input.text.map(() => [1, 0]) };
    }
  };
}

const LONG_NARRATIVE = `${'The Hermit asks for patience. '.repeat(200)}\n\n### Gentle Next Steps\n- Name the hilltop.`;

describe('coach extraction models', () => {
  test('extraction sends the whole narrative, including a late next-steps section', async () => {
    const ai = fakeAI();
    const result = await extractNextStepsWithAI({ AI: ai }, LONG_NARRATIVE, 'test');
    assert.equal(result.status, 'ok');
    assert.deepEqual(result.steps, STEPS);
    assert.equal(ai.calls[0].model, '@cf/meta/llama-4-scout-17b-16e-instruct');
    assert.ok(LONG_NARRATIVE.length > 4000);
    assert.ok(ai.calls[0].input.messages[1].content.includes('### Gentle Next Steps'));
  });

  for (const shape of ['text', 'choices']) {
    test(`extraction also reads a ${shape} answer`, async () => {
      const result = await extractNextStepsWithAI({ AI: fakeAI({ shape }) }, LONG_NARRATIVE, 'test');
      assert.equal(result.status, 'ok');
      assert.deepEqual(result.steps, STEPS);
    });
  }

  test('embeddings use bge-m3 and truncate over-long inputs', async () => {
    const ai = fakeAI();
    const vectors = await generateEmbeddings({ AI: ai }, STEPS, 'test');
    assert.equal(vectors.length, STEPS.length);
    assert.equal(ai.calls[0].model, '@cf/baai/bge-m3');
    assert.equal(ai.calls[0].input.truncate_inputs, true);
  });
});

describe('stored step embeddings by extraction version', () => {
  let fixture;
  before(async () => { fixture = await journalFixture(); });
  after(async () => { await fixture?.close(); });
  beforeEach(async () => { await fixture.db.exec('DELETE FROM journal_entries'); });

  const insert = (id, createdAt, version, { steps = STEPS, embeddings = [[1, 0], [1, 0]], narrative = LONG_NARRATIVE } = {}) =>
    fixture.db.prepare(`
      INSERT INTO journal_entries (id, user_id, created_at, updated_at, spread_key, spread_name, question, cards_json,
        narrative, extracted_steps, step_embeddings, extraction_version)
      VALUES (?, 'owner', ?, ?, 'threeCard', 'Three-Card Story', 'What am I defending?', '[]', ?, ?, ?, ?)
    `).bind(
      id, createdAt, createdAt, narrative,
      steps ? JSON.stringify(steps) : null,
      embeddings ? JSON.stringify(embeddings) : null,
      version
    ).run();
  const version = async (id) =>
    (await fixture.db.prepare('SELECT extraction_version FROM journal_entries WHERE id = ?').bind(id).first()).extraction_version;
  const adminRequest = (method) => new Request('https://example.test/api/coach-extraction-backfill?limit=10', {
    method, headers: { Authorization: 'Bearer admin-test-key' }
  });

  test('journal reads only return embeddings from the current version', async () => {
    await insert('current', 2_000, EXTRACTION_VERSION);
    await insert('older', 1_000, 'v1');

    const list = await (await listJournal({ request: apiRequest('/api/journal'), env: { DB: fixture.db } })).json();
    const byId = Object.fromEntries(list.entries.map((entry) => [entry.id, entry]));
    assert.deepEqual(byId.current.stepEmbeddings, [[1, 0], [1, 0]]);
    assert.equal(byId.older.stepEmbeddings, null);
    assert.deepEqual(byId.older.extractedSteps, STEPS);

    const single = await (await readEntry({ request: apiRequest('/api/journal/older'), env: { DB: fixture.db }, params: { id: 'older' } })).json();
    assert.equal(single.entry.stepEmbeddings, null);
  });

  test('semantic search skips vectors from older versions', async () => {
    await insert('current', 2_000, EXTRACTION_VERSION);
    await insert('older', 1_000, 'v1');
    const matches = await findSimilarJournalEntries({ AI: fakeAI(), DB: fixture.db }, 'owner', 'What am I defending?', { minSimilarity: 0.5 });
    assert.deepEqual(matches.map((match) => match.id), ['current']);
  });

  test('backfill re-extracts missing and older-version entries and leaves finished ones alone', async () => {
    await insert('missing', 5_000, null, { steps: null, embeddings: null });
    await insert('older', 4_000, 'v1');
    await insert('steps-only', 3_000, `${EXTRACTION_VERSION}-steps-only`, { embeddings: null });
    await insert('current', 2_000, EXTRACTION_VERSION, { steps: ['keep me'], embeddings: [[0, 1]] });
    await insert('empty', 1_000, EMPTY_EXTRACTION_VERSION, { steps: [], embeddings: [] });
    const env = { DB: fixture.db, AI: fakeAI(), ADMIN_API_KEY: 'admin-test-key' };

    const before = await (await backfillStatus({ request: adminRequest('GET'), env })).json();
    assert.equal(before.extractionVersion, EXTRACTION_VERSION);
    assert.equal(before.needsExtraction, 3);

    const run = await (await backfill({ request: adminRequest('POST'), env })).json();
    assert.equal(run.processed, 3);
    assert.equal(run.failed, 0);
    for (const id of ['missing', 'older', 'steps-only']) assert.equal(await version(id), EXTRACTION_VERSION, id);
    const untouched = await fixture.db.prepare("SELECT extracted_steps FROM journal_entries WHERE id = 'current'").first();
    assert.equal(untouched.extracted_steps, '["keep me"]');
    assert.equal(await version('empty'), EMPTY_EXTRACTION_VERSION);

    const afterRun = await (await backfillStatus({ request: adminRequest('GET'), env })).json();
    assert.equal(afterRun.needsExtraction, 0);
  });
});
