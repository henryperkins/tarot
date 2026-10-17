import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { loadReadingCueCases } from '../scripts/evaluation/lib/readingCueQualification.mjs';
import { createReadingCueTestManifest } from './helpers/readingCueQualificationFixtures.mjs';

const root = resolve(import.meta.dirname, '..');
const corpusPath = 'data/evaluations/narrative-samples.json';
const archivePath = 'scripts/evaluation/fixtures/readingCueSources/narrative-samples.20261007.json';
const corpusSha256 = 'b30c506a81f7cb360fb457fc2bd4825059d558b3a1f8862d5f0ab23f383fbe49';
const manifestPath = 'scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function sourceFixture(t, { currentBytes = '{"samples":[{"reading":"Refreshed corpus prose."}]}',
  archiveBytes, archiveMissing = false, logicalPath = corpusPath, expectedSha256 = corpusSha256 } = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), 'reading-cue-archived-source-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(resolve(root, manifestPath), 'utf8'));
  delete manifest.manifestSha256;
  const entry = manifest.cases.find(c => c.id === 'single-new-role');
  entry.cards = entry.cards.map(({ artwork: _artwork, ...card }) => card);
  entry.opportunities = entry.opportunities.filter(opportunity => opportunity.kind === 'identity');
  entry.provenance.sourcePath = logicalPath;
  entry.provenance.sourceFileSha256 = expectedSha256;
  manifest.sourceDigests = [{ path: logicalPath, sha256: expectedSha256 }];
  manifest.cases = [entry];
  await mkdir(dirname(resolve(directory, logicalPath)), { recursive: true });
  await writeFile(resolve(directory, logicalPath), currentBytes);
  if (!archiveMissing) {
    await mkdir(dirname(resolve(directory, archivePath)), { recursive: true });
    await writeFile(resolve(directory, archivePath), archiveBytes ?? await readFile(resolve(root, archivePath)));
  }
  return { directory, manifest };
}

test('explicit test runtime copy retains exact archived prose and unchanged frozen labels', async () => {
  const manifestBytes = await readFile(resolve(root, manifestPath));
  const currentBytes = await readFile(resolve(root, corpusPath));
  const archivedBytes = await readFile(resolve(root, archivePath));
  assert.equal(sha(archivedBytes), corpusSha256);
  assert.notEqual(sha(currentBytes), corpusSha256);
  const fixture = await createReadingCueTestManifest();
  const historical = JSON.parse(manifestBytes);
  const { manifestSha256: _fixtureHash, unitTestRuntime, ...restored } = structuredClone(fixture);
  restored.sourceDigests.find(source => source.path === 'src/data/cardGestureArtwork.js').sha256
    = historical.sourceDigests.find(source => source.path === 'src/data/cardGestureArtwork.js').sha256;
  const { manifestSha256: _historicalHash, ...historicalContent } = historical;
  assert.deepEqual(restored, historicalContent);
  assert.deepEqual(unitTestRuntime, { qualificationEvidence: false, historicalManifestSha256: historical.manifestSha256,
    refreshedRuntimePaths: ['src/data/cardGestureArtwork.js'] });
  const cases = await loadReadingCueCases({ root, manifest: fixture });
  const historicalCase = cases.find(c => c.id === 'single-new-role');
  assert.equal(cases.length, 62);
  assert.equal(historicalCase.raw, JSON.parse(archivedBytes).samples[0].reading);
  assert.equal(historicalCase.rawSha256, sha(historicalCase.raw));
  assert.equal(historicalCase.provenance.sourcePath, corpusPath);
  assert.equal(historicalCase.provenance.sourceFileSha256, corpusSha256);
  assert.equal(historicalCase.labelProvenance.resolvedSourcePath, archivePath);
  assert.equal(historicalCase.labelProvenance.manifestSha256,
    fixture.manifestSha256);
  assert.notEqual(fixture.manifestSha256, historical.manifestSha256);
  assert.deepEqual(await readFile(resolve(root, manifestPath)), manifestBytes);
  assert.deepEqual(await readFile(resolve(root, corpusPath)), currentBytes);
});

test('the historical qualification manifest still refuses changed artwork runtime before loading prose', async () => {
  const historical = JSON.parse(await readFile(resolve(root, manifestPath), 'utf8'));
  const pin = historical.sourceDigests.find(source => source.path === 'src/data/cardGestureArtwork.js');
  assert.notEqual(sha(await readFile(resolve(root, pin.path))), pin.sha256);
  await assert.rejects(loadReadingCueCases({ root, manifest: manifestPath }),
    error => error.message === `Source file hash mismatch: ${pin.path}`);
});

test('only the declared corpus path and historical hash resolve archived bytes', async t => {
  const { directory, manifest } = await sourceFixture(t);
  const [entry] = await loadReadingCueCases({ root: directory, manifest });
  assert.equal(entry.rawSha256, sha(entry.raw));
  assert.equal(entry.labelProvenance.resolvedSourcePath, archivePath);
  assert.equal(entry.provenance.sourcePath, corpusPath);
});

test('tampered archived bytes fail before source fields are interpreted', async t => {
  const { directory, manifest } = await sourceFixture(t, { archiveBytes: '{"samples":[{"reading":"Changed archived prose."}]}' });
  await assert.rejects(loadReadingCueCases({ root: directory, manifest }),
    error => error.message === `Source file hash mismatch: ${archivePath}`);
});

test('missing archived bytes fail closed when the current corpus no longer matches', async t => {
  const { directory, manifest } = await sourceFixture(t, { archiveMissing: true });
  await assert.rejects(loadReadingCueCases({ root: directory, manifest }),
    error => error.code === 'ENOENT' && error.path === resolve(directory, archivePath));
});

test('matching current corpus needs no archive and records the original resolution', async t => {
  const archivedBytes = await readFile(resolve(root, archivePath));
  const { directory, manifest } = await sourceFixture(t, { currentBytes: archivedBytes, archiveMissing: true });
  const [entry] = await loadReadingCueCases({ root: directory, manifest });
  assert.equal(entry.labelProvenance.resolvedSourcePath, corpusPath);
  assert.equal(entry.rawSha256, sha(entry.raw));
});

test('a different corpus hash cannot select the historical archive', async t => {
  const { directory, manifest } = await sourceFixture(t, { expectedSha256: '0'.repeat(64) });
  await assert.rejects(loadReadingCueCases({ root: directory, manifest }),
    error => error.message === `Source file hash mismatch: ${corpusPath}`);
});

for (const logicalPath of ['src/data/cardGestureArtwork.js', 'functions/lib/visualCueProvider.js',
  'public/images/cards/rws-vector/major-00-fool.webp', 'unrelated.json']) {
  test(`historical corpus bytes cannot override another source: ${logicalPath}`, async t => {
    const { directory, manifest } = await sourceFixture(t, { logicalPath });
    await assert.rejects(loadReadingCueCases({ root: directory, manifest }),
      error => error.message === `Source file hash mismatch: ${logicalPath}`);
  });
}
