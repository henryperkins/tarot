import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalVisualCueJSON } from '../../shared/contracts/visualCueBatches.js';
import { loadReadingCueCases } from '../../scripts/evaluation/lib/readingCueQualification.mjs';

const DEFAULT_ROOT = resolve(import.meta.dirname, '../..');
const MANIFEST_PATH = 'scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json';
const CASE_ID = 'celtic-deep-shift';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** Resolve historical prose for an offline artwork probe, never a runtime freeze.
 * The source/labels and artwork assets keep their original pins. Rendered runtime
 * bytes are checked separately against the owned browser snapshot by the matrix.
 */
export async function loadArtworkMatrixReadingCase({ root = DEFAULT_ROOT } = {}) {
  const { manifestSha256, ...historical } = JSON.parse(await readFile(resolve(root, MANIFEST_PATH), 'utf8'));
  assert.equal(sha(canonicalVisualCueJSON(historical)), manifestSha256, 'Historical qualification manifest integrity');
  const entry = historical.cases.find(value => value.id === CASE_ID);
  assert.ok(entry, 'Historical manifest must identify the artwork matrix reading');
  const source = historical.sourceDigests.find(value => value.path === entry.provenance.sourcePath);
  assert.ok(source, 'Historical manifest must pin the artwork matrix prose');
  const projection = { ...historical, cases: [entry], sourceDigests: [source],
    offlineSourceProjection: { scope: 'offline-artwork-corpus', qualificationEvidence: false, historicalManifestSha256: manifestSha256 } };
  const [caseData] = await loadReadingCueCases({ root, manifest: { ...projection,
    manifestSha256: sha(canonicalVisualCueJSON(projection)) } });
  return { caseData, sourceBinding: { ...projection.offlineSourceProjection, caseId: CASE_ID,
    logicalSourcePath: caseData.provenance.sourcePath, resolvedSourcePath: caseData.labelProvenance.resolvedSourcePath,
    sourceFileSha256: caseData.provenance.sourceFileSha256, rawSha256: caseData.rawSha256,
    projectedManifestSha256: caseData.labelProvenance.manifestSha256 } };
}
