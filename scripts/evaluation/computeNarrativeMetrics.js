#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { validateReadingNarrative } from '../../functions/lib/narrativeSpine.js';
import { normalizeCardName } from '../../functions/lib/cardContextDetection.js';
import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { parseCsv, stringifyRow } from './lib/csv.js';

const DEFAULT_INPUT = 'data/evaluations/narrative-samples.json';
const DEFAULT_METRICS_OUT = 'data/evaluations/narrative-metrics.json';
const DEFAULT_REVIEW_OUT = 'data/evaluations/narrative-review-queue.csv';

const DETERMINISTIC_PATTERNS = [
  /\bguaranteed\b/i,
  /\bwill definitely\b/i,
  /\bfated to\b/i,
  /\bdestined to\b/i,
  /\bno choice\b/i,
  /\bset in stone\b/i,
  /\binescapable\b/i,
  /\bcannot fail\b/i,
  /\binevitable outcome\b/i
];

const AGENCY_PATTERNS = [
  /\bfree will\b/i,
  /\bchoice\b/i,
  /\bchoose\b/i,
  /\bagency\b/i,
  /\byou decide\b/i,
  /\byou direct\b/i,
  /\bco-creating\b/i,
  /\byou can shape\b/i
];

const SUPPORTIVE_TONE_PATTERNS = [
  /\bgentle\b/i,
  /\bcompassion\b/i,
  /\bself-compassion\b/i,
  /\bkindness\b/i,
  /\bground(?:ing)?\b/i,
  /\bcuriosity\b/i,
  /\boffer yourself\b/i,
  /\bpermission\b/i,
  /\bsoften\b/i,
  /\bbreath\b/i,
  /\binvite\b/i,
  /\bconsider\b/i,
  /\bchoice\b/i,
  /\bagency\b/i
];

const HARSH_TONE_PATTERNS = [
  /\byou must\b/i,
  /\byou should\b/i,
  /\bno choice\b/i,
  /\bnever\b/i,
  /\balways\b/i,
  /\bonly way\b/i,
  /\bcannot avoid\b/i,
  /\bmust not\b/i
];

const ALL_CARD_NAME_PATTERNS = [...MAJOR_ARCANA, ...MINOR_ARCANA].map((card) => card.name).map((name) => ({
  name,
  normalized: normalizeCardName(name),
  pattern: new RegExp(`\\b${escapeRegex(name)}\\b`, 'i')
}));

function usage() {
  console.log('Usage: node scripts/evaluation/computeNarrativeMetrics.js [--in file] [--metrics-out file] [--review-out file]');
}

function parseArgs(rawArgs) {
  const options = {
    input: DEFAULT_INPUT,
    metricsOut: DEFAULT_METRICS_OUT,
    reviewOut: DEFAULT_REVIEW_OUT
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--in') {
      options.input = rawArgs[i + 1] || options.input;
      i += 1;
    } else if (arg === '--metrics-out') {
      options.metricsOut = rawArgs[i + 1] || options.metricsOut;
      i += 1;
    } else if (arg === '--review-out') {
      options.reviewOut = rawArgs[i + 1] || options.reviewOut;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
  }

  return options;
}

function containsPattern(text, patterns) {
  if (!text) return false;
  return patterns.some((pattern) => pattern.test(text));
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function analyzeCardCoverage(reading, cardsInfo = []) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    return { coverage: 1, missingCards: [] };
  }

  const missingCards = [];
  cardsInfo.forEach((card) => {
    const pattern = new RegExp(escapeRegex(card.card), 'i');
    if (!pattern.test(reading)) {
      missingCards.push(card.card);
    }
  });

  const presentCount = cardsInfo.length - missingCards.length;
  return {
    coverage: cardsInfo.length ? presentCount / cardsInfo.length : 1,
    missingCards
  };
}

