import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, test } from 'node:test';

import { runSyncEvaluationGate } from '../functions/lib/evaluation.js';

const FIXTURE_PATH = path.resolve(process.cwd(), 'data/evaluations/synthetic-failure-readings.json');

const HEURISTIC_GATE_ENV = {
  EVAL_ENABLED: 'false',
  EVAL_GATE_ENABLED: 'true',
  DETERMINISTIC_SAFETY_ENABLED: 'true'
};

async function loadSyntheticFailureCases() {
  const raw = await fs.readFile(FIXTURE_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed?.cases) ? parsed.cases : [];
}

function assertIncludesAll(actual = [], expected = [], messagePrefix = '') {
  for (const item of expected) {
    assert.ok(
      actual.includes(item),
      `${messagePrefix} expected "${item}" in [${actual.join(', ')}]`
    );
  }
}

describe('evaluation synthetic failure corpus', () => {
  test('covers at least 5 synthetic failures for low-end calibration', async () => {
    const cases = await loadSyntheticFailureCases();
    assert.ok(cases.length >= 5, `Expected >= 5 synthetic cases, got ${cases.length}`);
  });

  test('applies expected gate outcomes and score bounds for each synthetic failure', async () => {
    const cases = await loadSyntheticFailureCases();

    for (const sample of cases) {
      const gate = await runSyncEvaluationGate(
        HEURISTIC_GATE_ENV,
        {
          requestId: `synthetic-${sample.id}`,
          reading: sample.reading,
          userQuestion: sample.userQuestion,
          cardsInfo: sample.cardsInfo,
          spreadKey: sample.spreadKey
        },
        sample.narrativeMetrics || {}
      );

      const expected = sample.expected || {};
      const scores = gate.evalResult?.scores || {};
      const sampleLabel = `[${sample.id}]`;

      if (typeof expected.gateShouldBlock === 'boolean') {
        assert.equal(gate.gateResult?.shouldBlock, expected.gateShouldBlock, `${sampleLabel} gate mismatch`);
      }
      if (typeof expected.safetyFlag === 'boolean') {
        assert.equal(scores.safety_flag, expected.safetyFlag, `${sampleLabel} safety_flag mismatch`);
      }
      if (typeof expected.toneAtMost === 'number') {
        assert.ok(scores.tone <= expected.toneAtMost, `${sampleLabel} tone expected <= ${expected.toneAtMost}, got ${scores.tone}`);
      }
      if (typeof expected.safetyAtMost === 'number') {
        assert.ok(scores.safety <= expected.safetyAtMost, `${sampleLabel} safety expected <= ${expected.safetyAtMost}, got ${scores.safety}`);
      }
      if (typeof expected.tarotCoherenceAtMost === 'number') {
        assert.ok(
          scores.tarot_coherence <= expected.tarotCoherenceAtMost,
          `${sampleLabel} tarot_coherence expected <= ${expected.tarotCoherenceAtMost}, got ${scores.tarot_coherence}`
        );
      }

      assertIncludesAll(
        gate.evalResult?.deterministic_tone_overrides || [],
        expected.requiredToneOverrides || [],
        `${sampleLabel} deterministic_tone_overrides`
      );
      assertIncludesAll(
        gate.evalResult?.deterministic_overrides || [],
        expected.requiredDeterministicOverrides || [],
        `${sampleLabel} deterministic_overrides`
      );
      assertIncludesAll(
        gate.evalResult?.heuristic_triggers || [],
        expected.requiredHeuristicTriggers || [],
        `${sampleLabel} heuristic_triggers`
      );
    }
  });

  test('synthetic corpus exercises low-end score buckets (1-2) in key dimensions', async () => {
    const cases = await loadSyntheticFailureCases();
    const results = [];

    for (const sample of cases) {
      const gate = await runSyncEvaluationGate(
        HEURISTIC_GATE_ENV,
        {
          requestId: `synthetic-summary-${sample.id}`,
          reading: sample.reading,
          userQuestion: sample.userQuestion,
          cardsInfo: sample.cardsInfo,
          spreadKey: sample.spreadKey
        },
        sample.narrativeMetrics || {}
      );
      results.push(gate.evalResult?.scores || {});
    }

    assert.ok(results.some((scores) => Number.isFinite(scores.tarot_coherence) && scores.tarot_coherence <= 2), 'Expected at least one tarot_coherence score <= 2');
    assert.ok(results.some((scores) => Number.isFinite(scores.tone) && scores.tone <= 2), 'Expected at least one tone score <= 2');
    assert.ok(results.some((scores) => Number.isFinite(scores.safety) && scores.safety <= 2), 'Expected at least one safety score <= 2');
  });
});
