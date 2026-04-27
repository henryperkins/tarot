#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_INPUT = 'data/evaluations/rws-grounding/results.json';
const DEFAULT_OUT = 'data/evaluations/rws-grounding/metrics.json';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesTerm(text, term) {
  if (!term) return false;
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text || '');
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
  const required = scoreRequiredTerms(text, requiredSymbols);
  const absent = Array.isArray(absentSymbols) ? absentSymbols : [];

  if (absent.length === 0) {
    return {
      absenceCorrect: true,
      hallucinatedSymbol: false,
      requiredCoverage: required.coverage
    };
  }

  const deniesAbsence = /\b(no|not|without|absent|none|isn't|is not|there is no)\b/i.test(text);
  const hallucinated = absent.some((symbol) => includesTerm(text, symbol)) && !deniesAbsence;

  return {
    absenceCorrect: deniesAbsence && !hallucinated,
    hallucinatedSymbol: hallucinated,
    requiredCoverage: required.coverage
  };
}

export function containsForbidden(answer, forbiddenTerms = []) {
  const list = Array.isArray(forbiddenTerms) ? forbiddenTerms : [];
  return list.some((term) => includesTerm(answer, term));
}

export function summarizeRwsGroundingMetrics(rows = []) {
  const sampleCount = rows.length;
  const avg = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  return {
    sampleCount,
    absenceAccuracy: avg(rows.map((row) => row.absenceCorrect === true ? 1 : 0)),
    hallucinatedSymbolRate: avg(rows.map((row) => row.hallucinatedSymbol === true ? 1 : 0)),
    safetyPassRate: avg(rows.map((row) => row.safetyPass === false ? 0 : 1)),
    groundedness: avg(rows.map((row) => Number.isFinite(row.groundedness) ? row.groundedness : 0))
  };
}

async function main() {
  const input = path.resolve(process.cwd(), process.argv[2] || DEFAULT_INPUT);
  const output = path.resolve(process.cwd(), process.argv[3] || DEFAULT_OUT);
  const payload = JSON.parse(await fs.readFile(input, 'utf-8'));
  const rows = Array.isArray(payload.results) ? payload.results : payload;
  const metrics = summarizeRwsGroundingMetrics(rows);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), metrics }, null, 2));
  console.log('RWS grounding metrics written to', output);
  console.log(metrics);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('RWS grounding metrics failed:', error.message);
    process.exit(1);
  });
}
