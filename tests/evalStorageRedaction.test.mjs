import assert from 'node:assert/strict';
import { test } from 'node:test';

import { onRequestPost } from '../functions/api/tarot-reading.js';
import { saveMemory } from '../functions/lib/userMemory.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession } from './helpers/journalFixtures.mjs';

const EVAL_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';

test('stored eval metrics redact a name that reaches the reading only through memory', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  const d1 = await createD1();
  await seedUser(d1);
  await seedSession(d1);
  const memory = await saveMemory(d1, 'user-1', {
    text: 'User (Henry) asks for grounded, practical advice.',
    category: 'theme'
  });
  assert.equal(memory.saved, true);

  t.mock.method(globalThis, 'fetch', async () => Response.json({
    output_text: 'Henry, The Sun invites a gentle reflection today. Consider one small supportive choice, Henry. Your choices shape the way forward.'
  }));
  const evaluator = {
    async run(model) {
      if (model !== EVAL_MODEL) throw new Error('unavailable');
      return {
        response: JSON.stringify({
          personalization: 4, tarot_coherence: 4, tone: 4, safety: 5, overall: 4, safety_flag: false,
          notes: "'Henry' is used."
        })
      };
    }
  };
  const pending = [];
  const response = await onRequestPost({
    request: new Request('https://tableau.test/api/tarot-reading', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: 'session=session-1' },
      body: JSON.stringify({
        spreadInfo: { key: 'single', name: 'One-Card Insight' },
        cardsInfo: [{ card: 'The Sun', number: 19, position: 'Theme', orientation: 'Upright', meaning: 'Warmth and renewal.' }],
        userQuestion: 'What supports me today?'
      })
    }),
    env: {
      DB: d1,
      AI: evaluator,
      AZURE_OPENAI_API_KEY: 'test',
      AZURE_OPENAI_ENDPOINT: 'https://provider.test',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
      AZURE_OPENAI_STREAMING_ENABLED: 'false',
      EVAL_ENABLED: 'true',
      EVAL_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false'
    },
    waitUntil: (promise) => pending.push(promise)
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.reading, /Henry/, 'the delivered reading keeps the name');
  await Promise.all(pending);

  const row = await d1.prepare('SELECT payload FROM eval_metrics WHERE request_id = ?').bind(body.requestId).first();
  const stored = JSON.parse(row.payload);
  assert.equal(stored._storageMode, 'redact');
  assert.equal(stored.eval.scores.notes, "'[NAME]' is used.");
  assert.doesNotMatch(stored.readingText, /Henry/);
});
