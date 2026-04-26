#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { getRwsCardEvidence } from '../../shared/vision/rwsEvidenceOntology.js';
import {
  scoreAbsenceAnswer,
  scoreRequiredTerms
} from './computeRwsGroundingMetrics.js';

const DEFAULT_DIR = 'data/evaluations/rws-grounding';
const DEFAULT_OUT = 'data/evaluations/rws-grounding/results.json';
const SEED_FILES = [
  { file: 'rws-hallucination.seed.jsonl', type: 'hallucination' },
  { file: 'rws-vqa.seed.jsonl', type: 'vqa' },
  { file: 'rws-safety.seed.jsonl', type: 'safety' }
];

function parseJsonl(text) {
  return String(text || '')
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function readSeedItems(baseDir) {
  const groups = await Promise.all(SEED_FILES.map(async ({ file, type }) => {
    const source = path.resolve(process.cwd(), baseDir, file);
    const rows = parseJsonl(await fs.readFile(source, 'utf-8'));
    return rows.map((row) => ({ ...row, eval_type: type }));
  }));

  return groups.flat();
}

function containsForbidden(answer, forbidden = []) {
  const text = String(answer || '').toLowerCase();
  return (Array.isArray(forbidden) ? forbidden : []).some((term) =>
    text.includes(String(term || '').toLowerCase())
  );
}

function buildOntologyAnswer(item) {
  const card = getRwsCardEvidence(item.card);
  const literalTerms = Array.isArray(item.required_literal) && item.required_literal.length
    ? item.required_literal
    : (card?.visualSymbols || []).slice(0, 3).map((symbol) => symbol.label);
  const symbolicTerms = Array.isArray(item.required_symbolic) && item.required_symbolic.length
    ? item.required_symbolic
    : (card?.coreThemes || []).slice(0, 3);

  if (Array.isArray(item.required) && item.required.length) {
    return `${item.card} is ${item.required.join(', ')}. Treat the card as symbolic context and keep agency with the querent.`;
  }

  return [
    `${item.card} shows ${literalTerms.join(', ')}.`,
    `Symbolically, these details point to ${symbolicTerms.join(', ')}.`
  ].join(' ');
}

function scoreSeedItem(item) {
  const answer = item.ideal_answer || buildOntologyAnswer(item);
  const absence = scoreAbsenceAnswer(answer, item.absent_symbols || [], item.required_symbols || []);
  const groundedTerms = [
    ...(item.required_literal || []),
    ...(item.required_symbolic || []),
    ...(item.required || [])
  ];
  const groundedness = groundedTerms.length
    ? scoreRequiredTerms(answer, groundedTerms).coverage
    : absence.requiredCoverage;

  return {
    eval_id: item.eval_id,
    eval_type: item.eval_type,
    card: item.card,
    question: item.question,
    answer,
    ...absence,
    safetyPass: !containsForbidden(answer, item.forbidden || []),
    groundedness
  };
}

async function main() {
  const baseDir = process.argv[2] || DEFAULT_DIR;
  const output = path.resolve(process.cwd(), process.argv[3] || DEFAULT_OUT);
  const items = await readSeedItems(baseDir);
  const results = items.map(scoreSeedItem);

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({
    generatedAt: new Date().toISOString(),
    seedCount: items.length,
    results
  }, null, 2));
  console.log(`RWS grounding eval wrote ${results.length} results to ${output}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('RWS grounding eval failed:', error.message);
    process.exit(1);
  });
}
