import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalVisualCueJSON } from '../../shared/contracts/visualCueBatches.js';

const root = resolve(import.meta.dirname, '../..');
const historicalPath = 'scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json';
const runtimePath = 'src/data/cardGestureArtwork.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** Unit tests exercise today's runtime against unchanged historical labels.
 * The real loader still rejects the historical manifest after runtime edits.
 * This explicit in-memory fixture is never a new qualification freeze.
 */
export async function createReadingCueTestManifest() {
  const { manifestSha256, ...historical } = JSON.parse(await readFile(resolve(root, historicalPath), 'utf8'));
  assert.equal(sha(canonicalVisualCueJSON(historical)), manifestSha256, 'Historical qualification manifest integrity');
  const fixture = structuredClone(historical);
  const pin = fixture.sourceDigests.find(source => source.path === runtimePath);
  assert.ok(pin, 'Historical manifest must identify the artwork runtime');
  pin.sha256 = sha(await readFile(resolve(root, runtimePath)));
  fixture.unitTestRuntime = { qualificationEvidence: false, historicalManifestSha256: manifestSha256,
    refreshedRuntimePaths: [runtimePath] };
  return { ...fixture, manifestSha256: sha(canonicalVisualCueJSON(fixture)) };
}
