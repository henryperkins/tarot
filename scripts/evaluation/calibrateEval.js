#!/usr/bin/env node
/**
 * Analyze evaluation scores and suggest calibration adjustments
 *
 * Usage: cat eval-data.jsonl | node scripts/evaluation/calibrateEval.js [--synthetic data/evaluations/synthetic-failure-readings.json]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import * as readline from 'node:readline';
import { runSyncEvaluationGate } from '../../functions/lib/evaluation.js';

const DEFAULT_SYNTHETIC_FIXTURE = 'data/evaluations/synthetic-failure-readings.json';
const DIMENSIONS = ['personalization', 'tarot_coherence', 'tone', 'safety', 'overall'];
// Shadow-mode success criterion from docs/evaluation-system.md.
const MAX_FALLBACK_RATE = 0.05;
const COMPRESSION_SHARE = 0.6;
const MIN_COMPRESSION_SAMPLE = 5;

function printUsage() {
  console.log('Usage: cat eval-data.jsonl | node scripts/evaluation/calibrateEval.js [options]');
  console.log('');
  console.log('Options:');
  console.log(`  --synthetic <path>     Synthetic failure fixture path (default: ${DEFAULT_SYNTHETIC_FIXTURE})`);
  console.log('  --no-synthetic         Skip synthetic calibration pass');
  console.log('  --strict-synthetic     Exit non-zero when synthetic cases fail');
  console.log('  --help, -h             Show this help');
}

function parseArgs(argv) {
  const options = {
    synthetic: true,
    syntheticPath: DEFAULT_SYNTHETIC_FIXTURE,
    strictSynthetic: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--no-synthetic') {
      options.synthetic = false;
    } else if (arg === '--strict-synthetic') {
      options.strictSynthetic = true;
    } else if (arg === '--synthetic') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --synthetic');
      }
      options.syntheticPath = value;
      i += 1;
    }
  }

  return options;
}

// exportEvalData.js records carry readingPromptVersion, cardCoverage, variantId,
// cardCount and questionLength at the top level for every schema version, so the
// helpers below check those first and fall back to raw v1/v2 payload paths.

// Helper to get prompt version from export records and v1/v2 schema payloads
function getPromptVersion(payload) {
  if (!payload) return null;
  if (payload.readingPromptVersion) {
    return payload.readingPromptVersion;
  }
  if (payload.schemaVersion >= 2) {
    return payload.experiment?.promptVersion || null;
  }
  return payload.promptMeta?.readingPromptVersion || null;
}

// Helper to get card coverage from export records and v1/v2 schema payloads
function getCardCoverage(payload) {
  if (!payload) return null;
  if (payload.cardCoverage != null) {
    return payload.cardCoverage;
  }
  if (payload.schemaVersion >= 2) {
    return payload.narrative?.coverage?.percentage ?? null;
  }
  return payload.narrative?.cardCoverage ?? null;
}

// Helper to get variant ID from export records and v1/v2 schema payloads
function getVariantId(payload) {
  if (!payload) return null;
  if (payload.variantId) {
    return payload.variantId;
  }
  if (payload.schemaVersion >= 2) {
    return payload.experiment?.variantId || null;
  }
  return null;
}

// Helper to get the drawn card count from export records and stored payloads
function getCardCount(payload) {
  if (!payload) return null;
  if (Number.isFinite(payload.cardCount) && payload.cardCount > 0) {
    return payload.cardCount;
  }
  if (Array.isArray(payload.cardsInfo) && payload.cardsInfo.length > 0) {
    return payload.cardsInfo.length;
  }
  const narrativeCount = payload.narrative?.coverage?.cardCount ?? payload.narrative?.cardCount;
  return Number.isFinite(narrativeCount) && narrativeCount > 0 ? narrativeCount : null;
}

// Helper to get the question length from export records and stored payloads
function getQuestionLength(payload) {
  if (!payload) return null;
  if (Number.isFinite(payload.questionLength)) {
    return payload.questionLength;
  }
  if (typeof payload.userQuestion === 'string') {
    return payload.userQuestion.trim().length;
  }
  return null;
}

// Only model scores measure the rubric: heuristic fallbacks hard-code
// personalization, tone and safety at 3 and derive coherence from card coverage.
function getEvalMode(record) {
  const evalData = record?.eval;
  if (!evalData) return 'none';
  if (evalData.mode === 'heuristic') return 'heuristic';
  if (evalData.mode === 'error' || evalData.error) return 'error';
  return evalData.scores ? 'model' : 'none';
}

// A single card cannot make the cross-card link a coherence 4 requires, and a
// reading without a question cannot reuse its phrasing, so those scores are set
// by structure rather than quality.
function isStructurallyCapped(record, dim) {
  if (dim === 'tarot_coherence') {
    return record.spreadKey === 'single' || getCardCount(record) === 1;
  }
  if (dim === 'personalization') {
    return getQuestionLength(record) === 0;
  }
  return false;
}

const STRUCTURAL_CAP_LABELS = {
  tarot_coherence: 'single-card',
  personalization: 'no-question'
};

function dimensionValues(records, dim) {
  return records
    .filter((r) => r.eval?.scores?.[dim] != null && !isStructurallyCapped(r, dim))
    .map((r) => r.eval.scores[dim]);
}

function histogram(values) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  values.forEach((value) => {
    if (counts[value] !== undefined) counts[value] += 1;
  });
  return counts;
}

function formatHistogram(counts) {
  return [1, 2, 3, 4, 5].map((score) => `${score}=${counts[score]}`).join(' ');
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percent(count, total) {
  return total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
}

function tally(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => `${value}×${count}`)
    .join(', ');
}

function groupBy(records, keyFn) {
  const groups = {};
  records.forEach((r) => {
    const key = keyFn(r);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(r);
  });
  return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
}

function missingExpectedItems(actual = [], expected = []) {
  return expected.filter((item) => !actual.includes(item));
}

function validateSyntheticCase(caseDef, gateResult) {
  const expected = caseDef?.expected || {};
  const scores = gateResult?.evalResult?.scores || {};
  const errors = [];

  if (typeof expected.gateShouldBlock === 'boolean' && gateResult?.gateResult?.shouldBlock !== expected.gateShouldBlock) {
    errors.push(`gate_should_block expected ${expected.gateShouldBlock}, got ${gateResult?.gateResult?.shouldBlock}`);
  }
  if (typeof expected.safetyFlag === 'boolean' && scores.safety_flag !== expected.safetyFlag) {
    errors.push(`safety_flag expected ${expected.safetyFlag}, got ${scores.safety_flag}`);
  }
  if (typeof expected.toneAtMost === 'number' && !(scores.tone <= expected.toneAtMost)) {
    errors.push(`tone expected <= ${expected.toneAtMost}, got ${scores.tone}`);
  }
  if (typeof expected.safetyAtMost === 'number' && !(scores.safety <= expected.safetyAtMost)) {
    errors.push(`safety expected <= ${expected.safetyAtMost}, got ${scores.safety}`);
  }
  if (typeof expected.tarotCoherenceAtMost === 'number' && !(scores.tarot_coherence <= expected.tarotCoherenceAtMost)) {
    errors.push(`tarot_coherence expected <= ${expected.tarotCoherenceAtMost}, got ${scores.tarot_coherence}`);
  }

  const missingToneOverrides = missingExpectedItems(
    gateResult?.evalResult?.deterministic_tone_overrides || [],
    expected.requiredToneOverrides || []
  );
  if (missingToneOverrides.length > 0) {
    errors.push(`missing deterministic_tone_overrides: ${missingToneOverrides.join(', ')}`);
  }

  const missingDeterministicOverrides = missingExpectedItems(
    gateResult?.evalResult?.deterministic_overrides || [],
    expected.requiredDeterministicOverrides || []
  );
  if (missingDeterministicOverrides.length > 0) {
    errors.push(`missing deterministic_overrides: ${missingDeterministicOverrides.join(', ')}`);
  }

  const missingHeuristicTriggers = missingExpectedItems(
    gateResult?.evalResult?.heuristic_triggers || [],
    expected.requiredHeuristicTriggers || []
  );
  if (missingHeuristicTriggers.length > 0) {
    errors.push(`missing heuristic_triggers: ${missingHeuristicTriggers.join(', ')}`);
  }

  return errors;
}

async function runSyntheticCalibration(options) {
  if (!options.synthetic) {
    return null;
  }

  const fixturePath = path.resolve(process.cwd(), options.syntheticPath);
  let payload;

  try {
    const raw = await fs.readFile(fixturePath, 'utf-8');
    payload = JSON.parse(raw);
  } catch (error) {
    console.log('\n=== Synthetic Failure Calibration ===\n');
    console.log(`Could not load synthetic fixture: ${fixturePath}`);
    console.log(`Reason: ${error.message}`);
    if (options.strictSynthetic) {
      process.exitCode = 1;
    }
    return null;
  }

  const cases = Array.isArray(payload?.cases) ? payload.cases : [];
  console.log('\n=== Synthetic Failure Calibration ===\n');
  console.log(`Fixture: ${path.relative(process.cwd(), fixturePath)}`);
  console.log(`Synthetic cases: ${cases.length}`);
  console.log('Runs with EVAL_ENABLED=false, so it checks the heuristic and deterministic layers, not the model evaluator.');

  if (cases.length === 0) {
    console.log('No synthetic cases found.');
    if (options.strictSynthetic) {
      process.exitCode = 1;
    }
    return { total: 0, passed: 0, failed: 0 };
  }

  const env = {
    EVAL_ENABLED: 'false',
    EVAL_GATE_ENABLED: 'true',
    DETERMINISTIC_SAFETY_ENABLED: 'true'
  };

  const results = [];
  for (const caseDef of cases) {
    const gateResult = await runSyncEvaluationGate(
      env,
      {
        requestId: `calibration-${caseDef.id}`,
        reading: caseDef.reading,
        userQuestion: caseDef.userQuestion,
        cardsInfo: caseDef.cardsInfo,
        spreadKey: caseDef.spreadKey
      },
      caseDef.narrativeMetrics || {}
    );

    const errors = validateSyntheticCase(caseDef, gateResult);
    results.push({
      id: caseDef.id,
      pass: errors.length === 0,
      errors,
      scores: gateResult?.evalResult?.scores || {}
    });
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log(`Passed: ${passed}/${results.length} (${((passed / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed}`);

  const toneLowEnd = results.some((r) => Number.isFinite(r.scores.tone) && r.scores.tone <= 2);
  const safetyLowEnd = results.some((r) => Number.isFinite(r.scores.safety) && r.scores.safety <= 2);
  const coherenceLowEnd = results.some((r) => Number.isFinite(r.scores.tarot_coherence) && r.scores.tarot_coherence <= 2);
  console.log(`Low-end coverage: tone<=2=${toneLowEnd ? 'yes' : 'no'}, safety<=2=${safetyLowEnd ? 'yes' : 'no'}, tarot_coherence<=2=${coherenceLowEnd ? 'yes' : 'no'}`);

  if (failed > 0) {
    console.log('\nFailed synthetic cases:');
    results
      .filter((r) => !r.pass)
      .slice(0, 10)
      .forEach((entry) => {
        console.log(`  - ${entry.id}: ${entry.errors.join('; ')}`);
      });
  }

  if (options.strictSynthetic && failed > 0) {
    process.exitCode = 1;
  }

  return { total: results.length, passed, failed };
}

function printModeSummary(records) {
  const counts = { model: 0, heuristic: 0, error: 0, none: 0 };
  const fallbackReasons = [];
  records.forEach((r) => {
    const mode = getEvalMode(r);
    counts[mode] += 1;
    if (mode === 'heuristic' || mode === 'error') {
      fallbackReasons.push(r.eval?.fallbackReason || r.eval?.error || 'unknown');
    }
  });

  console.log('=== Evaluation Score Analysis ===\n');
  console.log(`Total records: ${records.length}`);
  console.log(`Model-scored: ${counts.model} (${percent(counts.model, records.length)}%)`);
  console.log(`Heuristic fallback: ${counts.heuristic} (${percent(counts.heuristic, records.length)}%)`);
  console.log(`Errors: ${counts.error}`);
  console.log(`No evaluation: ${counts.none}`);
  if (fallbackReasons.length > 0) {
    console.log(`Fallback reasons: ${tally(fallbackReasons)}`);
  }
  console.log('\nDistributions and suggestions below use model-scored records only.\n');

  return counts;
}

function computeDistributions(modelRecords) {
  const distributions = {};

  DIMENSIONS.forEach((dim) => {
    const values = dimensionValues(modelRecords, dim);
    const capped = modelRecords
      .filter((r) => r.eval?.scores?.[dim] != null && isStructurallyCapped(r, dim))
      .map((r) => r.eval.scores[dim]);
    if (values.length === 0 && capped.length === 0) return;

    distributions[dim] = {
      count: values.length,
      mean: values.length > 0 ? mean(values) : null,
      min: values.length > 0 ? Math.min(...values) : null,
      max: values.length > 0 ? Math.max(...values) : null,
      distribution: histogram(values),
      capped
    };
  });

  return distributions;
}

function printDistributions(distributions) {
  console.log('=== Score Distributions ===\n');
  DIMENSIONS.forEach((dim) => {
    const d = distributions[dim];
    if (!d) return;
    console.log(`${dim}:`);
    if (d.count > 0) {
      console.log(`  Mean: ${d.mean.toFixed(2)}, Range: [${d.min}, ${d.max}]`);
      console.log(`  Distribution: ${formatHistogram(d.distribution)}`);
    }
    if (d.capped.length > 0) {
      const noun = d.capped.length === 1 ? 'reading' : 'readings';
      console.log(`  Excluded ${d.capped.length} ${STRUCTURAL_CAP_LABELS[dim]} ${noun} (structurally capped): ${formatHistogram(histogram(d.capped))}`);
    }
    console.log('');
  });
}

function printToneCap(modelRecords) {
  const toneRecords = modelRecords.filter((r) => r.eval?.scores?.tone != null);
  const capped = toneRecords.filter((r) => (r.eval.deterministic_tone_overrides || []).length > 0);

  console.log('=== Deterministic Tone Cap ===\n');
  if (capped.length === 0) {
    console.log(`No model-scored tone was capped (${toneRecords.length} records)`);
    return;
  }

  const before = toneRecords
    .map((r) => (capped.includes(r) ? r.eval.tone_before_cap : r.eval.scores.tone))
    .filter(Number.isFinite);
  const legacyCapped = capped.filter((r) => !Number.isFinite(r.eval.tone_before_cap)).length;

  console.log(`Capped: ${capped.length} of ${toneRecords.length} (${percent(capped.length, toneRecords.length)}%) - ${tally(capped.flatMap((r) => r.eval.deterministic_tone_overrides))}`);
  console.log(`Tone before cap: ${formatHistogram(histogram(before))}${legacyCapped > 0 ? ` (+${legacyCapped} unknown)` : ''}`);
  console.log(`Tone after cap:  ${formatHistogram(histogram(toneRecords.map((r) => r.eval.scores.tone)))}`);
  if (legacyCapped > 0) {
    console.log(`  ${legacyCapped} capped record(s) predate tone_before_cap; the cap also lowered their overall score.`);
  }
}

function printSafety(records) {
  const safetyFlags = records.filter((r) => r.eval?.scores?.safety_flag === true);

  console.log('\n=== Safety Analysis ===\n');
  console.log(`Safety flags triggered: ${safetyFlags.length} (${percent(safetyFlags.length, records.length)}%)${safetyFlags.length > 0 ? ` - ${tally(safetyFlags.map(getEvalMode))}` : ''}`);

  if (safetyFlags.length > 0) {
    console.log('Sample flagged readings:');
    safetyFlags.slice(0, 3).forEach((r) => {
      console.log(`  - ${r.requestId}: ${r.eval.scores.notes || 'no notes'}`);
    });
  }
}

function printSuggestions(records, modeCounts, distributions, modelRecords) {
  console.log('\n=== Calibration Suggestions ===\n');

  const fallbackCount = modeCounts.heuristic + modeCounts.error;
  if (records.length > 0 && fallbackCount / records.length > MAX_FALLBACK_RATE) {
    console.log(`WARNING: ${percent(fallbackCount, records.length)}% of evaluations fell back or failed (target < ${MAX_FALLBACK_RATE * 100}%)`);
    console.log('  Consider: comparing eval latency with EVAL_TIMEOUT_MS and EVAL_GATE_TIMEOUT_MS\n');
  }

  if (distributions.overall?.mean > 4.5) {
    console.log('WARNING: Scores may be inflated (overall mean > 4.5)');
    console.log('  Consider: Adjusting prompt rubric to be more critical\n');
  }

  DIMENSIONS.forEach((dim) => {
    const d = distributions[dim];
    if (!d || d.count < MIN_COMPRESSION_SAMPLE) return;
    const [topScore, topCount] = Object.entries(d.distribution).sort((a, b) => b[1] - a[1])[0];
    if (topCount / d.count > COMPRESSION_SHARE) {
      console.log(`WARNING: ${dim} is compressed (${percent(topCount, d.count)}% of scores are ${topScore})`);
      console.log('  Consider: Adding more specific scoring criteria\n');
    }
  });

  const lowEndDims = ['personalization', 'tarot_coherence', 'tone', 'safety'];
  lowEndDims.forEach((dim) => {
    const d = distributions[dim];
    if (!d || d.count === 0) return;
    const lowEndCount = d.distribution[1] + d.distribution[2];
    if (lowEndCount === 0) {
      console.log(`WARNING: ${dim} has no scores in 1-2 range`);
      console.log('  Consider: validating with synthetic failures and reviewing rubric anchors\n');
    }
  });

  const coherenceVsCoverage = modelRecords
    .filter((r) => r.eval?.scores?.tarot_coherence != null && getCardCoverage(r) != null && !isStructurallyCapped(r, 'tarot_coherence'))
    .map((r) => ({
      coherence: r.eval.scores.tarot_coherence,
      coverage: getCardCoverage(r)
    }));

  if (coherenceVsCoverage.length > 10) {
    const highCovLowScore = coherenceVsCoverage.filter(
      (r) => r.coverage > 0.8 && r.coherence < 3
    ).length;
    if (highCovLowScore > coherenceVsCoverage.length * 0.1) {
      console.log('WARNING: High card coverage but low coherence scores (>10%)');
      console.log('  Consider: Reviewing coherence scoring criteria\n');
    }
  }
}

function printEvaluatorVersions(modelRecords) {
  console.log('\n=== Evaluator Version Analysis ===\n');

  const groups = groupBy(modelRecords, (r) => `${r.eval?.promptVersion || 'unknown'} (${r.eval?.model || 'unknown model'})`);
  if (groups.length <= 1) {
    console.log('Single evaluator version detected');
    console.log(`  Eval prompt version: ${groups[0]?.[0] || 'unknown'}`);
    return;
  }

  console.log(`Found ${groups.length} evaluator versions:\n`);
  groups.forEach(([version, recs]) => {
    const means = DIMENSIONS.map((dim) => {
      const values = dimensionValues(recs, dim);
      return `${dim}=${values.length > 0 ? mean(values).toFixed(2) : '-'}`;
    });
    console.log(`  ${version}: n=${recs.length}`);
    console.log(`    ${means.join(' ')}`);
  });
}

function modelOverallScores(records) {
  return records.filter((r) => getEvalMode(r) === 'model' && r.eval?.scores?.overall != null);
}

function printReadingPromptVersions(records) {
  console.log('\n=== Reading Prompt Version Analysis ===\n');

  const groups = groupBy(records, (r) => getPromptVersion(r) || 'unknown');
  if (groups.length > 1) {
    console.log(`Found ${groups.length} reading prompt versions:\n`);

    groups.forEach(([version, recs]) => {
      const withScores = modelOverallScores(recs);
      if (withScores.length === 0) {
        console.log(`  ${version}: n=${recs.length}, no model scores`);
        return;
      }

      const overallMean = mean(withScores.map((r) => r.eval.scores.overall));
      const safetyCount = recs.filter((r) => r.eval?.scores?.safety_flag).length;

      console.log(`  ${version}:`);
      console.log(`    Readings: ${recs.length}, Model-scored: ${withScores.length}`);
      console.log(`    Mean overall: ${overallMean.toFixed(2)}, Safety flags: ${safetyCount} (${percent(safetyCount, recs.length)}%)`);
    });
  } else {
    console.log('Single reading prompt version detected (or no version tracking)');
    console.log(`  Reading prompt version: ${groups[0]?.[0] || 'unknown'}`);
  }
}

function printVariants(records) {
  console.log('\n=== A/B Testing Analysis ===\n');

  const groups = groupBy(records, (r) => getVariantId(r) || 'control');
  if (groups.length <= 1) {
    console.log('No A/B testing variants detected (all readings in control)');
    return;
  }

  console.log(`Found ${groups.length} variants:\n`);

  groups.forEach(([variant, recs]) => {
    const withScores = modelOverallScores(recs);
    if (withScores.length === 0) {
      console.log(`  ${variant}: n=${recs.length}, no model scores`);
      return;
    }

    const overallMean = mean(withScores.map((r) => r.eval.scores.overall));
    const toneScores = withScores.filter((r) => r.eval?.scores?.tone != null);
    const meanTone = toneScores.length > 0
      ? mean(toneScores.map((r) => r.eval.scores.tone))
      : null;

    console.log(`  ${variant}:`);
    console.log(`    Readings: ${recs.length}, Model-scored: ${withScores.length}`);
    console.log(`    Mean overall: ${overallMean.toFixed(2)}${meanTone ? `, Mean tone: ${meanTone.toFixed(2)}` : ''}`);
  });

  // Statistical comparison hint
  if (groups.length === 2) {
    const [[name1, recs1], [name2, recs2]] = groups;
    const group1 = modelOverallScores(recs1);
    const group2 = modelOverallScores(recs2);

    if (group1.length >= 10 && group2.length >= 10) {
      const mean1 = mean(group1.map((r) => r.eval.scores.overall));
      const mean2 = mean(group2.map((r) => r.eval.scores.overall));
      const diff = Math.abs(mean1 - mean2);

      console.log('\n  Comparison:');
      console.log(`    Δ overall: ${diff.toFixed(2)} (${name1} vs ${name2})`);
      if (diff >= 0.3) {
        console.log('    ⚠️  Significant difference detected (Δ ≥ 0.3)');
      } else if (diff >= 0.15) {
        console.log('    📊 Moderate difference (0.15 ≤ Δ < 0.3) - may need more data');
      } else {
        console.log('    ✓ Small difference (Δ < 0.15) - variants performing similarly');
      }
    }
  }
}

function printSpreads(records) {
  console.log('\n=== Spread Analysis ===\n');

  groupBy(records, (r) => r.spreadKey || 'unknown').forEach(([spread, recs]) => {
    const withScores = modelOverallScores(recs);
    if (withScores.length === 0) {
      console.log(`  ${spread}: n=${recs.length}, no model scores`);
      return;
    }

    const overallMean = mean(withScores.map((r) => r.eval.scores.overall));
    console.log(`  ${spread}: n=${recs.length}, model-scored=${withScores.length}, mean_overall=${overallMean.toFixed(2)}`);
  });
}

function runPrimaryCalibration(records) {
  if (records.length === 0) {
    console.log('No records to analyze');
    return;
  }

  const modeCounts = printModeSummary(records);
  const modelRecords = records.filter((r) => getEvalMode(r) === 'model');
  const distributions = computeDistributions(modelRecords);

  printDistributions(distributions);
  printToneCap(modelRecords);
  printSafety(records);
  printSuggestions(records, modeCounts, distributions, modelRecords);
  printEvaluatorVersions(modelRecords);
  printReadingPromptVersions(records);
  printVariants(records);
  printSpreads(records);
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printUsage();
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin });
const records = [];

rl.on('line', (line) => {
  try {
    records.push(JSON.parse(line));
  } catch (_e) {
    // Skip invalid lines
  }
});

rl.on('close', async () => {
  try {
    runPrimaryCalibration(records);
    await runSyntheticCalibration(options);
  } catch (error) {
    console.error(`Calibration failed: ${error.message}`);
    process.exitCode = 1;
  }
});
