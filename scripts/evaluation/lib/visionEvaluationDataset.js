import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MAJOR_ARCANA } from '../../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../../src/data/minorArcana.js';
import { DECK_PROFILES } from '../../../shared/vision/deckProfiles.js';

const cards = [...MAJOR_ARCANA, ...MINOR_ARCANA];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function imageFiles(directory, recursive = false) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory() && recursive) files.push(...await imageFiles(location, true));
    else if (entry.isFile() && /\.(png|jpe?g)$/i.test(entry.name)) files.push(location);
  }
  return files;
}

// Hashes detect exact copies, including renamed files. They do not prove that
// a re-encoded/edited reference is a phone photo: corpus provenance needs review.
export async function loadVisionDataset({ deckStyle = 'rws-1909', manifestPath = null, referenceRoot = path.resolve('public/images/cards'), scope = 'all', limit = null } = {}) {
  const profile = DECK_PROFILES[deckStyle];
  if (!profile) throw new Error(`Unknown evaluation deck: ${deckStyle}`);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) throw new Error('limit must be a positive integer');
  const scopedCards = scope === 'major' ? MAJOR_ARCANA : cards;
  if (!['all', 'major'].includes(scope)) throw new Error('scope must be all or major');

  if (!manifestPath) {
    const expectedByFile = new Map(scopedCards.map((card) => [path.basename(profile.imageResolver(card)), card.name]));
    const files = await imageFiles(path.join(referenceRoot, profile.assetScanDir));
    const selected = files.filter((file) => expectedByFile.has(path.basename(file))).slice(0, limit ?? files.length);
    if (!selected.length) throw new Error('No reference samples found for the requested deck');
    const inputs = await Promise.all(selected.map(async (source) => ({ source, label: path.basename(source), expected: expectedByFile.get(path.basename(source)), sha256: sha256(await fs.readFile(source)) })));
    return { inputs, provenance: { datasetKind: 'reference-art', labelSource: 'reference-file-map', referenceOverlapCount: inputs.length, manifestSha256: null } };
  }

  const manifestBytes = await fs.readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  if (manifest.schemaVersion !== 1 || !['held-out-photos', 'synthetic'].includes(manifest.kind)) throw new Error('Unsupported dataset schema/kind');
  if (manifest.deckStyle !== deckStyle) throw new Error('Manifest deck does not match requested deck');
  const expectedLabelSource = manifest.kind === 'held-out-photos' ? 'independent-human' : 'synthetic-derived';
  if (manifest.labelSource !== expectedLabelSource) throw new Error(`Dataset labelSource must be ${expectedLabelSource}`);
  if (!Array.isArray(manifest.samples) || manifest.samples.length === 0) throw new Error('Dataset samples must not be empty');

  const referenceHashes = new Set(await Promise.all((await imageFiles(referenceRoot, true)).map(async (file) => sha256(await fs.readFile(file)))));
  const validNames = new Set(scopedCards.map((card) => card.name));
  const hashes = new Set();
  const ids = new Set();
  const inputs = [];
  for (const sample of manifest.samples) {
    if (!sample.id || ids.has(sample.id)) throw new Error('Missing/duplicate sample id');
    if (!validNames.has(sample.expected)) throw new Error(`Unknown expected card or card outside scope: ${sample.expected}`);
    if (typeof sample.image !== 'string' || !sample.image || /^[a-z]+:/i.test(sample.image)) throw new Error('Dataset images must be local file paths');
    const source = path.resolve(path.dirname(manifestPath), sample.image);
    const hash = sha256(await fs.readFile(source));
    if (hash !== sample.sha256) throw new Error(`Image hash mismatch for ${sample.id}`);
    if (hashes.has(hash)) throw new Error(`Duplicate image for ${sample.id}`);
    if (referenceHashes.has(hash)) throw new Error(`Reference image overlap for ${sample.id}`);
    hashes.add(hash);
    ids.add(sample.id);
    inputs.push({ source, label: sample.id, expected: sample.expected, sha256: hash });
  }
  return {
    inputs: inputs.slice(0, limit ?? inputs.length),
    provenance: { datasetKind: manifest.kind, datasetId: manifest.id || null, labelSource: manifest.labelSource, manifestSha256: sha256(manifestBytes), referenceOverlapCount: 0 }
  };
}

export function visionSourceState() {
  const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  return {
    sourceRevision: git(['rev-parse', 'HEAD']),
    // Evaluation output changes are expected; source changes are not.
    sourceDirty: Boolean(git(['status', '--porcelain', '--untracked-files=normal', '--', '.', ':(exclude)data/evaluations/**']))
  };
}