function detectHallucinatedCards(reading, cardsInfo = []) {
  if (!reading) return [];
  const cleanedReading = reading.replace(/(?:the\s+)?fool['’]?s?\s+journey/gi, '');
  const drawn = new Set((cardsInfo || []).map((card) => normalizeCardName(card.card)));
  const hallucinated = [];

  ALL_CARD_NAME_PATTERNS.forEach(({ name, normalized, pattern }) => {
    if (!pattern.test(cleanedReading)) return;
    if (!drawn.has(normalized)) {
      hallucinated.push(name);
    }
  });

  return [...new Set(hallucinated)];
}

function analyzeToneSignals(reading = '') {
  return {
    supportive: containsPattern(reading, SUPPORTIVE_TONE_PATTERNS),
    harsh: containsPattern(reading, HARSH_TONE_PATTERNS)
  };
}

function buildIssueNotes(result) {
  const notes = [];
  if (!result.spine.isValid) {
    notes.push(`Story spine complete ${result.spine.completeSections}/${result.spine.totalSections}`);
  }
  if (result.missingCards.length) {
    notes.push(`Missing cards: ${result.missingCards.join(', ')}`);
  }
  if (result.deterministicLanguage) {
    notes.push('Deterministic language detected');
  }
  if (!result.hasAgencyLanguage) {
    notes.push('Agency/choice language missing');
  }
  if (result.hallucinatedCards.length) {
    notes.push(`Hallucinated cards referenced: ${result.hallucinatedCards.join(', ')}`);
  }
  if (result.hasHarshTone) {
    notes.push('Harsh/imperative tone detected');
  }
  if (!result.hasSupportiveTone) {
    notes.push('Supportive/trauma-informed tone missing');
  }
  return notes.join('; ');
}

function buildIssueFlags(result) {
  const flags = [];
  if (!result.spine.isValid) {
    flags.push('spine-incomplete');
  }
  if (result.missingCards.length) {
    flags.push(`missing-cards(${result.missingCards.length})`);
  }
  if (result.deterministicLanguage) {
    flags.push('deterministic-language');
  }
  if (!result.hasAgencyLanguage) {
    flags.push('missing-agency-language');
  }
  if (result.hallucinatedCards.length) {
    flags.push(`hallucinated-cards(${result.hallucinatedCards.length})`);
  }
  if (result.hasHarshTone) {
    flags.push('harsh-tone');
  }
  if (!result.hasSupportiveTone) {
    flags.push('missing-supportive-tone');
  }
  return flags;
}

function getIssuesForQueue(result) {
  return buildIssueFlags(result).join('; ');
}

function summarizeSample(sample) {
  const reading = sample.reading || '';
  const spine = validateReadingNarrative(reading);
  const cardCoverage = analyzeCardCoverage(reading, sample.cardsInfo || []);
  const deterministicLanguage = containsPattern(reading, DETERMINISTIC_PATTERNS);
  const hasAgencyLanguage = containsPattern(reading, AGENCY_PATTERNS);
  const hallucinatedCards = detectHallucinatedCards(reading, sample.cardsInfo || []);
  const tone = analyzeToneSignals(reading);
  const issueFlags = buildIssueFlags({
    spine,
    missingCards: cardCoverage.missingCards,
    deterministicLanguage,
    hasAgencyLanguage,
    hallucinatedCards,
    hasHarshTone: tone.harsh,
    hasSupportiveTone: tone.supportive
  });
  const coherenceScore = spine.totalSections
    ? spine.completeSections / spine.totalSections
    : spine.isValid
      ? 1
      : 0;

  return {
    id: sample.id,
    spreadKey: sample.spreadKey,
    spreadName: sample.spreadName,
    question: sample.userQuestion,
    spine: {
      isValid: spine.isValid,
      totalSections: spine.totalSections || 0,
      completeSections: spine.completeSections || 0,
      incompleteSections: spine.incompleteSections || 0
    },
    cardCoverage: cardCoverage.coverage,
    missingCards: cardCoverage.missingCards,
    deterministicLanguage,
    hasAgencyLanguage,
    hallucinatedCards,
    hasSupportiveTone: tone.supportive,
    hasHarshTone: tone.harsh,
    issueFlags,
    issuesPresent: issueFlags.length > 0,
    rubric: {
      accuracy: cardCoverage.coverage,
      coherence: coherenceScore,
      agency: hasAgencyLanguage ? 1 : 0,
      compassion: tone.supportive ? 1 : 0
    }
  };
}

async function readExistingAnnotations(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { header, rows } = parseCsv(content);
    const idIdx = header.indexOf('sample_id');
    const verdictIdx = header.indexOf('human_verdict');
    const notesIdx = header.indexOf('human_notes');
    if (idIdx === -1 || verdictIdx === -1) {
      return new Map();
    }
    const map = new Map();
    rows.forEach((cols) => {
      const key = cols[idIdx];
      map.set(key, {
        human_verdict: verdictIdx >= 0 ? cols[verdictIdx] : '',
        human_notes: notesIdx >= 0 ? cols[notesIdx] : ''
      });
    });
    return map;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return new Map();
    }
    throw err;
  }
}

