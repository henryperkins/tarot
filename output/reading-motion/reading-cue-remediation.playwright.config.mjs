import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';

import { validateCueOriginMappings } from '../../e2e/helpers/readingCueValidationIdentity.mjs';

// The external launcher owns startup and shutdown. Never inherit root/beta webServer settings.
const lane = process.env.CUE_VALIDATION_LANE;
if (!['qualification', 'fixture', 'application', 'optimized'].includes(lane)) throw new Error('An explicit validation lane is required.');
if (!process.env.CUE_VALIDATION_MANIFEST || !path.isAbsolute(process.env.CUE_VALIDATION_MANIFEST)) throw new Error('An absolute owned manifest is required.');
if ((lane === 'qualification') !== (process.env.CUE_QUALIFICATION === 'true')) throw new Error('Qualification requires exactly CUE_QUALIFICATION=true and its explicit lane.');
if (process.env.CUE_REAL_PRO_PROBES === 'true') throw new Error('Real Pro opt-in additionally requires Task 8 live preflight; the offline scaffold cannot authorize it.');
const manifest = JSON.parse(readFileSync(process.env.CUE_VALIDATION_MANIFEST, 'utf8'));
const identity = manifest.buildIdentity;
if (identity?.apiMode !== 'offline-fail-closed' || !identity.runId || !/^[a-f0-9]{64}$/.test(identity.snapshotDigest || '')
  || identity.mode !== 'reading-cue-validation' || identity.dev !== false) throw new Error('A valid owned offline runtime identity is required.');
const origins = validateCueOriginMappings(manifest);
const evidenceRoot = process.env.CUE_VALIDATION_EVIDENCE_ROOT;
if (!evidenceRoot || !path.isAbsolute(evidenceRoot)) throw new Error('An absolute run-owned evidence root is required.');
mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
const inheritedDirectory = process.env.CUE_VALIDATION_RUN_DIRECTORY;
const ownerPid = inheritedDirectory ? Number(process.env.CUE_VALIDATION_CONFIG_OWNER_PID) : process.pid;
if (inheritedDirectory && ![process.pid, process.ppid].includes(ownerPid)) throw new Error('A previous evidence directory cannot be reused by a new run.');
const runDirectory = inheritedDirectory || mkdtempSync(path.join(evidenceRoot, 'reading-cue-remediation-'));
if (!runDirectory.startsWith(path.resolve(evidenceRoot) + path.sep)) throw new Error('Evidence must stay inside the explicit run-owned root.');
if (inheritedDirectory) {
  const prior = JSON.parse(readFileSync(path.join(runDirectory, 'config-identity.json'), 'utf8'));
  if (prior.ownerPid !== ownerPid || prior.runId !== identity.runId || prior.snapshotDigest !== identity.snapshotDigest || prior.lane !== lane) throw new Error('Inherited evidence identity changed.');
}
process.env.CUE_VALIDATION_CONFIG_OWNER_PID = String(ownerPid);
process.env.CUE_VALIDATION_RUN_DIRECTORY = runDirectory;
process.env.CUE_VALIDATION_EVIDENCE_DIR = runDirectory;
const fixtureSpecs = ['reading-gestures.spec.js', 'reading-gestures-lifecycle.spec.js', 'reading-gestures-dynamic.spec.js',
  'reading-gestures-refinement.spec.js', 'reading-gestures-deck.spec.js', 'reading-gestures-generated.spec.js',
  'reading-visual-handoff.spec.js', 'journal-visual-restoration.spec.js', 'reading-gestures-geometry.spec.js',
  'reading-gestures-artwork-matrix.spec.js'];
// The artwork performance measurements need the separately identified optimized build.
const specs = lane === 'qualification' ? ['reading-cue-qualification.spec.js'] : lane === 'fixture' ? fixtureSpecs
  : ['reading-gestures-live.spec.js', 'reading-visual-disabled.spec.js', ...(lane === 'optimized' ? ['reading-cue-artwork-performance.spec.js'] : [])];
const projects = ['chromium', 'webkit'].flatMap(browser => ['desktop', 'phone'].flatMap(form => ['normal', 'reduced'].map(motion => ({
  name: `${browser}-${form}-${motion}`,
  use: { ...(form === 'phone' ? devices[browser === 'webkit' ? 'iPhone 13' : 'Pixel 5'] : devices[browser === 'webkit' ? 'Desktop Safari' : 'Desktop Chrome']),
    browserName: browser, ...(form === 'desktop' ? { viewport: { width: 1100, height: 1000 } } : {}),
    contextOptions: { reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference' } }
}))));
const savedConfig = path.join(runDirectory, 'config-identity.json');
try { writeFileSync(savedConfig, JSON.stringify({ ownerPid, runId: identity.runId, snapshotDigest: identity.snapshotDigest, lane, retries: 0,
  apiMode: identity.apiMode, baseURL: origins[lane === 'optimized' ? 'optimized' : 'frontend'], projects: projects.map(project => ({ name: project.name, use: project.use })) }, null, 2), { flag: 'wx', mode: 0o600 }); }
catch (error) { if (error.code !== 'EEXIST') throw error; }

export default defineConfig({
  globalSetup: fileURLToPath(new URL('../../e2e/helpers/readingCueValidationLane.mjs', import.meta.url)),
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)),
  testMatch: ['reading-cue-runtime-lane.spec.js', ...specs], workers: 1, retries: 0,
  timeout: lane === 'qualification' ? 420000 : 60000,
  outputDir: path.join(runDirectory, 'artifacts'),
  reporter: [['list'], ['json', { outputFile: path.join(runDirectory, 'results.json') }]],
  // Trace recording perturbs frame continuity during timing qualification.
  use: { baseURL: origins[lane === 'optimized' ? 'optimized' : 'frontend'], serviceWorkers: 'block',
    trace: lane === 'qualification' ? 'off' : 'retain-on-failure', screenshot: 'only-on-failure' },
  projects
});
