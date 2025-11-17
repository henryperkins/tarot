#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_FILE = 'data/evaluations/narrative-metrics.json';
const MIN_SPINE_RATE = parseFloat(process.env.NARRATIVE_MIN_SPINE_PASS_RATE || '0.9');
const MIN_CARD_COVERAGE = parseFloat(process.env.NARRATIVE_MIN_CARD_COVERAGE || '0.9');
const MAX_DETERMINISTIC = parseInt(process.env.NARRATIVE_MAX_DETERMINISTIC_ISSUES || '0', 10);
const MAX_MISSING_AGENCY = parseInt(process.env.NARRATIVE_MAX_MISSING_AGENCY || '0', 10);
const MAX_FLAGGED = parseInt(process.env.NARRATIVE_MAX_FLAGGED_SAMPLES || '0', 10);
const MAX_HALLUCINATIONS = parseInt(process.env.NARRATIVE_MAX_HALLUCINATIONS || '0', 10);
const MAX_HARSH_TONE = parseInt(process.env.NARRATIVE_MAX_HARSH_TONE || '0', 10);
const MAX_MISSING_SUPPORTIVE = parseInt(process.env.NARRATIVE_MAX_MISSING_SUPPORTIVE || '0', 10);
const MIN_RUBRIC_ACCURACY = parseFloat(process.env.NARRATIVE_MIN_RUBRIC_ACCURACY || '0.85');
const MIN_RUBRIC_COHERENCE = parseFloat(process.env.NARRATIVE_MIN_RUBRIC_COHERENCE || '0.85');
const MIN_RUBRIC_AGENCY = parseFloat(process.env.NARRATIVE_MIN_RUBRIC_AGENCY || '0.8');
const MIN_RUBRIC_COMPASSION = parseFloat(process.env.NARRATIVE_MIN_RUBRIC_COMPASSION || '0.85');

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

async function main() {
  const metricsPath = path.resolve(process.cwd(), process.argv[2] || DEFAULT_FILE);
  let metrics;
  try {
    metrics = JSON.parse(await fs.readFile(metricsPath, 'utf-8'));
  } catch (err) {
    console.error(`Unable to read ${metricsPath}. Run 'npm run eval:narrative' first.`);
    throw err;
  }

  const failures = [];
  const spineRate = metrics?.spinePassRate ?? 0;
  const coverage = metrics?.avgCardCoverage ?? 0;
  const deterministicIssues = metrics?.deterministicLanguageCount ?? 0;
  const agencyIssues = metrics?.missingAgencyCount ?? 0;
  const flagged = metrics?.flaggedSampleCount ?? 0;
  const hallucinations = metrics?.hallucinationCount ?? 0;
  const harshTone = metrics?.harshToneCount ?? 0;
  const missingSupportive = metrics?.missingSupportiveToneCount ?? 0;
  const rubric = metrics?.avgRubricScores || {};

  if (spineRate < MIN_SPINE_RATE) {
    failures.push(`Story spine pass rate ${pct(spineRate)} < minimum ${pct(MIN_SPINE_RATE)}`);
  }
  if (coverage < MIN_CARD_COVERAGE) {
    failures.push(`Average card coverage ${pct(coverage)} < minimum ${pct(MIN_CARD_COVERAGE)}`);
  }
  if (deterministicIssues > MAX_DETERMINISTIC) {
    failures.push(`Deterministic language issues ${deterministicIssues} > limit ${MAX_DETERMINISTIC}`);
  }
  if (agencyIssues > MAX_MISSING_AGENCY) {
    failures.push(`Missing agency language issues ${agencyIssues} > limit ${MAX_MISSING_AGENCY}`);
  }
  if (flagged > MAX_FLAGGED) {
    failures.push(`Flagged samples ${flagged} > limit ${MAX_FLAGGED}`);
  }
  if (hallucinations > MAX_HALLUCINATIONS) {
    failures.push(`Hallucinated card issues ${hallucinations} > limit ${MAX_HALLUCINATIONS}`);
  }
  if (harshTone > MAX_HARSH_TONE) {
    failures.push(`Harsh-tone issues ${harshTone} > limit ${MAX_HARSH_TONE}`);
  }
  if (missingSupportive > MAX_MISSING_SUPPORTIVE) {
    failures.push(`Missing supportive tone issues ${missingSupportive} > limit ${MAX_MISSING_SUPPORTIVE}`);
  }
  if ((rubric.accuracy ?? 0) < MIN_RUBRIC_ACCURACY) {
    failures.push(`Rubric accuracy ${(rubric.accuracy * 100).toFixed(1)}% < minimum ${(MIN_RUBRIC_ACCURACY * 100).toFixed(1)}%`);
  }
  if ((rubric.coherence ?? 0) < MIN_RUBRIC_COHERENCE) {
    failures.push(`Rubric coherence ${(rubric.coherence * 100).toFixed(1)}% < minimum ${(MIN_RUBRIC_COHERENCE * 100).toFixed(1)}%`);
  }
  if ((rubric.agency ?? 0) < MIN_RUBRIC_AGENCY) {
    failures.push(`Rubric agency ${(rubric.agency * 100).toFixed(1)}% < minimum ${(MIN_RUBRIC_AGENCY * 100).toFixed(1)}%`);
  }
  if ((rubric.compassion ?? 0) < MIN_RUBRIC_COMPASSION) {
    failures.push(`Rubric compassion ${(rubric.compassion * 100).toFixed(1)}% < minimum ${(MIN_RUBRIC_COMPASSION * 100).toFixed(1)}%`);
  }

  if (failures.length) {
    console.error('Narrative gate failed:', failures.join('; '));
    process.exitCode = 1;
    return;
  }

  console.log('Narrative metrics meet thresholds:', {
    spinePassRate: pct(spineRate),
    avgCardCoverage: pct(coverage),
    deterministicLanguageCount: deterministicIssues,
    missingAgencyCount: agencyIssues,
    hallucinationCount: hallucinations,
    harshToneCount: harshTone,
    missingSupportiveToneCount: missingSupportive,
    flaggedSamples: flagged,
    avgRubric: {
      accuracy: pct(rubric.accuracy ?? 0),
      coherence: pct(rubric.coherence ?? 0),
      agency: pct(rubric.agency ?? 0),
      compassion: pct(rubric.compassion ?? 0)
    }
  });
}

main().catch((err) => {
  console.error('Narrative gate check failed:', err.message);
  process.exit(1);
});
