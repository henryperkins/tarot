#!/usr/bin/env node
// scripts/enrichment/applyPassageCandidates.js
// Apply approved passage candidates to the knowledge base.
//
// Only rows whose human_verdict is "approve" are applied. The result is written
// to a generated module (functions/lib/knowledgeBaseEnrichment.js) that
// functions/lib/knowledgeBase.js merges at import time, so the hand-written
// canon file is never rewritten by a script.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv } from '../evaluation/lib/csv.js';
import { validateDraft } from './lib/passageDraft.js';

const DEFAULT_QUEUE = 'data/enrichment/passage-review-queue.csv';
const DEFAULT_OUTPUT = 'functions/lib/knowledgeBaseEnrichment.js';
const DEFAULT_PROVENANCE = 'data/enrichment/passage-provenance.json';
const APPROVED_VERDICTS = new Set(['approve', 'approved']);

export const USAGE = `Usage: node scripts/enrichment/applyPassageCandidates.js [options]

Apply review-queue rows marked approved to the generated knowledge-base module.

Options:
  --queue <path>        Review queue CSV (default ${DEFAULT_QUEUE})
  --out <path>          Generated module (default ${DEFAULT_OUTPUT})
  --provenance <path>   Provenance record (default ${DEFAULT_PROVENANCE})
  --dry-run             Report what would be applied without writing
  --help                Show this message
`;

function parseArgs(argv) {
  const options = {
    queue: DEFAULT_QUEUE,
    out: DEFAULT_OUTPUT,
    provenance: DEFAULT_PROVENANCE,
    dryRun: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--queue') options.queue = argv[++index];
    else if (arg === '--out') options.out = argv[++index];
    else if (arg === '--provenance') options.provenance = argv[++index];
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.queue) throw new Error('--queue requires a file path.');
  if (!options.out) throw new Error('--out requires a file path.');
  if (!options.provenance) throw new Error('--provenance requires a file path.');
  return options;
}

function columnIndex(header, name) {
  return header.indexOf(name);
}

/**
 * Read the review queue and select the rows a reviewer approved.
 */
export function selectApprovedRows(csvContent) {
  const { header, rows } = parseCsv(csvContent);
  const required = ['candidate_id', 'card_number', 'card_name', 'context', 'draft_text', 'draft_tags', 'human_verdict'];
  for (const column of required) {
    if (columnIndex(header, column) === -1) {
      throw new Error(`Review queue is missing the "${column}" column.`);
    }
  }
  const at = (name) => columnIndex(header, name);

  const approved = [];
  const rejected = [];
  const seenSlots = new Set();
  for (const columns of rows) {
    const verdict = String(columns[at('human_verdict')] || '').trim().toLowerCase();
    if (!verdict) continue;
    const candidateId = String(columns[at('candidate_id')] || '').trim();
    if (!APPROVED_VERDICTS.has(verdict)) {
      rejected.push({ candidateId, verdict });
      continue;
    }
    const text = String(columns[at('draft_text')] || '').trim();
    const tags = String(columns[at('draft_tags')] || '').trim().split(/\s+/).filter(Boolean);
    const context = String(columns[at('context')] || '').trim().toLowerCase();
    const cardNumber = Number.parseInt(columns[at('card_number')], 10);
    const validation = validateDraft({ text, tags, context });
    if (!Number.isInteger(cardNumber)) {
      rejected.push({ candidateId, verdict: 'invalid card number' });
      continue;
    }
    if (!validation.valid) {
      rejected.push({ candidateId, verdict: `validation failed: ${validation.errors.join('; ')}` });
      continue;
    }
    // Only one passage per card and context can ever be selected, so a second
    // approved row for the same slot would be dead weight in the prompt.
    const slot = `${cardNumber}#${context}`;
    if (seenSlots.has(slot)) {
      rejected.push({ candidateId, verdict: `duplicate slot: another approved passage already covers ${context} for this card` });
      continue;
    }
    seenSlots.add(slot);
    approved.push({
      candidateId,
      cardNumber,
      cardName: String(columns[at('card_name')] || '').trim(),
      context,
      text,
      tags,
      sourceUrl: String(columns[at('source_url')] || '').trim(),
      sourceTitle: String(columns[at('source_title')] || '').trim(),
      generatedAt: String(columns[at('generated_at')] || '').trim(),
      model: String(columns[at('model')] || '').trim()
    });
  }
  return { approved, rejected };
}

