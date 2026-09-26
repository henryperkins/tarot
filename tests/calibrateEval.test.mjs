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

const MODEL_SCORES = { personalization: 4, tarot_coherence: 4, tone: 4, safety: 5, overall: 4, safety_flag: false };

function exportRecord({ scores = {}, evalFields = {}, ...fields } = {}) {
  return {
    spreadKey: 'threeCard',
    cardCount: 3,
    questionLength: 40,
    cardCoverage: 1,
    readingPromptVersion: 'reading-v10',
    ...fields,
    eval: { model: 'eval-model', promptVersion: '2.4.0', scores: { ...MODEL_SCORES, ...scores }, ...evalFields }
  };
}

test('calibrateEval scores model evaluations only and reports fallbacks, tone caps and structural caps', () => {
  const output = runCalibration([
    ...Array.from({ length: 5 }, () => exportRecord()),
    exportRecord({ scores: { tone: 3 }, evalFields: { deterministic_tone_overrides: ['hard_imperative'], tone_before_cap: 4 } }),
    // Capped before tone_before_cap was stored, when the cap also lowered overall.
    exportRecord({ scores: { tone: 3, overall: 3 }, evalFields: { deterministic_tone_overrides: ['hard_imperative'] } }),
    exportRecord({ spreadKey: 'single', cardCount: 1, scores: { tarot_coherence: 3 } }),
    exportRecord({ questionLength: 0, scores: { personalization: 3 } }),
    exportRecord({ evalFields: { promptVersion: '2.5.0' } }),
    ...Array.from({ length: 3 }, () => exportRecord({
      scores: { personalization: 3, tarot_coherence: 5, tone: 3, safety: 3, overall: 3 },
      evalFields: { mode: 'heuristic', model: 'heuristic-fallback', fallbackReason: 'eval_error_timeout' }
    }))
  ]);

  assert.match(output, /Model-scored: 10 \(76\.9%\)/);
  assert.match(output, /Heuristic fallback: 3 \(23\.1%\)/);
  assert.match(output, /Fallback reasons: eval_error_timeout×3/);
  assert.match(output, /23\.1% of evaluations fell back or failed/);
  // Heuristic safety 3s and coherence 5s stay out of the distributions.
  assert.match(output, /safety:\n {2}Mean: 5\.00, Range: \[5, 5\]/);
  assert.match(output, /tarot_coherence:\n {2}Mean: 4\.00, Range: \[4, 4\]\n {2}Distribution: 1=0 2=0 3=0 4=9 5=0\n {2}Excluded 1 single-card reading /);
  assert.match(output, /Excluded 1 no-question reading \(structurally capped\): 1=0 2=0 3=1 4=0 5=0/);
  assert.match(output, /Capped: 2 of 10 \(20\.0%\) - hard_imperative×2/);
  assert.match(output, /Tone before cap: 1=0 2=0 3=0 4=9 5=0 \(\+1 unknown\)/);
  assert.match(output, /Tone after cap: {2}1=0 2=0 3=2 4=8 5=0/);
  assert.match(output, /safety is compressed \(100\.0% of scores are 5\)/);
  assert.match(output, /Found 2 evaluator versions/);
  assert.match(output, /2\.5\.0 \(eval-model\): n=1/);
});

test('toEvalRecord exports card count and question length but not the question', () => {
  const row = {
    request_id: 'req-question',
    created_at: '2026-09-20 12:00:00',
    spread_key: 'single',
    provider: 'openai',
    eval_mode: 'model',
    overall_score: 4,
    safety_flag: 0,
    card_coverage: 1,
    reading_prompt_version: 'reading-v10',
    variant_id: null
  };

  const redacted = toEvalRecord({
    ...row,
    payload: JSON.stringify({
      schemaVersion: 2,
      userQuestion: '  What should I carry into spring?  ',
      cardsInfo: [{ position: 'Card 1', card: 'The Star', orientation: 'upright' }],
      eval: { scores: { overall: 4 } }
    })
  });
  assert.equal(redacted.cardCount, 1);
  assert.equal(redacted.questionLength, 'What should I carry into spring?'.length);
  assert.ok(!JSON.stringify(redacted).includes('carry into spring'));

  // METRICS_STORAGE_MODE=minimal stores only the lengths.
  const minimal = toEvalRecord({
    ...row,
    payload: JSON.stringify({ schemaVersion: 2, questionLength: 0, cardCount: 3, eval: { scores: { overall: 4 } } })
  });
  assert.equal(minimal.cardCount, 3);
  assert.equal(minimal.questionLength, 0);
});
