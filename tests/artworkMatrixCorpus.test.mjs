import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { canonicalVisualCueJSON } from '../shared/contracts/visualCueBatches.js';
import { loadArtworkMatrixReadingCase } from '../e2e/helpers/artworkMatrixCorpus.mjs';

const root = resolve(import.meta.dirname, '..');
const manifestPath = 'scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json';
const corpusPath = 'data/evaluations/narrative-samples.json';
const archivePath = 'scripts/evaluation/fixtures/readingCueSources/narrative-samples.20261007.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const directory = await mkdtemp(resolve(tmpdir(), 'artwork-matrix-corpus-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifestBytes = await readFile(resolve(root, manifestPath));
  const manifest = JSON.parse(manifestBytes);
  const entry = manifest.cases.find(value => value.id === 'celtic-deep-shift');
  for (const path of [manifestPath, corpusPath, archivePath, ...entry.cards.map(card => card.artwork.assetPath)]) {
    await mkdir(dirname(resolve(directory, path)), { recursive: true });
    await writeFile(resolve(directory, path), await readFile(resolve(root, path)));
  }
  return { directory, manifest, manifestBytes };
}

test('artwork matrix binds exact historical Celtic prose through the verified archive without qualifying runtime', async t => {
  const { directory, manifest, manifestBytes } = await fixture(t);
  const currentBytes = await readFile(resolve(directory, corpusPath));
  const archiveBytes = await readFile(resolve(directory, archivePath));
  const expected = manifest.cases.find(value => value.id === 'celtic-deep-shift');
  assert.notEqual(sha(JSON.parse(currentBytes).samples[4].reading), expected.rawSha256);
  const { caseData, sourceBinding } = await loadArtworkMatrixReadingCase({ root: directory });
  assert.equal(caseData.raw, JSON.parse(archiveBytes).samples[4].reading);
  assert.equal(sha(caseData.raw), expected.rawSha256);
  assert.deepEqual(caseData.opportunities, expected.opportunities);
  assert.deepEqual(caseData.cards, expected.cards);
  assert.deepEqual(caseData.provenance, expected.provenance);
  assert.equal(sourceBinding.qualificationEvidence, false);
  assert.equal(sourceBinding.scope, 'offline-artwork-corpus');
  assert.equal(sourceBinding.historicalManifestSha256, manifest.manifestSha256);
  assert.equal(sourceBinding.logicalSourcePath, corpusPath);
  assert.equal(sourceBinding.resolvedSourcePath, archivePath);
  assert.equal(sourceBinding.sourceFileSha256, sha(archiveBytes));
  assert.equal(sourceBinding.rawSha256, expected.rawSha256);
  assert.notEqual(caseData.labelProvenance.manifestSha256, manifest.manifestSha256);
  assert.deepEqual(await readFile(resolve(directory, manifestPath)), manifestBytes);
  assert.deepEqual(await readFile(resolve(directory, corpusPath)), currentBytes);
  assert.deepEqual(await readFile(resolve(directory, archivePath)), archiveBytes);
});

test('artwork matrix rejects a modified historical manifest before projecting its source', async t => {
  const { directory, manifest } = await fixture(t);
  manifest.cases.find(value => value.id === 'celtic-deep-shift').rawSha256 = '0'.repeat(64);
  await writeFile(resolve(directory, manifestPath), JSON.stringify(manifest));
  await assert.rejects(loadArtworkMatrixReadingCase({ root: directory }), /Historical qualification manifest integrity/);
});

test('artwork matrix rejects modified archived bytes', async t => {
  const { directory } = await fixture(t);
  await writeFile(resolve(directory, archivePath), '{"samples":[]}');
  await assert.rejects(loadArtworkMatrixReadingCase({ root: directory }), /Source file hash mismatch: scripts\/evaluation\/fixtures\/readingCueSources\/narrative-samples\.20261007\.json/);
});

test('artwork matrix fails closed when the required archive is missing', async t => {
  const { directory } = await fixture(t);
  await rm(resolve(directory, archivePath));
  await assert.rejects(loadArtworkMatrixReadingCase({ root: directory }), error => error.code === 'ENOENT');
});

test('artwork matrix preserves the archive exception for only its declared historical corpus hash', async t => {
  const { directory, manifest } = await fixture(t);
  const entry = manifest.cases.find(value => value.id === 'celtic-deep-shift');
  const source = manifest.sourceDigests.find(value => value.path === corpusPath);
  source.sha256 = '0'.repeat(64);
  entry.provenance.sourceFileSha256 = source.sha256;
  const { manifestSha256: _previous, ...content } = manifest;
  manifest.manifestSha256 = sha(canonicalVisualCueJSON(content));
  await writeFile(resolve(directory, manifestPath), JSON.stringify(manifest));
  await assert.rejects(loadArtworkMatrixReadingCase({ root: directory }), /Source file hash mismatch: data\/evaluations\/narrative-samples\.json/);
});

test('artwork matrix still verifies each referenced artwork asset', async t => {
  const { directory, manifest } = await fixture(t);
  const assetPath = manifest.cases.find(value => value.id === 'celtic-deep-shift').cards[0].artwork.assetPath;
  await writeFile(resolve(directory, assetPath), 'modified artwork');
  await assert.rejects(loadArtworkMatrixReadingCase({ root: directory }), /Artwork hash mismatch: celtic-deep-shift/);
});

test('artwork matrix checks the exact raw hash even in an internally consistent source projection', async t => {
  const { directory, manifest } = await fixture(t);
  manifest.cases.find(value => value.id === 'celtic-deep-shift').rawSha256 = '0'.repeat(64);
  const { manifestSha256: _previous, ...content } = manifest;
  manifest.manifestSha256 = sha(canonicalVisualCueJSON(content));
  await writeFile(resolve(directory, manifestPath), JSON.stringify(manifest));
  await assert.rejects(loadArtworkMatrixReadingCase({ root: directory }), /Raw text hash mismatch: celtic-deep-shift/);
});

test('artwork matrix retains original source resolution when the declared historical corpus is current', async t => {
  const { directory } = await fixture(t);
  await writeFile(resolve(directory, corpusPath), await readFile(resolve(directory, archivePath)));
  await rm(resolve(directory, archivePath));
  const { caseData, sourceBinding } = await loadArtworkMatrixReadingCase({ root: directory });
  assert.equal(sourceBinding.resolvedSourcePath, corpusPath);
  assert.equal(sourceBinding.rawSha256, sha(caseData.raw));
  assert.equal(sourceBinding.qualificationEvidence, false);
});
