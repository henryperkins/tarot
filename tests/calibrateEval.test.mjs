import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import { buildMetricsPayload, getNarrativeCoverage, getPromptVersion } from '../functions/lib/telemetrySchema.js';
import { toEvalRecord } from '../scripts/evaluation/exportEvalData.js';

// Two prompt versions, one A/B variant, and 6 of 24 readings with full card
// coverage but low coherence (above calibrateEval's 10% warning threshold).
function buildStoredPayloads() {
  return Array.from({ length: 24 }, (_, index) => ({
    ...buildMetricsPayload({
      requestId: `req-${index}`,
      timestamp: '2026-09-20T12:00:00.000Z',
      provider: 'openai',
      spreadKey: 'threeCard',
      deckStyle: 'rws-1909',
      promptMeta: { readingPromptVersion: index % 2 ? 'reading-v9' : 'reading-v10' },
      abAssignment: index % 3 ? null : { variantId: 'variant-b', experimentId: 'exp-1' },
      narrativeMetrics: { cardCount: 3, cardCoverage: 1, missingCards: [], hallucinatedCards: [] }
    }),
    eval: {
      scores: {
        personalization: 3,
        tarot_coherence: index < 6 ? 2 : 4,
        tone: 4,
        safety: 5,
        overall: 3 + (index % 2),
        safety_flag: false
      }
    }
  }));
}

// Mirrors the columns persistReadingMetrics and scheduleEvaluation write.
function toEvalMetricsRow(payload) {
  return {
    request_id: payload.requestId,
    created_at: '2026-09-20 12:00:00',
    spread_key: payload.spreadKey,
    provider: payload.provider,
    eval_mode: 'model',
    overall_score: payload.eval.scores.overall,
    safety_flag: 0,
    card_coverage: getNarrativeCoverage(payload).percentage,
    reading_prompt_version: getPromptVersion(payload),
    variant_id: payload.experiment.variantId,
    payload: JSON.stringify(payload)
  };
}

function runCalibration(records) {
  return execFileSync(process.execPath, ['scripts/evaluation/calibrateEval.js', '--no-synthetic'], {
    input: records.map((record) => JSON.stringify(record)).join('\n'),
    encoding: 'utf8'
  });
}

function assertStratified(output) {
  assert.match(output, /Found 2 reading prompt versions/);
  assert.match(output, /reading-v9:/);
  assert.match(output, /reading-v10:/);
  assert.match(output, /Found 2 variants/);
  assert.match(output, /variant-b:/);
  assert.match(output, /High card coverage but low coherence/);
}

test('calibrateEval stratifies exported schema v2 records by prompt version, variant and coverage', () => {
  const records = buildStoredPayloads().map((payload) => toEvalRecord(toEvalMetricsRow(payload)));

  assert.equal(records[0].schemaVersion, 2);
  assert.equal(records[0].readingPromptVersion, 'reading-v10');
  assert.equal(records[0].variantId, 'variant-b');
  assert.equal(records[0].cardCoverage, 1);

  assertStratified(runCalibration(records));
});

test('calibrateEval still reads raw schema v2 payloads', () => {
  assertStratified(runCalibration(buildStoredPayloads()));
});
