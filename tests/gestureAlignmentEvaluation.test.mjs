import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import * as qualification from '../scripts/evaluation/lib/readingCueQualification.mjs';

const root = resolve(import.meta.dirname, '..');
const currentPath = 'data/evaluations/narrative-samples.json';
const archivedPath = 'scripts/evaluation/fixtures/readingCueSources/narrative-samples.20261007.json';
const archivedSha256 = 'b30c506a81f7cb360fb457fc2bd4825059d558b3a1f8862d5f0ab23f383fbe49';

async function corpusFixture(t, { current, archive } = {}) {
  const fixtureRoot = await mkdtemp(resolve(tmpdir(), 'gesture-corpus-'));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  for (const [path, bytes] of [[currentPath, current], [archivedPath, archive]]) {
    if (bytes === undefined) continue;
    await mkdir(dirname(resolve(fixtureRoot, path)), { recursive: true });
    await writeFile(resolve(fixtureRoot, path), bytes);
  }
  return fixtureRoot;
}

test('alignment CLI evaluates the exact archived labels after the current narrative corpus changes', async t => {
  const outputRoot = await mkdtemp(resolve(tmpdir(), 'gesture-evaluation-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const output = resolve(outputRoot, 'result.json');
  const result = spawnSync(process.execPath, ['scripts/evaluation/evaluateGestureAlignment.mjs', `--output=${output}`], {
    cwd: root, encoding: 'utf8', timeout: 30000
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(report.provenance.recordedPath, archivedPath);
  assert.equal(report.provenance.recordedSha256, archivedSha256);
  const { recorded, independent } = report.current.summary;
  assert.deepEqual([recorded.identityMatched, recorded.identityExpected], [51, 51]);
  assert.deepEqual([recorded.selectedLiteralMatched, recorded.selectedLiteralExpected], [23, 41]);
  assert.deepEqual([recorded.englishRwsSelectedMatched, recorded.englishRwsSelectedExpected], [23, 36]);
  assert.equal(recorded.interpretationAssociations, 0);
  assert.equal(recorded.personalContextAssociations, 0);
  assert.deepEqual([independent.identityMatched, independent.identityExpected], [46, 46]);
  assert.deepEqual([independent.truePositives, independent.expectedDetails], [14, 24]);
  assert.equal(independent.precision, 1);
  assert.equal(independent.negativePassages, 22);
  assert.equal(independent.negativePassagesWithFalsePositive, 0);
});

test('a current corpus with the frozen digest does not depend on an archive being present', async t => {
  const current = await readFile(resolve(root, archivedPath));
  const fixtureRoot = await corpusFixture(t, { current });
  const loaded = await qualification.loadReadingCueRecordedCorpus({ root: fixtureRoot });
  assert.equal(loaded.resolvedPath, currentPath);
  assert.deepEqual(loaded.bytes, current);
});

test('a changed current corpus resolves only the digest-verified archive', async t => {
  const archive = await readFile(resolve(root, archivedPath));
  const fixtureRoot = await corpusFixture(t, { current: '{"samples":[]}', archive });
  const loaded = await qualification.loadReadingCueRecordedCorpus({ root: fixtureRoot });
  assert.equal(loaded.resolvedPath, archivedPath);
  assert.deepEqual(loaded.bytes, archive);
});

test('a changed current corpus and corrupt archive fail before returning narrative text', async t => {
  const fixtureRoot = await corpusFixture(t, { current: '{"samples":[]}', archive: '{"samples":[]}' });
  await assert.rejects(qualification.loadReadingCueRecordedCorpus({ root: fixtureRoot }), /Source file hash mismatch/);
});

test('archive fallback cannot hide a mismatch for a different requested source digest', async t => {
  const archive = await readFile(resolve(root, archivedPath));
  const fixtureRoot = await corpusFixture(t, { current: '{"samples":[]}', archive });
  await assert.rejects(qualification.loadReadingCueSource({
    root: fixtureRoot, path: currentPath, sha256: '0'.repeat(64)
  }), /Source file hash mismatch/);
});

test('source resolution rejects a caller path outside the repository before reading it', async () => {
  await assert.rejects(qualification.loadReadingCueSource({
    root, path: '../outside.json', sha256: archivedSha256
  }), /Source must be repo-relative/);
});
