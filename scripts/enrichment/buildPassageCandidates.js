#!/usr/bin/env node
// scripts/enrichment/buildPassageCandidates.js
// Turn fetched web sources into knowledge-base passage candidates.
//
// Every candidate lands in a review queue. Nothing is written to the knowledge
// base here: approved candidates are applied by applyPassageCandidates.js.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MAJOR_ARCANA_PASSAGES } from '../../functions/lib/knowledgeBase.js';
import { parseCsv, stringifyRow } from '../evaluation/lib/csv.js';
import {
  assessEvidence,
  buildDigest,
  detectCard,
  extractEvidence
} from './lib/knowledgeExtraction.js';
import { draftPassage } from './lib/passageDraft.js';
import { assessContent } from './lib/browserFallback.js';

const DEFAULT_SOURCE_DIR = 'data/enrichment';
const DEFAULT_QUEUE = 'data/enrichment/passage-review-queue.csv';

const QUEUE_COLUMNS = [
  'candidate_id',
  'card_number',
  'card_name',
  'theme',
  'context',
  'source_url',
  'source_title',
  'source_method',
  'evidence',
  'draft_text',
  'draft_tags',
  'validation',
  'generated_at',
  'model',
  'human_verdict',
  'human_notes',
  'source_id',
  'projection_text',
  'projection_version',
  'projection_verdict'
];

export const USAGE = `Usage: node scripts/enrichment/buildPassageCandidates.js [options]

Turn fetched web sources into knowledge-base passage candidates and write
them to a review queue. Nothing reaches the knowledge base until a reviewer
approves a row and applyPassageCandidates.js runs.

Options:
  --source-dir <dir>   Enrichment JSON directory (default ${DEFAULT_SOURCE_DIR})
  --queue <path>       Review queue CSV (default ${DEFAULT_QUEUE})
  --card <name>        Only this card (repeatable, matched by name)
  --limit <n>          Maximum sources to consider
  --no-draft           Extract evidence only, skip the drafting model
  --help               Show this message
`;

