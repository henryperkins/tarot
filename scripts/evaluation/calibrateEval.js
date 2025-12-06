#!/usr/bin/env node
/**
 * Analyze evaluation scores and suggest calibration adjustments
 *
 * Usage: cat eval-data.jsonl | node scripts/evaluation/calibrateEval.js
 */

import * as readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin });
const records = [];

rl.on('line', (line) => {
  try {
    records.push(JSON.parse(line));
  } catch (e) {
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
    .filter((r) => r.eval?.scores?.tarot_coherence != null && r.cardCoverage != null)
    .map((r) => ({
      coherence: r.eval.scores.tarot_coherence,
      coverage: r.cardCoverage
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
});
