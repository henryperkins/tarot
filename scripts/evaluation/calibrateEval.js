#!/usr/bin/env node
/**
 * Analyze evaluation scores and suggest calibration adjustments
 *
 * Usage: cat eval-data.jsonl | node scripts/evaluation/calibrateEval.js
 */

import * as readline from 'node:readline';

// Helper to get prompt version from both v1 and v2 schema payloads
function getPromptVersion(payload) {
  if (!payload) return null;
  if (payload.schemaVersion >= 2) {
    return payload.experiment?.promptVersion;
  }
  return payload.readingPromptVersion ||
    payload.promptMeta?.readingPromptVersion ||
    null;
}

// Helper to get card coverage from both v1 and v2 schema payloads
function getCardCoverage(payload) {
  if (!payload) return null;
  if (payload.schemaVersion >= 2) {
    return payload.narrative?.coverage?.percentage;
  }
  return payload.cardCoverage ??
    payload.narrative?.cardCoverage ??
    null;
}

// Helper to get variant ID from both v1 and v2 schema payloads
function getVariantId(payload) {
  if (!payload) return null;
  if (payload.schemaVersion >= 2) {
    return payload.experiment?.variantId;
  }
  return payload.variantId || null;
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

rl.on('close', () => {
  if (records.length === 0) {
    console.log('No records to analyze');
    return;
  }

  const dims = ['personalization', 'tarot_coherence', 'tone', 'safety', 'overall'];
  const distributions = {};

  dims.forEach((dim) => {
    const values = records
      .filter((r) => r.eval?.scores?.[dim] != null)
      .map((r) => r.eval.scores[dim]);

    if (values.length === 0) return;

    distributions[dim] = {
      count: values.length,
      mean: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
      min: Math.min(...values),
      max: Math.max(...values),
      distribution: {
        1: values.filter((v) => v === 1).length,
        2: values.filter((v) => v === 2).length,
        3: values.filter((v) => v === 3).length,
        4: values.filter((v) => v === 4).length,
        5: values.filter((v) => v === 5).length
      }
    };
  });

  const safetyFlags = records.filter((r) => r.eval?.scores?.safety_flag === true);

  const coherenceVsCoverage = records
    .filter((r) => r.eval?.scores?.tarot_coherence != null && getCardCoverage(r) != null)
    .map((r) => ({
      coherence: r.eval.scores.tarot_coherence,
      coverage: getCardCoverage(r)
    }));

  console.log('=== Evaluation Score Analysis ===\n');
  console.log(`Total records: ${records.length}`);
  console.log(`With eval scores: ${records.filter((r) => r.eval?.scores).length}`);
  console.log(`With errors: ${records.filter((r) => r.eval?.error).length}\n`);

  console.log('=== Score Distributions ===\n');
  dims.forEach((dim) => {
    if (!distributions[dim]) return;
    const d = distributions[dim];
    console.log(`${dim}:`);
    console.log(`  Mean: ${d.mean}, Range: [${d.min}, ${d.max}]`);
    console.log(`  Distribution: 1=${d.distribution[1]} 2=${d.distribution[2]} 3=${d.distribution[3]} 4=${d.distribution[4]} 5=${d.distribution[5]}`);
    console.log('');
  });

  console.log('=== Safety Analysis ===\n');
  console.log(`Safety flags triggered: ${safetyFlags.length} (${((safetyFlags.length / records.length) * 100).toFixed(1)}%)`);

  if (safetyFlags.length > 0) {
    console.log('Sample flagged readings:');
    safetyFlags.slice(0, 3).forEach((r) => {
      console.log(`  - ${r.requestId}: ${r.eval.scores.notes || 'no notes'}`);
    });
  }

  console.log('\n=== Calibration Suggestions ===\n');

  if (distributions.overall?.mean > 4.5) {
    console.log('WARNING: Scores may be inflated (overall mean > 4.5)');
    console.log('  Consider: Adjusting prompt rubric to be more critical\n');
  }

  if (distributions.overall?.distribution[3] > records.length * 0.6) {
    console.log('WARNING: Scores compressed around 3 (>60% at score 3)');
    console.log('  Consider: Adding more specific scoring criteria\n');
  }

  if (coherenceVsCoverage.length > 10) {
    const highCovLowScore = coherenceVsCoverage.filter(
      (r) => r.coverage > 0.8 && r.coherence < 3
    ).length;
    if (highCovLowScore > coherenceVsCoverage.length * 0.1) {
      console.log('WARNING: High card coverage but low coherence scores (>10%)');
      console.log('  Consider: Reviewing coherence scoring criteria\n');
    }
  }

  // === Version-Stratified Analysis ===
  console.log('\n=== Version Analysis ===\n');

  // Group by reading prompt version
  const versionGroups = {};
  records.forEach((r) => {
    const version = getPromptVersion(r) || 'unknown';
    if (!versionGroups[version]) {
      versionGroups[version] = [];
    }
    versionGroups[version].push(r);
  });

  const versionCount = Object.keys(versionGroups).length;
  if (versionCount > 1) {
    console.log(`Found ${versionCount} reading prompt versions:\n`);

    Object.entries(versionGroups)
      .sort((a, b) => b[1].length - a[1].length) // Sort by count descending
      .forEach(([version, recs]) => {
        const withScores = recs.filter((r) => r.eval?.scores?.overall != null);
        if (withScores.length === 0) {
          console.log(`  ${version}: n=${recs.length}, no eval scores`);
          return;
        }

        const mean = withScores.reduce((a, r) => a + r.eval.scores.overall, 0) / withScores.length;
        const safetyCount = recs.filter((r) => r.eval?.scores?.safety_flag).length;
        const safetyRate = ((safetyCount / recs.length) * 100).toFixed(1);

        console.log(`  ${version}:`);
        console.log(`    Readings: ${recs.length}, Evaluated: ${withScores.length}`);
        console.log(`    Mean overall: ${mean.toFixed(2)}, Safety flags: ${safetyCount} (${safetyRate}%)`);
      });
  } else {
    console.log('Single version detected (or no version tracking)');
    const version = Object.keys(versionGroups)[0] || 'unknown';
    console.log(`  Version: ${version}`);
  }

  // === A/B Testing Analysis ===
  console.log('\n=== A/B Testing Analysis ===\n');

  // Group by variant
  const variantGroups = {};
  records.forEach((r) => {
    const variant = getVariantId(r) || 'control';
    if (!variantGroups[variant]) {
      variantGroups[variant] = [];
    }
    variantGroups[variant].push(r);
  });

  const variantCount = Object.keys(variantGroups).length;
  if (variantCount > 1) {
    console.log(`Found ${variantCount} variants:\n`);

    Object.entries(variantGroups)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([variant, recs]) => {
        const withScores = recs.filter((r) => r.eval?.scores?.overall != null);
        if (withScores.length === 0) {
          console.log(`  ${variant}: n=${recs.length}, no eval scores`);
          return;
        }

        const mean = withScores.reduce((a, r) => a + r.eval.scores.overall, 0) / withScores.length;
        const toneScores = withScores.filter((r) => r.eval?.scores?.tone != null);
        const meanTone = toneScores.length > 0
          ? toneScores.reduce((a, r) => a + r.eval.scores.tone, 0) / toneScores.length
          : null;

        console.log(`  ${variant}:`);
        console.log(`    Readings: ${recs.length}, Evaluated: ${withScores.length}`);
        console.log(`    Mean overall: ${mean.toFixed(2)}${meanTone ? `, Mean tone: ${meanTone.toFixed(2)}` : ''}`);
      });

    // Statistical comparison hint
    if (variantCount === 2) {
      const variants = Object.keys(variantGroups);
      const group1 = variantGroups[variants[0]].filter((r) => r.eval?.scores?.overall != null);
      const group2 = variantGroups[variants[1]].filter((r) => r.eval?.scores?.overall != null);

      if (group1.length >= 10 && group2.length >= 10) {
        const mean1 = group1.reduce((a, r) => a + r.eval.scores.overall, 0) / group1.length;
        const mean2 = group2.reduce((a, r) => a + r.eval.scores.overall, 0) / group2.length;
        const diff = Math.abs(mean1 - mean2);

        console.log('\n  Comparison:');
        console.log(`    Δ overall: ${diff.toFixed(2)} (${variants[0]} vs ${variants[1]})`);
        if (diff >= 0.3) {
          console.log('    ⚠️  Significant difference detected (Δ ≥ 0.3)');
        } else if (diff >= 0.15) {
          console.log('    📊 Moderate difference (0.15 ≤ Δ < 0.3) - may need more data');
        } else {
          console.log('    ✓ Small difference (Δ < 0.15) - variants performing similarly');
        }
      }
    }
  } else {
    console.log('No A/B testing variants detected (all readings in control)');
  }

  // === Spread Analysis ===
  console.log('\n=== Spread Analysis ===\n');

  const spreadGroups = {};
  records.forEach((r) => {
    const spread = r.spreadKey || 'unknown';
    if (!spreadGroups[spread]) {
      spreadGroups[spread] = [];
    }
    spreadGroups[spread].push(r);
  });

  Object.entries(spreadGroups)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([spread, recs]) => {
      const withScores = recs.filter((r) => r.eval?.scores?.overall != null);
      if (withScores.length === 0) {
        console.log(`  ${spread}: n=${recs.length}, no eval scores`);
        return;
      }

      const mean = withScores.reduce((a, r) => a + r.eval.scores.overall, 0) / withScores.length;
      console.log(`  ${spread}: n=${recs.length}, mean_overall=${mean.toFixed(2)}`);
    });
});