function parseArgs(argv) {
  const options = {
    sourceDir: DEFAULT_SOURCE_DIR,
    queue: DEFAULT_QUEUE,
    cards: [],
    limit: null,
    draft: true,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source-dir') options.sourceDir = argv[++index];
    else if (arg === '--queue') options.queue = argv[++index];
    else if (arg === '--card') options.cards.push(String(argv[++index] || '').trim().toLowerCase());
    else if (arg === '--limit') options.limit = Number.parseInt(argv[++index], 10);
    else if (arg === '--no-draft') options.draft = false;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.sourceDir) throw new Error('--source-dir requires a directory.');
  if (!options.queue) throw new Error('--queue requires a file path.');
  if (options.limit !== null && (!Number.isSafeInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer.');
  }
  options.cards = options.cards.filter(Boolean);
  return options;
}

function oneLine(value) {
  return String(value ?? '').replace(/\s*\r?\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Normalize a URL so the same page fetched twice is one candidate.
 */
export function normalizeSourceUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.protocol = url.protocol.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    if (url.pathname.endsWith('/index.html')) url.pathname = url.pathname.slice(0, -'index.html'.length);
    return url.href;
  } catch {
    return String(rawUrl || '');
  }
}

/**
 * A verdict belongs to the exact row that was reviewed. Keep that row intact,
 * including its draft, context, tags, evidence, provenance, and notes.
 */
async function readExistingDecisions(queuePath) {
  const decisions = new Map();
  let content;
  try {
    content = await fs.readFile(queuePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return decisions;
    throw error;
  }
  const { header, rows } = parseCsv(content);
  decisions.columns = header;
  const at = (name) => header.indexOf(name);
  if (at('source_url') === -1 || at('card_number') === -1 || at('human_verdict') === -1) {
    return decisions;
  }
  for (const columns of rows) {
    const verdict = String(columns[at('human_verdict')] || '').trim();
    if (!verdict) continue;
    const key = `${normalizeSourceUrl(columns[at('source_url')] || '')}#${columns[at('card_number')] || ''}`;
    decisions.set(key, Object.fromEntries(header.map((column) => [
      column, String(columns[at(column)] ?? '')
    ])));
  }
  return decisions;
}

async function readEnrichmentRuns(sourceDir) {
  let entries;
  try {
    entries = await fs.readdir(sourceDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const runs = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(sourceDir, entry.name);
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (Array.isArray(parsed?.sources)) runs.push({ file: entry.name, run: parsed });
    } catch {
      // A malformed run file must not stop the others.
    }
  }
  return runs.sort((a, b) =>
    (Date.parse(b.run.fetchedAt) || 0) - (Date.parse(a.run.fetchedAt) || 0)
    || a.file.localeCompare(b.file)
  );
}

function voiceExamples(cardNumber, limit = 3) {
  const entry = MAJOR_ARCANA_PASSAGES[cardNumber];
  const samples = entry?.passages?.map((passage) => passage.text).filter(Boolean) || [];
  for (const number of [0, 1, 2]) {
    const other = MAJOR_ARCANA_PASSAGES[number];
    const text = other?.passages?.[0]?.text;
    if (text && !samples.includes(text)) samples.push(text);
  }
  return samples.slice(0, limit);
}

export async function buildCandidates({
  sourceDir = DEFAULT_SOURCE_DIR,
  queue = DEFAULT_QUEUE,
  cards = [],
  limit = null,
  draft = true,
  signal,
  log = console.log
} = {}) {
  const runs = await readEnrichmentRuns(sourceDir);
  if (!runs.length) {
    log(`No enrichment runs found in ${sourceDir}. Run npm run enrich:web first.`);
    return { rows: [], skipped: [], queuePath: null };
  }

  const wanted = new Set(cards);
  const skipped = [];
  const queuePath = path.resolve(process.cwd(), queue);
  const decisions = await readExistingDecisions(queuePath);
  // Reviewed rows survive filtered runs and unavailable sources as well.
  const rows = [...decisions.values()];
  const seen = new Set(rows.map((row) => normalizeSourceUrl(row.source_url)));
  let considered = 0;

  for (const { run } of runs) {
    for (const source of run.sources || []) {
      if (limit !== null && considered >= limit) break;
      if (!source?.url) continue;
      const sourceKey = normalizeSourceUrl(source.url);
      if (seen.has(sourceKey)) continue;
      // Failed/challenge captures must not claim the URL or consume the limit.
      // Older archives without a status retain their historical text handling.
      const contentError = source.error || assessContent({
        ...source, statusCode: source.statusCode ?? 200
      }).error;
      if (contentError) {
        skipped.push({ url: source.url, reason: contentError });
        continue;
      }

      const detected = detectCard({ title: source.title || '', content: source.content }, MAJOR_ARCANA);
      if (!detected) {
        skipped.push({ url: source.url, reason: 'No Major Arcana card could be identified in the source.' });
        continue;
      }
      if (wanted.size && !wanted.has(detected.cardName.toLowerCase())) {
        skipped.push({ url: source.url, reason: `Card "${detected.cardName}" is not in the requested set.` });
        continue;
      }

      const evidence = extractEvidence(source.content);
      const assessment = assessEvidence(evidence);
      if (!assessment.sufficient) {
        skipped.push({ url: source.url, reason: assessment.reason });
        continue;
      }
      seen.add(sourceKey);
      considered += 1;

      const digest = buildDigest({ card: detected, evidence });
      const theme = MAJOR_ARCANA_PASSAGES[detected.cardNumber]?.theme || '';
      const sourceId = `research:${createHash('sha256').update(sourceKey).digest('hex').slice(0, 24)}`;
      const candidateId = `${detected.cardNumber}-${sourceId}`;

      let draftResult = { text: '', tags: [], context: '', model: null, validation: { valid: false, errors: ['Not drafted.'] } };
      if (draft) {
        log(`Drafting a passage for ${detected.cardName} from ${source.url}`);
        try {
          draftResult = await draftPassage({
            card: detected,
            theme,
            digest,
            examples: voiceExamples(detected.cardNumber),
            signal
          });
        } catch (error) {
          draftResult = {
            text: '',
            tags: [],
            context: '',
            model: null,
            validation: { valid: false, errors: [`Drafting failed: ${error.message}`] }
          };
        }
      } else {
        draftResult.validation = { valid: false, errors: ['Evidence only; no draft was requested.'] };
      }

      rows.push({
        candidate_id: candidateId,
        card_number: detected.cardNumber,
        card_name: detected.cardName,
        theme,
        context: draftResult.context,
        source_url: source.url,
        source_title: source.title || '',
        source_method: source.method || 'fetch',
        evidence: oneLine(digest),
        draft_text: oneLine(draftResult.text),
        draft_tags: (draftResult.tags || []).join(' '),
        validation: oneLine(draftResult.validation?.errors?.join('; ') || 'ok'),
        generated_at: new Date().toISOString(),
        model: draftResult.model || '',
        human_verdict: '',
        human_notes: '',
        source_id: sourceId,
        projection_text: oneLine(draftResult.archetypalText || ''),
        projection_version: 'meaning-v1',
        projection_verdict: ''
      });
    }
  }

  if (rows.length) {
    await fs.mkdir(path.dirname(queuePath), { recursive: true });
    const columns = rows.every(row => row.human_verdict) && decisions.columns ? decisions.columns : [...new Set([...(decisions.columns || []), ...QUEUE_COLUMNS])];
    const csv = [
      columns.join(','),
      ...rows.map((row) => stringifyRow(columns.map((column) => row[column])))
    ].join('\n');
    await fs.writeFile(queuePath, `${csv}\n`);
    log(`\nWrote ${rows.length} candidate(s) to ${path.relative(process.cwd(), queuePath) || queuePath}`);
  } else {
    log('\nNo passage candidates were produced.');
  }

  return { rows, skipped, queuePath: rows.length ? queuePath : null };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error('Cancelled'));
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const { rows, skipped } = await buildCandidates({ ...options, signal: controller.signal });
    for (const entry of skipped) {
      console.log(`Skipped ${entry.url}: ${entry.reason}`);
    }
    const invalid = rows.filter((row) => row.validation && row.validation !== 'ok').length;
    if (invalid) {
      console.log(`${invalid} candidate(s) have validation notes; fix them in the queue before approving.`);
    }
    console.log(`${rows.length} candidate(s) awaiting review. Fill in human_verdict, then run npm run enrich:apply.`);
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
