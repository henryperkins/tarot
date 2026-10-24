#!/usr/bin/env node
// Approved enrichment is data. A partial review queue is never a deletion list.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { validateDraft } from './lib/passageDraft.js';

const DEFAULT_QUEUE = 'data/enrichment/passage-review-queue.csv';
const DEFAULT_OUTPUT = 'functions/lib/knowledgeBaseEnrichment.js';
const DEFAULT_PROVENANCE = 'data/enrichment/passage-provenance.json';
const APPROVED_VERDICTS = new Set(['approve', 'approved']);
const REJECTED_VERDICTS = new Set(['reject', 'rejected']);
const CARD_NUMBER = /^(0|[1-9][0-9]*)$/;
const DIGEST = /^[a-f0-9]{64}$/;
const normalizeName = value => String(value).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const slotOf = entry => `${entry.cardNumber}#${entry.context}`;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const USAGE = `Usage: node scripts/enrichment/applyPassageCandidates.js [options]

Apply approved slots and explicit candidate rejections. Missing/pending rows preserve approvals.

Options:
  --queue <path>                 Review queue CSV (default ${DEFAULT_QUEUE})
  --out <path>                   Generated module (default ${DEFAULT_OUTPUT})
  --provenance <path>            Provenance record (default ${DEFAULT_PROVENANCE})
  --mode <merge|replace>         Scoped merge (default), or verified complete replacement
  --completeness-manifest <path> Required JSON completeness manifest for replacement
  --dry-run                      Validate and report without writing
  --check                        Validate existing output/provenance only; no queue required
  --help                         Show this message
`;

function parseArgs(argv) {
  const options = { queue: DEFAULT_QUEUE, out: DEFAULT_OUTPUT, provenance: DEFAULT_PROVENANCE, mode: 'merge', dryRun: false };
  const values = { '--queue': 'queue', '--out': 'out', '--provenance': 'provenance', '--mode': 'mode', '--completeness-manifest': 'completenessManifest' };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (Object.hasOwn(values, arg)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
      options[values[arg]] = value;
    } else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--check') options.check = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

// Unlike the evaluation CSV helper, review metadata may contain quoted newlines.
// Reject broken quoting/widths rather than guessing which fields were approved.
function parseReviewCsv(content) {
  const records = [];
  let record = [];
  let value = '';
  let quoted = false;
  let closed = false;
  const field = () => { record.push(value); value = ''; closed = false; };
  const line = () => { field(); if (record.some(cell => cell.trim())) records.push(record); record = []; };
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') { value += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else value += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      if (char === ',') field();
      else { line(); if (char === '\r' && content[index + 1] === '\n') index++; }
    } else if (char === '"') {
      if (value.trim() || closed) throw new Error('Malformed review queue CSV quoting.');
      value = '';
      quoted = true;
    } else {
      if (closed && !/\s/.test(char)) throw new Error('Malformed review queue CSV after quoted field.');
      if (!closed) value += char;
    }
  }
  if (quoted) throw new Error('Malformed review queue CSV: unterminated quoted field.');
  if (value || record.length || closed) line();
  const header = (records.shift() || []).map(cell => cell.trim());
  if (new Set(header).size !== header.length) throw new Error('Review queue has duplicate CSV columns.');
  if (records.some(row => row.length !== header.length)) throw new Error('Malformed review queue CSV row width.');
  return { header, rows: records };
}

