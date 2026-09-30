import assert from 'node:assert/strict';
import { it } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const healthy = () => ({
  schemaVersion: 2, deckStyle: 'rws-1909', sourceGeneratedAt: new Date().toISOString(),
  provenance: { datasetKind: 'held-out-photos', datasetSampleSize: 78, labelSource: 'independent-human', sourceRevision: revision, sourceDirty: false, manifestSha256: 'a'.repeat(64), referenceOverlapCount: 0 },
  sampleSize: 78, sourceSampleSize: 78, inputSampleSize: 78, unmappedSampleCount: 0, uniqueCardCount: 78,
  symbolScoredSampleCount: 78, symbolAnnotationCoverage: 1, absenceAnnotationCoverage: 1,
  absenceAnnotatedSampleCount: 78, highSalienceExpectedCount: 78, highSalienceAnnotationCoverage: 1,
  accuracy: 1, highConfidenceCoverage: 1, highConfidenceAccuracy: 1, highConfidenceErrorRate: 0,
  symbolCoverageRate: 1, weightedSymbolCoverageRate: 0.8, highSalienceSymbolRecall: 1, absentSymbolFalsePositiveRate: 0
});

function runGate(metrics, deck = 'rws-1909', env = {}, dirty = false) {
  const dir = mkdtempSync(join(tmpdir(), 'tableu-vision-gate-'));
  try {
    const file = join(dir, 'metrics.json');
    // Exercise freshness against an actual isolated Git checkout, so the
    // parent's unrelated edits cannot masquerade as this fixture's source.
    const cwd = join(dir, 'repo');
    mkdirSync(cwd);
    const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git(['init', '--quiet']);
    writeFileSync(join(cwd, 'source.js'), 'original source');
    git(['add', 'source.js']);
    git(['-c', 'user.name=Gate Test', '-c', 'user.email=gate@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'test source']);
    if (metrics.provenance.sourceRevision === revision) metrics.provenance.sourceRevision = git(['rev-parse', 'HEAD']);
    if (dirty) writeFileSync(join(cwd, 'source.js'), 'changed source');
    writeFileSync(file, JSON.stringify({ metricsByDeck: { 'rws-1909': metrics } }));
    return spawnSync(process.execPath, [join(process.cwd(), 'scripts/evaluation/verifyVisionGate.js'), file, '--deck-style', deck], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

it('accepts a complete fresh report with measured quality above the unchanged floors', () => {
  const result = runGate(healthy());
  assert.equal(result.status, 0, result.stderr);
});

for (const [name, edit] of [
  ['missing weighted score', m => { delete m.weightedSymbolCoverageRate; }],
  ['missing negative metric', m => { delete m.absentSymbolFalsePositiveRate; }],
  ['null high-salience metric', m => { m.highSalienceSymbolRecall = null; }],
  ['stale inference', m => { m.sourceGeneratedAt = '2026-01-17T00:00:00.000Z'; m.generatedAt = new Date().toISOString(); }],
  ['future inference', m => { m.sourceGeneratedAt = '2099-01-01T00:00:00.000Z'; }],
  ['wrong revision', m => { m.provenance.sourceRevision = '0'.repeat(40); }],
  ['uncommitted source', m => { m.provenance.sourceDirty = true; }],
  ['reference image self-comparison', m => { m.provenance.datasetKind = 'reference-art'; }],
  ['synthetic images posing as photos', m => { m.provenance.datasetKind = 'synthetic'; }],
  ['reference leakage', m => { m.provenance.referenceOverlapCount = 1; }],
  ['unmeasured annotation coverage', m => { m.symbolAnnotationCoverage = 0; }],
  ['untested negative concepts', m => { m.absenceAnnotationCoverage = 5 / 78; }],
  ['unmeasured high-salience coverage', m => { m.highSalienceAnnotationCoverage = 0.1; }],
  ['skipped inputs', m => { m.unmappedSampleCount = 1; }],
  ['partial card set', m => { m.uniqueCardCount = 1; }],
  ['a limited subset of a larger corpus', m => { m.provenance.datasetSampleSize = 156; }],
  ['out-of-range metric', m => { m.accuracy = 2; }],
  ['unknown schema', m => { delete m.schemaVersion; }],
  ['weak confidence despite complete matches', m => { m.weightedSymbolCoverageRate = 0.64; }]
]) {
  it(`rejects ${name}`, () => {
    const metric = healthy(); edit(metric);
    const result = runGate(metric);
    assert.equal(result.status, 1, result.stdout);
  });
}

it('does not substitute another deck when the requested deck is missing', () => {
  assert.equal(runGate(healthy(), 'marseille-classic').status, 1);
});

it('rejects invalid threshold configuration instead of disabling comparisons', () => {
  assert.equal(runGate(healthy(), 'rws-1909', { VISION_MIN_ACCURACY: 'NaN' }).status, 1);
});

it('rejects source edits after a clean report was generated at the same HEAD', () => {
  assert.equal(runGate(healthy(), 'rws-1909', {}, true).status, 1);
});
