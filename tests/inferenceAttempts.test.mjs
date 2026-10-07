import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { recordInferenceAttempt, normalizeInferenceUsage } from '../functions/lib/inferenceAttempts.js';
import { buildMetricsPayload } from '../functions/lib/telemetrySchema.js';
import { persistReadingMetrics } from '../functions/lib/readingQuality.js';

const attempt = { requestId: 'reading-test', task: 'reading', provider: 'claude-api', requestedModel: 'claude-opus-5-5', model: 'claude-sonnet-5-5', state: 'rejected', reason: 'quality_rejected', startedAtMs: 1000, finishedAtMs: 1100 };

test('ledger retains returned model and known usage for quality-rejected and failed responses', async () => {
  const DB = await createD1();
  const usage = { input_tokens: 12, output_tokens: 8, cache_read_input_tokens: 4, cache_creation_input_tokens: 6 };
  assert.equal(await recordInferenceAttempt({ DB }, { ...attempt, usage }), true);
  assert.equal(await recordInferenceAttempt({ DB }, { ...attempt, model: null, state: 'failed', reason: 'provider_error', usage: null }), true);
  const rows = DB.rows('SELECT * FROM inference_attempts ORDER BY rowid');
  assert.equal(rows[0].model, 'claude-sonnet-5-5');
  assert.equal(rows[0].requested_model, 'claude-opus-5-5');
  assert.equal(rows[0].usage_status, 'known');
  assert.equal(rows[0].total_tokens, 20);
  assert.equal(rows[0].cache_read_input_tokens, 4);
  assert.equal(rows[1].usage_status, 'unknown');
  assert.equal(rows[1].total_tokens, null);
});

test('attempt records never include prompts, identity, PII, or raw provider errors and are idempotent', async () => {
  const DB = await createD1();
  const unsafe = { ...attempt, id: 'attempt-id', reason: 'private user@example.com upstream prompt', error: 'private details', prompt: 'secret reading', userId: 'private reader', usage: { output_tokens: 0 } };
  await recordInferenceAttempt({ DB }, unsafe);
  await recordInferenceAttempt({ DB }, unsafe);
  const rows = DB.rows('SELECT * FROM inference_attempts');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, 'unknown');
  assert.equal(rows[0].usage_status, 'partial');
  assert.equal(rows[0].output_tokens, 0);
  assert.equal(rows[0].input_tokens, null);
  assert.ok(!JSON.stringify(rows).includes('private'));
  assert.ok(!JSON.stringify(rows).includes('secret'));
});

test('unknown usage is distinct from known zero without inventing totals for partial fields', () => {
  assert.equal(normalizeInferenceUsage(null).status, 'unknown');
  assert.equal(normalizeInferenceUsage({ input_tokens: 0, output_tokens: 0 }).status, 'known');
  assert.equal(normalizeInferenceUsage({ input_tokens: 0, output_tokens: 0 }).totalTokens, 0);
  assert.equal(normalizeInferenceUsage({ input_tokens: 12 }).totalTokens, null);
  assert.equal(normalizeInferenceUsage({ input_tokens: -1, output_tokens: 'bad' }).status, 'unknown');
});

test('redacted accepted metrics preserve model/cache provenance while discarded attempts stay separate', async () => {
  const DB = await createD1();
  const metrics = buildMetricsPayload({ requestId: 'accepted', timestamp: new Date().toISOString(), provider: 'claude-api', spreadKey: 'single', promptMeta: { inference: { provider: 'claude-api', model: 'claude-sonnet-5-5' } }, capturedUsage: { input_tokens: 12, output_tokens: 8, cache_read_input_tokens: 4 } });
  await persistReadingMetrics({ DB }, metrics);
  const payload = JSON.parse(DB.rows('SELECT payload FROM eval_metrics')[0].payload);
  assert.equal(payload.prompt.inference.model, 'claude-sonnet-5-5');
  assert.equal(payload.llmUsage.cacheReadInputTokens, 4);
  assert.equal(payload.llmUsage.usageStatus, 'known');
});
