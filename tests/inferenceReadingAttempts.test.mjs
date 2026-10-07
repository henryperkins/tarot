import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { onRequestPost } from '../functions/api/tarot-reading.js';
import { claudeSseResponse, claudeErrorResponse } from './helpers/claudeSse.mjs';

const payload = { spreadInfo: { name: 'One-Card Insight', key: 'single' }, cardsInfo: [{ position: 'Theme', card: 'The Sun', orientation: 'Upright', meaning: 'Warmth and renewal.' }], userQuestion: 'What supports me today?' };
function request(body) { return new Request('https://tableau.test/api/tarot-reading', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '127.0.0.1' }, body: JSON.stringify(body) }); }
function silence(t) { for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, () => {}); }

test('reading records a refused returned model, quality rejection usage, and accepted local fallback', async (t) => {
  silence(t);
  const DB = await createD1();
  t.mock.method(globalThis, 'fetch', async (url) => String(url).includes('anthropic.com')
    ? claudeSseResponse('Declined.', { model: 'claude-returned-fallback', stopReason: 'refusal', inputTokens: 100, outputTokens: 5 })
    : Response.json({ status: 'completed', model: 'gpt-returned', usage: { input_tokens: 20, output_tokens: 2 }, output_text: 'Hello.' }));
  const response = await onRequestPost({ request: request(payload), env: { DB, ANTHROPIC_API_KEY: 'test', OPENAI_API_KEY: 'test', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false', GRAPHRAG_ENABLED: 'false' } });
  assert.equal(response.status, 200);
  const rows = DB.rows('SELECT * FROM inference_attempts ORDER BY started_at');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].state, 'failed');
  assert.equal(rows[0].reason, 'refusal');
  assert.equal(rows[0].model, 'claude-returned-fallback');
  assert.equal(rows[0].input_tokens, 100);
  assert.equal(rows[1].state, 'rejected');
  assert.equal(rows[1].model, 'gpt-returned');
  assert.equal(rows[1].usage_status, 'known');
  assert.equal(rows[2].provider, 'local-composer');
  assert.equal(rows[2].state, 'accepted');
  assert.equal(rows[2].usage_status, 'unknown');
});

test('all paid providers failing retains a row even when no reading can be returned', async (t) => {
  silence(t);
  const DB = await createD1();
  t.mock.method(globalThis, 'fetch', async () => claudeErrorResponse(400, 'invalid_request_error', 'Mock failure'));
  const response = await onRequestPost({ request: request({ ...payload, userQuestion: '¿Cómo puedo avanzar en esta relación?' }), env: { DB, ANTHROPIC_API_KEY: 'test', EVAL_ENABLED: 'false', GRAPHRAG_ENABLED: 'false' } });
  assert.equal(response.status, 503);
  const rows = DB.rows('SELECT * FROM inference_attempts');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, 'failed');
  assert.equal(rows[0].usage_status, 'unknown');
  assert.equal(rows[0].input_tokens, null);
});