function renderModule(entries) {
  const byCard = new Map();
  for (const entry of entries) {
    if (!byCard.has(entry.cardNumber)) byCard.set(entry.cardNumber, []);
    byCard.get(entry.cardNumber).push(entry);
  }
  const cardKeys = [...byCard.keys()].sort((a, b) => a - b);
  const body = cardKeys.map((cardNumber) => {
    const passages = byCard.get(cardNumber).map((entry) => [
      `        // candidate: ${entry.candidateId}`,
      '        {',
      "            source: 'Tableu Tarot Canon',",
      `            context: '${entry.context}',`,
      `            text: ${JSON.stringify(entry.text)},`,
      `            tags: ${JSON.stringify(entry.tags)},`,
      '        }'
    ].join('\n')).join('\n');
    return [
      `    ${cardNumber}: {`,
      '        passages: [',
      passages,
      '        ]',
      '    }'
    ].join('\n');
  }).join('\n');

  return `// functions/lib/knowledgeBaseEnrichment.js
// GENERATED FILE — do not edit by hand.
//
// Reviewed passage candidates approved through the enrichment review queue
// (data/enrichment/passage-review-queue.csv). Regenerate with:
//   npm run enrich:apply
//
// Each passage carries a "context" that is more specific than "general", so
// these deepen a matching reading without displacing the hand-written canon
// passage for the same card.

export const ENRICHED_MAJOR_ARCANA_PASSAGES = {
${body}
};
`;
}

export async function applyCandidates({
  queue = DEFAULT_QUEUE,
  out = DEFAULT_OUTPUT,
  provenance = DEFAULT_PROVENANCE,
  dryRun = false,
  log = console.log
} = {}) {
  const queuePath = path.resolve(process.cwd(), queue);
  let csvContent;
  try {
    csvContent = await fs.readFile(queuePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Review queue not found at ${queuePath}. Run npm run enrich:passages first.`);
    }
    throw error;
  }

  const { approved, rejected } = selectApprovedRows(csvContent);
  for (const entry of rejected) {
    log(`Not applied (${entry.candidateId}): ${entry.verdict}`);
  }
  if (!approved.length) {
    log('No approved candidates to apply.');
    return { applied: 0, rejected: rejected.length };
  }

  const module = renderModule(approved);
  if (dryRun) {
    log(`Dry run: ${approved.length} candidate(s) would be written to ${out}.`);
    return { applied: approved.length, rejected: rejected.length, dryRun: true };
  }

  const outPath = path.resolve(process.cwd(), out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, module);

  const provenancePath = path.resolve(process.cwd(), provenance);
  await fs.mkdir(path.dirname(provenancePath), { recursive: true });
  await fs.writeFile(provenancePath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    applied: approved.map((entry) => ({
      candidateId: entry.candidateId,
      cardNumber: entry.cardNumber,
      cardName: entry.cardName,
      context: entry.context,
      sourceUrl: entry.sourceUrl,
      sourceTitle: entry.sourceTitle,
      model: entry.model
    }))
  }, null, 2)}\n`);

  log(`Applied ${approved.length} approved passage(s) to ${path.relative(process.cwd(), outPath) || outPath}.`);
  log(`Provenance recorded in ${path.relative(process.cwd(), provenancePath) || provenancePath}.`);
  return { applied: approved.length, rejected: rejected.length };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }
  const { applied, rejected } = await applyCandidates(options);
  console.log(`${applied} applied, ${rejected} skipped.`);
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
