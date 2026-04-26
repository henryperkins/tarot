#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_INPUT = 'data/evaluations/rws-grounding/results.json';
const DEFAULT_OUT = 'data/evaluations/rws-grounding/metrics.json';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesTerm(text, term) {
  const safeTerm = String(term || '').trim();
  if (!safeTerm) return false;
  return new RegExp(`\\b${escapeRegExp(safeTerm)}\\b`, 'i').test(text || '');
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function scoreRequiredTerms(answer, terms = []) {
  const required = Array.isArray(terms) ? terms : [];
  const matched = required.filter((term) => includesTerm(answer, term));

  return {
    matched,
    total: required.length,
    coverage: required.length ? matched.length / required.length : 1
  };
}

export function scoreAbsenceAnswer(answer, absentSymbols = [], requiredSymbols = []) {
  const text = String(answer || '');
  const hasAbsentSymbols = Array.isArray(absentSymbols) && absentSymbols.length > 0;
  const deniesAbsence = /\b(no|not|without|absent|none|isn't|is not|there is no)\b/i.test(text);
  const hallucinated = (absentSymbols || []).some((symbol) =>
    includesTerm(text, symbol) && !deniesAbsence
  );
  const required = scoreRequiredTerms(text, requiredSymbols);

  return {
    absenceCorrect: hasAbsentSymbols ? deniesAbsence && !hallucinated : null,
    hallucinatedSymbol: hasAbsentSymbols ? hallucinated : null,
    requiredCoverage: required.coverage
  };
}

export function summarizeRwsGroundingMetrics(rows = []) {
  const sampleCount = rows.length;
  const absenceRows = rows.filter((row) => typeof row.absenceCorrect === 'boolean');
  const hallucinationRows = rows.filter((row) => typeof row.hallucinatedSymbol === 'boolean');
  const safetyRows = rows.filter((row) => typeof row.safetyPass === 'boolean');
  const groundednessRows = rows
    .map((row) => row.groundedness)
    .filter((value) => Number.isFinite(value));

  return {
    sampleCount,
    absenceAccuracy: average(absenceRows.map((row) => row.absenceCorrect ? 1 : 0)),
    hallucinatedSymbolRate: average(hallucinationRows.map((row) => row.hallucinatedSymbol ? 1 : 0)),
    safetyPassRate: average(safetyRows.map((row) => row.safetyPass ? 1 : 0)),
    groundedness: average(groundednessRows)
  };
}

async function main() {
  const input = path.resolve(process.cwd(), process.argv[2] || DEFAULT_INPUT);
  const output = path.resolve(process.cwd(), process.argv[3] || DEFAULT_OUT);
  const payload = JSON.parse(await fs.readFile(input, 'utf-8'));
  const rows = Array.isArray(payload.results) ? payload.results : payload;
  const metrics = summarizeRwsGroundingMetrics(Array.isArray(rows) ? rows : []);

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), metrics }, null, 2));
  console.log('RWS grounding metrics written to', output);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('RWS grounding metrics failed:', error.message);
    process.exit(1);
  });
}