async function writeReviewQueue(rows, filePath, existingAnnotations) {
  const header = ['sample_id', 'spread', 'question', 'issues', 'automated_notes', 'human_verdict', 'human_notes'];
  const lines = [stringifyRow(header)];
  rows.forEach((row) => {
    const annotation = existingAnnotations.get(row.sample_id) || {};
    lines.push(
      stringifyRow([
        row.sample_id,
        row.spread,
        row.question,
        row.issues,
        row.notes,
        annotation.human_verdict || '',
        annotation.human_notes || ''
      ])
    );
  });
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, lines.join('\n'));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), options.input);
  let payload;
  try {
    payload = JSON.parse(await fs.readFile(inputPath, 'utf-8'));
  } catch (err) {
    console.error(`Unable to read ${options.input}. Run 'npm run eval:narrative' first.`);
    throw err;
  }

  const samples = Array.isArray(payload?.samples) ? payload.samples : [];
  if (!samples.length) {
    console.error('No narrative samples found.');
    process.exit(1);
  }

  const analyses = samples.map(summarizeSample);
  const totalSamples = analyses.length;
  const spinePass = analyses.filter((result) => result.spine.isValid).length;
  const deterministicCount = analyses.filter((result) => result.deterministicLanguage).length;
  const missingAgencyCount = analyses.filter((result) => !result.hasAgencyLanguage).length;
  const hallucinationCount = analyses.filter((result) => result.hallucinatedCards.length > 0).length;
  const harshToneCount = analyses.filter((result) => result.hasHarshTone).length;
  const missingSupportiveToneCount = analyses.filter((result) => !result.hasSupportiveTone).length;
  const flaggedSamples = analyses.filter((result) => result.issueFlags.length > 0);
  const avgCardCoverage = analyses.reduce((sum, result) => sum + result.cardCoverage, 0) / totalSamples;
  const rubricTotals = analyses.reduce(
    (acc, result) => {
      acc.accuracy += result.rubric.accuracy;
      acc.coherence += result.rubric.coherence;
      acc.agency += result.rubric.agency;
      acc.compassion += result.rubric.compassion;
      return acc;
    },
    { accuracy: 0, coherence: 0, agency: 0, compassion: 0 }
  );
  const avgRubricScores = totalSamples
    ? {
        accuracy: rubricTotals.accuracy / totalSamples,
        coherence: rubricTotals.coherence / totalSamples,
        agency: rubricTotals.agency / totalSamples,
        compassion: rubricTotals.compassion / totalSamples
      }
    : { accuracy: 0, coherence: 0, agency: 0, compassion: 0 };

  const metrics = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(process.cwd(), inputPath),
    totalSamples,
    spinePassRate: spinePass / totalSamples,
    avgCardCoverage,
    deterministicLanguageCount: deterministicCount,
    missingAgencyCount,
    hallucinationCount,
    harshToneCount,
    missingSupportiveToneCount,
    flaggedSampleCount: flaggedSamples.length,
    avgRubricScores,
    perSample: analyses
  };

  const metricsPath = path.resolve(process.cwd(), options.metricsOut);
  await fs.mkdir(path.dirname(metricsPath), { recursive: true });
  await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
  console.log(`Narrative metrics written to ${path.relative(process.cwd(), metricsPath)}.`);

  const queueRows = flaggedSamples.map((result) => ({
    sample_id: result.id,
    spread: result.spreadName,
    question: result.question,
    issues: getIssuesForQueue(result),
    notes: buildIssueNotes(result)
  }));

  const reviewPath = path.resolve(process.cwd(), options.reviewOut);
  const existingAnnotations = await readExistingAnnotations(reviewPath);
  await writeReviewQueue(queueRows, reviewPath, existingAnnotations);
  console.log(
    queueRows.length > 0
      ? `Narrative review queue updated with ${queueRows.length} flagged sample(s).`
      : 'Narrative review queue refreshed (no flagged samples; header only).'
  );
}

main().catch((err) => {
  console.error('Failed to compute narrative metrics:', err.message);
  process.exit(1);
});
