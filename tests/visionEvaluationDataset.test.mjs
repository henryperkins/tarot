import assert from 'node:assert/strict';
import { it } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadVisionDataset } from '../scripts/evaluation/lib/visionEvaluationDataset.js';

async function setup(t, { kind = 'held-out-photos', photo = 'phone image bytes', reference = 'reference art bytes' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'vision-dataset-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const referenceRoot = join(root, 'references');
  await mkdir(referenceRoot);
  await writeFile(join(referenceRoot, 'RWS1909_-_00_Fool.jpeg'), reference);
  await writeFile(join(root, 'phone.jpg'), photo);
  const manifest = { schemaVersion: 1, id: 'test-corpus', kind, labelSource: kind === 'synthetic' ? 'synthetic-derived' : 'independent-human', deckStyle: 'rws-1909', samples: [{ id: 'photo-1', image: 'phone.jpg', expected: 'The Fool', sha256: createHash('sha256').update(photo).digest('hex') }] };
  const manifestPath = join(root, 'manifest.json');
  const save = () => writeFile(manifestPath, JSON.stringify(manifest));
  await save();
  return { root, referenceRoot, manifest, manifestPath, save };
}

it('labels default reference images as a wiring check with explicit expected identities', async (t) => {
  const fixture = await setup(t);
  const dataset = await loadVisionDataset({ deckStyle: 'rws-1909', referenceRoot: fixture.referenceRoot });
  assert.equal(dataset.provenance.datasetKind, 'reference-art');
  assert.equal(dataset.provenance.referenceOverlapCount, 1);
  assert.equal(dataset.inputs[0].expected, 'The Fool');
});

it('loads independently labeled local inputs without guessing identity from filenames', async (t) => {
  const f = await setup(t);
  const dataset = await loadVisionDataset({ deckStyle: 'rws-1909', ...f });
  assert.equal(dataset.inputs[0].expected, 'The Fool');
  assert.equal(dataset.provenance.datasetKind, 'held-out-photos');
  assert.equal(dataset.provenance.referenceOverlapCount, 0);
  assert.match(dataset.provenance.manifestSha256, /^[a-f0-9]{64}$/);
});

it('rejects a byte-for-byte reference copy despite a different filename', async (t) => {
  const f = await setup(t, { photo: 'same bytes', reference: 'same bytes' });
  await assert.rejects(loadVisionDataset({ deckStyle: 'rws-1909', ...f }), /reference.*overlap/i);
});

for (const [name, mutate, message] of [
  ['image hash mismatch', m => { m.samples[0].sha256 = '0'.repeat(64); }, /hash/i],
  ['duplicate images', m => { m.samples.push({ ...m.samples[0], id: 'different-id' }); }, /duplicate/i],
  ['wrong deck', m => { m.deckStyle = 'thoth-a1'; }, /deck/i],
  ['unknown expected identity', m => { m.samples[0].expected = 'Invented Card'; }, /expected/i],
  ['missing label provenance', m => { delete m.labelSource; }, /label/i],
  ['empty sample list', m => { m.samples = []; }, /samples/i]
]) {
  it(`rejects ${name} before inference`, async (t) => {
    const f = await setup(t); mutate(f.manifest); await f.save();
      await assert.rejects(loadVisionDataset({ deckStyle: 'rws-1909', ...f }), message);
  });
}

it('keeps synthetic inputs explicitly synthetic', async (t) => {
  const f = await setup(t, { kind: 'synthetic' });
  const dataset = await loadVisionDataset({ deckStyle: 'rws-1909', ...f });
  assert.equal(dataset.provenance.datasetKind, 'synthetic');
});

it('retains the complete manifest size when running a limited diagnostic subset', async (t) => {
  const f = await setup(t);
  await writeFile(join(f.root, 'second.jpg'), 'second photo bytes');
  f.manifest.samples.push({ id: 'photo-2', image: 'second.jpg', expected: 'The Sun', sha256: createHash('sha256').update('second photo bytes').digest('hex') });
  await f.save();
  const dataset = await loadVisionDataset({ deckStyle: 'rws-1909', ...f, limit: 1 });
  assert.equal(dataset.inputs.length, 1);
  assert.equal(dataset.provenance.datasetSampleSize, 2);
});

it('fails a missing deck directory instead of using RWS images', async (t) => {
  const f = await setup(t);
  await assert.rejects(loadVisionDataset({ deckStyle: 'thoth-a1', referenceRoot: f.referenceRoot }), /ENOENT/);
});