function validCandidateId(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 512
    && ![...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
}

function validateEntry(entry) {
  const errors = [];
  if (!Number.isInteger(entry.cardNumber) || entry.cardNumber < 0 || entry.cardNumber > 21) errors.push('invalid card number');
  const card = MAJOR_ARCANA.find(card => card.number === entry.cardNumber);
  if (!card || normalizeName(entry.cardName) !== normalizeName(card.name)) errors.push('canonical card name/number mismatch');
  if (!validCandidateId(entry.candidateId)) errors.push('invalid candidate ID');
  const validation = validateDraft(entry);
  if (!validation.valid) errors.push(`validation failed: ${validation.errors.join('; ')}`);
  for (const key of ['cardName', 'sourceTitle', 'sourceMethod', 'archetypalText', 'projectionVersion', 'generatedAt', 'model']) {
    if (entry[key] !== undefined && typeof entry[key] !== 'string') errors.push(`invalid ${key} metadata`);
  }
  if (entry.projectionReviewStatus === 'approved' && (typeof entry.archetypalText !== 'string' || !entry.archetypalText.trim() || typeof entry.projectionVersion !== 'string' || !entry.projectionVersion.trim())) errors.push('approved projection requires text and version');
  if (!['pending', 'approved'].includes(entry.projectionReviewStatus)) errors.push('invalid projection status');
  if (typeof entry.sourceId !== 'string' || !entry.sourceId.trim()) errors.push('invalid source identity');
  if (!Array.isArray(entry.sourceUrls) || entry.sourceUrls.some(url => typeof url !== 'string')) errors.push('invalid source URLs');
  return errors;
}

/** Invalid approvals are errors, never reviewer rejections or silent omissions. */
export function selectApprovedRows(csvContent) {
  const { header, rows } = parseReviewCsv(csvContent);
  for (const column of ['candidate_id', 'card_number', 'card_name', 'context', 'draft_text', 'draft_tags', 'human_verdict']) {
    if (!header.includes(column)) throw new Error(`Review queue is missing the "${column}" column.`);
  }
  const approved = [];
  const rejected = [];
  const validationErrors = [];
  const inventory = [];
  const slots = new Set();
  const candidates = new Set();
  for (const columns of rows) {
    const at = name => String(columns[header.indexOf(name)] ?? '').trim();
    const candidateId = at('candidate_id');
    const verdict = at('human_verdict').toLowerCase();
    const rawNumber = at('card_number');
    const cardNumber = CARD_NUMBER.test(rawNumber) ? Number(rawNumber) : NaN;
    const context = at('context').toLowerCase();
    inventory.push({ candidateId, cardNumber, cardName: at('card_name'), context });
    if (candidateId && candidates.has(candidateId)) validationErrors.push({ candidateId, verdict: 'duplicate candidate ID' });
    candidates.add(candidateId);
    if (!verdict || verdict === 'pending') continue;
    if (REJECTED_VERDICTS.has(verdict)) {
      if (!validCandidateId(candidateId)) validationErrors.push({ candidateId, verdict: 'invalid rejected candidate ID' });
      else rejected.push({ candidateId, verdict });
      continue;
    }
    if (!APPROVED_VERDICTS.has(verdict)) {
      validationErrors.push({ candidateId, verdict: 'unrecognized human verdict' });
      continue;
    }
    const projectionVerdict = at('projection_verdict').toLowerCase();
    const entry = {
      candidateId, cardNumber, cardName: at('card_name'), context,
      text: at('draft_text'), tags: at('draft_tags').split(/\s+/).filter(Boolean),
      sourceId: at('source_id') || `enriched:${candidateId}`,
      sourceUrls: [at('source_url')].filter(Boolean), sourceUrl: at('source_url'),
      sourceTitle: at('source_title'), sourceMethod: at('source_method'),
      archetypalText: at('projection_text'), projectionVersion: at('projection_version'),
      projectionReviewStatus: APPROVED_VERDICTS.has(projectionVerdict) ? 'approved' : 'pending',
      generatedAt: at('generated_at'), model: at('model')
    };
    const errors = validateEntry(entry);
    if (projectionVerdict && !['pending', ...APPROVED_VERDICTS, ...REJECTED_VERDICTS].includes(projectionVerdict)) errors.push('unrecognized projection verdict');
    if (slots.has(slotOf(entry))) errors.push('duplicate slot: another approved passage covers this card and context');
    if (errors.length) validationErrors.push({ candidateId, verdict: errors.join('; ') });
    else { slots.add(slotOf(entry)); approved.push(entry); }
  }
  return { approved, rejected, validationErrors, inventory };
}

function passageFor(entry) {
  if (entry.passage) return entry.passage;
  return {
    source: 'Tableu Tarot Canon (research-informed interpretation)',
    sourceId: entry.sourceId, sourceUrls: entry.sourceUrls,
    provenance: { sourceTitle: entry.sourceTitle, sourceMethod: entry.sourceMethod, candidateId: entry.candidateId, cardName: entry.cardName, generatedAt: entry.generatedAt || '', model: entry.model || '' },
    archetypalText: entry.archetypalText, projectionVersion: entry.projectionVersion,
    projectionReviewStatus: entry.projectionReviewStatus,
    context: entry.context, text: entry.text, tags: entry.tags
  };
}

export function renderModule(entries) {
  const registry = {};
  const slots = new Set();
  const ids = new Set();
  for (const entry of [...entries].sort((a, b) => a.cardNumber - b.cardNumber || a.context.localeCompare(b.context))) {
    const errors = validateEntry(entry);
    if (slots.has(slotOf(entry)) || ids.has(entry.candidateId)) errors.push('duplicate registry entry');
    if (errors.length) throw new Error(`Registry validation failed: ${errors.join('; ')}`);
    slots.add(slotOf(entry)); ids.add(entry.candidateId);
    registry[entry.cardNumber] ??= { passages: [] };
    registry[entry.cardNumber].passages.push(passageFor(entry));
  }
  return '// GENERATED FILE — reviewed enrichment; regenerate with npm run enrich:apply.\n'
    + `export const ENRICHED_MAJOR_ARCANA_PASSAGES = ${JSON.stringify(registry, null, 2)};\n`;
}

// Read both the old object-literal generator and the new JSON generator as data.
// No eval/import of existing files: executable expressions are never permitted.
function parseModuleData(source) {
  let offset = 0;
  const fail = () => { throw new Error('Generated registry module must contain only the supported data export.'); };
  const skip = () => {
    for (;;) {
      const token = /^(?:\s+|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)/.exec(source.slice(offset));
      if (!token) return;
      offset += token[0].length;
    }
  };
  const consume = token => { skip(); if (!source.startsWith(token, offset)) fail(); offset += token.length; };
  const keyword = token => { consume(token); if (/[\w$]/.test(source[offset] || '')) fail(); };
  function string() {
    const quote = source[offset++];
    let value = '';
    while (offset < source.length) {
      const char = source[offset++];
      if (char === quote) return value;
      if (char === '\n' || char === '\r' || char.charCodeAt(0) < 32) fail();
      if (char !== '\\') { value += char; continue; }
      const escape = source[offset++];
      const escapes = { '"': '"', "'": "'", '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
      if (Object.hasOwn(escapes, escape)) value += escapes[escape];
      else if (escape === 'u' && /^[0-9a-f]{4}$/i.test(source.slice(offset, offset + 4))) {
        value += String.fromCharCode(parseInt(source.slice(offset, offset + 4), 16)); offset += 4;
      } else fail();
    }
    fail();
  }
  function key() {
    skip();
    if (source[offset] === '"' || source[offset] === "'") return string();
    const match = /^(?:[A-Za-z_$][\w$]*|0|[1-9]\d*)/.exec(source.slice(offset));
    if (!match) fail();
    offset += match[0].length;
    return match[0];
  }
  function value(depth = 0) {
    if (depth > 20) fail();
    skip();
    if (source[offset] === '"' || source[offset] === "'") return string();
    if (source[offset] === '{' || source[offset] === '[') {
      const object = source[offset++] === '{';
      const result = object ? Object.create(null) : [];
      const end = object ? '}' : ']';
      skip();
      while (source[offset] !== end) {
        if (object) { const name = key(); consume(':'); if (Object.hasOwn(result, name)) fail(); result[name] = value(depth + 1); }
        else result.push(value(depth + 1));
        skip();
        if (source[offset] !== ',') break;
        offset++; skip();
      }
      consume(end);
      return result;
    }
    const literal = /^(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(offset));
    if (!literal) fail();
    offset += literal[0].length;
    return JSON.parse(literal[0]);
  }
  keyword('export'); keyword('const'); keyword('ENRICHED_MAJOR_ARCANA_PASSAGES'); consume('=');
  const registry = value();
  skip(); if (source[offset] === ';') offset++;
  skip(); if (offset !== source.length) fail();
  return registry;
}

function entriesFromRegistry(registry) {
  if (!isRecord(registry)) throw new Error('Invalid generated registry shape.');
  const entries = [];
  const ids = new Set();
  const slots = new Set();
  for (const [key, value] of Object.entries(registry)) {
    if (!CARD_NUMBER.test(key) || Number(key) > 21 || !isRecord(value) || !Array.isArray(value.passages)) throw new Error('Invalid generated registry card identity/shape.');
    for (const passage of value.passages) {
      if (!isRecord(passage) || !isRecord(passage.provenance)) throw new Error('Invalid generated registry passage provenance.');
      const entry = {
        cardNumber: Number(key), cardName: passage.provenance.cardName || MAJOR_ARCANA.find(card => card.number === Number(key))?.name,
        candidateId: passage.provenance.candidateId,
        context: passage.context, text: passage.text, tags: passage.tags,
        sourceId: passage.sourceId, sourceUrls: passage.sourceUrls,
        sourceUrl: passage.sourceUrl || passage.sourceUrls?.[0] || '',
        sourceTitle: passage.provenance.sourceTitle || '', sourceMethod: passage.provenance.sourceMethod || '',
        archetypalText: passage.archetypalText || '', projectionVersion: passage.projectionVersion || '',
        projectionReviewStatus: passage.projectionReviewStatus || 'pending',
        generatedAt: passage.provenance.generatedAt || '', model: passage.provenance.model || '',
        passage: JSON.parse(JSON.stringify(passage))
      };
      if (validateEntry(entry).length || !Array.isArray(entry.sourceUrls) || entry.sourceUrls.some(url => typeof url !== 'string') || ids.has(entry.candidateId) || slots.has(slotOf(entry))) throw new Error('Generated registry validation failed.');
      entries.push(entry); ids.add(entry.candidateId); slots.add(slotOf(entry));
    }
  }
  return entries;
}

function provenanceFor(entry) {
  return Object.fromEntries(['candidateId', 'cardNumber', 'cardName', 'context', 'sourceUrl', 'sourceTitle', 'sourceId', 'sourceUrls', 'sourceMethod', 'projectionVersion', 'projectionReviewStatus', 'archetypalText', 'generatedAt', 'model'].map(key => [key, entry[key]]).concat([['textSha256', sha256(entry.text)]]));
}

async function readOptional(file) {
  try { return await fs.readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function loadCurrent(outPath, provenancePath) {
  const recoveryPath = `${outPath}.apply-recovery.json`;
  if (await readOptional(recoveryPath) !== null) throw new Error(`Unfinished enrichment publication; inspect ${recoveryPath} and restore its recorded prior pair before applying.`);
  const module = await readOptional(outPath);
  const provenance = await readOptional(provenancePath);
  if (module === null) {
    if (provenance !== null) throw new Error('Provenance/module identity mismatch: registry is missing.');
    return { entries: [], module, provenance, outputHash: null, boundProvenance: false };
  }
  const entries = entriesFromRegistry(parseModuleData(module));
  const outputHash = sha256(module);
  if (provenance === null) {
    if (entries.length) throw new Error('Generated registry provenance is missing; preserve and reconcile the prior pair.');
    return { entries, module, provenance, outputHash, boundProvenance: false };
  }
  const record = JSON.parse(provenance);
  if (!isRecord(record) || !Array.isArray(record.applied)) throw new Error('Invalid provenance record.');
  if (record.schemaVersion !== undefined && record.schemaVersion !== 1 || record.moduleSha256 !== undefined && record.schemaVersion !== 1) throw new Error('Invalid provenance version/hash contract.');
  if (record.schemaVersion === 1 && !DIGEST.test(record.moduleSha256)) throw new Error('Provenance module hash is missing or invalid.');
  if (record.moduleSha256 !== undefined && (!DIGEST.test(record.moduleSha256) || record.moduleSha256 !== outputHash)) throw new Error('Provenance/module hash mismatch; preserve and reconcile the prior pair.');
  // Legacy provenance had no whole-module hash. Its complete per-entry identity
  // must agree before the existing authoritative module can be adopted intact.
  if (record.applied.length !== entries.length) throw new Error('Provenance inventory mismatch.');
  for (const entry of entries) {
    const prior = record.applied.filter(row => row.candidateId === entry.candidateId);
    const expected = provenanceFor(entry);
    const required = record.schemaVersion === 1 ? Object.keys(expected) : ['candidateId', 'cardNumber', 'cardName', 'context', 'sourceId', 'sourceUrls', 'sourceTitle', 'sourceMethod', 'projectionVersion', 'projectionReviewStatus', 'archetypalText'];
    if (prior.length !== 1 || required.some(key => JSON.stringify(prior[0][key]) !== JSON.stringify(expected[key]))) throw new Error('Provenance entry identity mismatch.');
  }
  return { entries, module, provenance, outputHash, boundProvenance: record.schemaVersion === 1 };
}

async function verifyCompleteness(manifest, selection, queueContent, current) {
  if (typeof manifest === 'string') manifest = JSON.parse(await fs.readFile(path.resolve(manifest), 'utf8'));
  if (!isRecord(manifest) || manifest.version !== 1 || manifest.complete !== true) throw new Error('Replacement requires a version-1 complete queue manifest.');
  if (manifest.queueSha256 !== sha256(queueContent) || manifest.previousOutputHash !== current.outputHash) throw new Error('Completeness manifest queue/output identity mismatch.');
  const inventory = selection.inventory;
  if (inventory.some(row => !validCandidateId(row.candidateId) || !Number.isInteger(row.cardNumber) || row.cardNumber < 0 || row.cardNumber > 21 || !row.context || normalizeName(row.cardName) !== normalizeName(MAJOR_ARCANA.find(card => card.number === row.cardNumber)?.name || ''))) throw new Error('Replacement queue inventory is incomplete.');
  const sameSet = (actual, expected) => Array.isArray(actual) && actual.every(value => typeof value === 'string') && new Set(actual).size === actual.length && JSON.stringify([...actual].sort()) === JSON.stringify([...new Set(expected)].sort());
  const candidateIds = inventory.map(entry => entry.candidateId);
  if (current.entries.some(entry => !candidateIds.includes(entry.candidateId)) || !sameSet(manifest.candidateIds, candidateIds) || !sameSet(manifest.slots, [...inventory, ...current.entries].map(slotOf))) throw new Error('Completeness manifest does not cover the complete applied and queue inventory.');
}

async function validateStagedModule(file, expected) {
  const source = await fs.readFile(file, 'utf8');
  if (source !== expected) throw new Error('Staged module identity mismatch.');
  entriesFromRegistry(parseModuleData(source));
  // Parse/import only the already validated, self-contained staged data module.
  const imported = await import(`${pathToFileURL(file).href}?digest=${sha256(source)}`);
  if (JSON.stringify(imported.ENRICHED_MAJOR_ARCANA_PASSAGES) !== JSON.stringify(parseModuleData(source))) throw new Error('Staged module import mismatch.');
}

async function publishPair({ outPath, provenancePath, module, provenance, current }) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(provenancePath), { recursive: true });
  const lockPath = `${outPath}.apply.lock`;
  const lock = await fs.open(lockPath, 'wx').catch(error => { if (error.code === 'EEXIST') throw new Error(`Enrichment apply lock exists at ${lockPath}; verify its owner/recovery before retrying.`); throw error; });
  const token = randomUUID();
  const stagedModule = `${outPath}.stage-${token}.mjs`;
  const stagedProvenance = `${provenancePath}.stage-${token}`;
  const backupModule = `${outPath}.backup-${token}`;
  const backupProvenance = `${provenancePath}.backup-${token}`;
  const recoveryPath = `${outPath}.apply-recovery.json`;
  let recoveryWritten = false;
  let committed = false;
  let restored = false;
  try {
    const fresh = await loadCurrent(outPath, provenancePath);
    if (fresh.module !== current.module || fresh.provenance !== current.provenance) throw new Error('Current output identity changed before publication.');
    await fs.writeFile(stagedModule, module, { flag: 'wx' });
    await validateStagedModule(stagedModule, module);
    await fs.writeFile(stagedProvenance, provenance, { flag: 'wx' });
    if (current.module !== null) await fs.writeFile(backupModule, current.module, { flag: 'wx' });
    if (current.provenance !== null) await fs.writeFile(backupProvenance, current.provenance, { flag: 'wx' });
    await fs.writeFile(recoveryPath, `${JSON.stringify({ version: 1, outPath, provenancePath, backupModule: current.module === null ? null : backupModule, backupProvenance: current.provenance === null ? null : backupProvenance, previousOutputHash: current.outputHash, previousProvenanceHash: current.provenance === null ? null : sha256(current.provenance), nextOutputHash: sha256(module), nextProvenanceHash: sha256(provenance) }, null, 2)}\n`, { flag: 'wx' });
    recoveryWritten = true;
    await fs.rename(stagedModule, outPath);
    await fs.rename(stagedProvenance, provenancePath);
    committed = true;
  } catch (error) {
    if (recoveryWritten) {
      try {
        for (const [destination, original] of [[outPath, current.module], [provenancePath, current.provenance]]) {
          if (original === null) await fs.rm(destination, { force: true });
          else { const restore = `${destination}.restore-${token}`; await fs.writeFile(restore, original, { flag: 'wx' }); await fs.rename(restore, destination); }
        }
        restored = true;
      } catch (restoreError) {
        throw new AggregateError([error, restoreError], `Enrichment publication failed; recovery required from ${recoveryPath}.`);
      }
    }
    throw error;
  } finally {
    try {
      await lock.close();
      // Keep prior backups while a recovery marker can still request them.
      // Once committed/restored, clear that marker before removing its backups.
      if (!recoveryWritten || committed || restored) {
        for (const file of [stagedModule, stagedProvenance, ...(recoveryWritten ? [recoveryPath] : []), backupModule, backupProvenance]) await fs.rm(file, { force: true });
      }
    } finally {
      // Cleanup failure must not leave an otherwise valid pair locked forever.
      await fs.rm(lockPath, { force: true });
    }
  }
}

export async function applyCandidates({ queue = DEFAULT_QUEUE, out = DEFAULT_OUTPUT, provenance = DEFAULT_PROVENANCE, mode = 'merge', completenessManifest = null, dryRun = false, log = console.log } = {}) {
  if (!['merge', 'replace'].includes(mode)) throw new Error('Apply mode must be merge or replace.');
  const queuePath = path.resolve(queue);
  const outPath = path.resolve(out);
  const provenancePath = path.resolve(provenance);
  if (new Set([queuePath, outPath, provenancePath]).size !== 3) throw new Error('Queue, output, and provenance paths must be distinct.');
  let csvContent;
  try { csvContent = await fs.readFile(queuePath, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') throw new Error(`Review queue not found at ${queuePath}.`); throw error; }
  const selection = selectApprovedRows(csvContent);
  if (selection.validationErrors.length) throw new Error(`Review queue validation failed: ${selection.validationErrors.map(entry => entry.verdict).join('; ')}`);
  const current = await loadCurrent(outPath, provenancePath);
  if (mode === 'replace') await verifyCompleteness(completenessManifest, selection, csvContent, current);
  const rejectedIds = new Set(selection.rejected.map(entry => entry.candidateId));
  const desired = new Map((mode === 'merge' ? current.entries.filter(entry => !rejectedIds.has(entry.candidateId)) : []).map(entry => [slotOf(entry), entry]));
  for (const entry of selection.approved) desired.set(slotOf(entry), entry);
  const entries = [...desired.values()];
  const candidateModule = renderModule(entries);
  entriesFromRegistry(parseModuleData(candidateModule));
  // Dry runs use the same safe parse/import validation without filesystem writes.
  await import(`data:text/javascript,${encodeURIComponent(candidateModule)}`);
  const previous = new Map(current.entries.map(entry => [slotOf(entry), entry]));
  const same = (left, right) => JSON.stringify(passageFor(left)) === JSON.stringify(passageFor(right));
  const removed = current.entries.filter(entry => !entries.some(next => next.candidateId === entry.candidateId)).length;
  const result = {
    applied: entries.length, rejected: selection.rejected.length, removed,
    added: entries.filter(entry => !previous.has(slotOf(entry))).length,
    updated: entries.filter(entry => previous.has(slotOf(entry)) && !same(entry, previous.get(slotOf(entry)))).length,
    preserved: entries.filter(entry => previous.has(slotOf(entry)) && same(entry, previous.get(slotOf(entry)))).length,
    revoked: current.entries.filter(entry => rejectedIds.has(entry.candidateId)).length,
    cleared: current.entries.length > 0 && entries.length === 0,
    dryRun, outputHash: sha256(candidateModule)
  };
  const unchanged = result.added === 0 && result.updated === 0 && removed === 0;
  if (unchanged && current.module !== null && current.boundProvenance) result.outputHash = current.outputHash;
  if (!dryRun && (!unchanged || current.module === null || !current.boundProvenance)) {
    const record = { schemaVersion: 1, generatedAt: new Date().toISOString(), moduleSha256: result.outputHash, applied: entries.map(provenanceFor) };
    await publishPair({ outPath, provenancePath, module: candidateModule, provenance: `${JSON.stringify(record, null, 2)}\n`, current });
  }
  log(`${dryRun ? 'Dry run: ' : ''}${result.applied} applied; ${result.added} added; ${result.updated} updated; ${result.preserved} preserved; ${result.revoked} revoked; ${result.removed} removed; cleared=${result.cleared}; module=${result.outputHash}`);
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(USAGE); return; }
  if (options.check) {
    const current = await loadCurrent(path.resolve(options.out), path.resolve(options.provenance));
    if (current.module === null) throw new Error('Generated registry module is missing.');
    console.log(`Validated ${current.entries.length} applied entries; module=${current.outputHash}`);
    return;
  }
  await applyCandidates(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
