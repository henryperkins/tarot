import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { computeDailyAggregates, storeQualityStats, getBaseline } from '../functions/lib/qualityAnalysis.js';
import { computeSummary } from '../functions/api/admin/quality-stats.js';

async function seed(DB, id, model, mode, score) {
  const payload = { timestamp: '2026-10-07T12:00:00Z', eval: { model, mode, promptVersion: 'eval-1', scores: { overall: score, tone: score, safety: score } } };
  await DB.prepare('INSERT INTO eval_metrics (request_id, provider, spread_key, reading_prompt_version, variant_id, eval_mode, overall_score, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, 'claude-api', 'single', 'read-1', 'control', mode, score, JSON.stringify(payload)).run();
}

test('real SQL aggregates and stores evaluator model/source slices separately', async () => {
  const DB = await createD1();
  await seed(DB, 'glm-one', '@cf/glm/one', 'model', 4);
  await seed(DB, 'glm-two', '@cf/glm/two', 'model', 2);
  await seed(DB, 'heuristic', 'heuristic-fallback', 'heuristic', 5);
  const groups = await computeDailyAggregates(DB, '2026-10-07');
  assert.equal(groups.length, 3);
  assert.equal(groups.find((group) => group.eval_model === '@cf/glm/one').avg_overall, 4);
  assert.equal(groups.find((group) => group.eval_source === 'heuristic').avg_overall, 5);
  for (const group of groups) await storeQualityStats(DB, '2026-10-07', group);
  assert.equal(DB.rows('SELECT * FROM quality_stats').length, 3);
  for (const group of groups) await storeQualityStats(DB, '2026-10-07', group);
  assert.equal(DB.rows('SELECT * FROM quality_stats').length, 3);
});

test('baseline and admin summary do not blend evaluator models or heuristic scores', async () => {
  const DB = await createD1();
  await seed(DB, 'glm-one', '@cf/glm/one', 'model', 4);
  await seed(DB, 'glm-two', '@cf/glm/two', 'model', 2);
  await seed(DB, 'heuristic', 'heuristic-fallback', 'heuristic', 5);
  const groups = await computeDailyAggregates(DB, '2026-10-07');
  for (const group of groups) await storeQualityStats(DB, '2026-10-06', group);
  const one = groups.find((group) => group.eval_model === '@cf/glm/one');
  assert.equal((await getBaseline(DB, '2026-10-07', one)).overall, 4);
  const summary = computeSummary(DB.rows('SELECT * FROM quality_stats'));
  assert.equal(summary.avgOverall, null);
  assert.equal(summary.evaluators.length, 3);
  assert.equal(summary.evaluators.find((group) => group.model === '@cf/glm/one').avgOverall, '4.00');
});


test('migration preserves historical NULL-dimensional duplicates and their IDs', async () => {
  const { default: initSqlJs } = await import('sql.js');
  const { readdirSync, readFileSync } = await import('node:fs');
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  const folder = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(folder).filter((name) => name.endsWith('.sql') && name < '0035').sort()) {
    sqlite.exec(readFileSync(new URL(name, folder), 'utf8'));
  }
  sqlite.exec("DROP INDEX idx_quality_stats_dimensions_unique");
  sqlite.exec("INSERT INTO quality_stats (id, period_type, period_key, reading_count) VALUES (101, 'daily', '2026-10-06', 7), (102, 'daily', '2026-10-06', 9)");
  sqlite.exec(readFileSync(new URL('0035_add_inference_provenance.sql', folder), 'utf8'));
  assert.deepEqual(sqlite.exec('SELECT id, reading_count, eval_model, eval_source FROM quality_stats ORDER BY id')[0].values, [[101, 7, null, null], [102, 9, null, null]]);
  sqlite.close();
});


test('evaluation reports returned evaluator model and records safe inference provenance', async () => {
  const { runEvaluation } = await import('../functions/lib/evaluation.js');
  const DB = await createD1();
  const result = await runEvaluation({ DB, EVAL_ENABLED: 'true', AI: { run: async () => ({ model: '@cf/actual-evaluator', usage: { input_tokens: 12, output_tokens: 8 }, response: JSON.stringify({ personalization: 4, tarot_coherence: 4, tone: 4, safety: 4, overall: 4, safety_flag: false }) }) } }, { requestId: 'eval-provenance', reading: 'A gentle reflection.', cardsInfo: [], spreadKey: 'single' });
  assert.equal(result.model, '@cf/actual-evaluator');
  assert.equal(DB.rows('SELECT model FROM inference_attempts')[0].model, '@cf/actual-evaluator');
});
