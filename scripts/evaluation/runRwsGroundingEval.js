#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  scoreAbsenceAnswer,
  scoreRequiredTerms,
  containsForbidden
} from './computeRwsGroundingMetrics.js';

const SEED_DIR = 'data/evaluations/rws-grounding';
const SEED_FILES = ['rws-hallucination.seed.jsonl', 'rws-vqa.seed.jsonl', 'rws-safety.seed.jsonl'];
const DEFAULT_OUT = path.join(SEED_DIR, 'results.json');

async function readJsonl(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return raw.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function buildOntologyAnswer(item) {
  const lit = Array.isArray(item.required_literal) ? item.required_literal : [];
  const sym = Array.isArray(item.required_symbolic) ? item.required_symbolic : [];
  const req = Array.isArray(item.required) ? item.required : [];
  const card = item.card || 'this card';
  const parts = [];
  if (lit.length) parts.push(`In ${card}, the visible details include ${lit.join(', ')}.`);
  if (sym.length) parts.push(`These suggest ${sym.join(', ')}.`);
  if (req.length) parts.push(`This card is ${req.join(', ')}.`);
  return parts.join(' ').trim() || `In ${card}, draw on canonical Rider-Waite-Smith imagery for context.`;
}

function evaluateItem(item) {
  const answer = item.ideal_answer || buildOntologyAnswer(item);
  const groundednessTerms = [
    ...(item.required_literal || []),
    ...(item.required_symbolic || []),
    ...(item.required_symbols || []),
    ...(item.required || [])
  ];
  const absence = scoreAbsenceAnswer(
    answer,
    item.absent_symbols || [],
    item.required_symbols || []
  );

  return {
    eval_id: item.eval_id,
    card: item.card,
    answer,
    absenceCorrect: absence.absenceCorrect,
    hallucinatedSymbol: absence.hallucinatedSymbol,
    safetyPass: !containsForbidden(answer, item.forbidden || []),
    groundedness: scoreRequiredTerms(answer, groundednessTerms).coverage
  };
}

async function main() {
  const out = path.resolve(process.cwd(), process.argv[2] || DEFAULT_OUT);
  const items = [];
  for (const fileName of SEED_FILES) {
    const filePath = path.resolve(process.cwd(), SEED_DIR, fileName);
    const records = await readJsonl(filePath);
    items.push(...records);
  }

  const results = items.map(evaluateItem);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(`Wrote ${results.length} RWS grounding eval results to ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('RWS grounding eval failed:', error.message);
    process.exit(1);
  });
}

export { evaluateItem, buildOntologyAnswer };
