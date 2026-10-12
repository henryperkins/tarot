import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { validateAcceptanceManifest } from '../../scripts/evaluation/runReadingAlignerAcceptance.mjs';

const manifestPath = process.env.ALIGNER_ACCEPTANCE_MANIFEST;
if (!manifestPath || !path.isAbsolute(manifestPath)) throw new Error('Owned production acceptance manifest required.');
const manifest = validateAcceptanceManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
if (!manifest.runId || !manifest.ownerPid || !manifest.runtimePid || !/^[a-f0-9]{64}$/.test(manifest.outputDigest || '')
  || manifest.resolvedFlags?.mode !== 'production' || manifest.resolvedFlags?.dev !== false) throw new Error('Fresh pinned production runtime required.');
process.kill(manifest.ownerPid, 0); process.kill(manifest.runtimePid, 0);
const projects = manifest.projects.map(name => {
  const [browser, form, motion] = name.split('-');
  return { name, use: { ...(form === 'phone' ? devices[browser === 'webkit' ? 'iPhone 13' : 'Pixel 5'] : devices[browser === 'webkit' ? 'Desktop Safari' : 'Desktop Chrome']),
    browserName: browser, ...(form === 'desktop' ? { viewport: { width: 1280, height: 1000 } } : {}),
    contextOptions: { reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference' } } };
});
try { writeFileSync(path.join(manifest.evidenceRoot, 'config-identity.json'), JSON.stringify({ runId: manifest.runId, sourceDigest: manifest.snapshotDigest,
  outputDigest: manifest.outputDigest, baseURL: manifest.origins.frontend, apiMode: manifest.apiMode, mode: 'production', dev: false,
  flags: manifest.flags, decisions: manifest.decisions, workers: 1, retries: 0, maxFailures: 0, projects, specs: ['reading-aligner-release.spec.js', 'reading-personal-context.spec.js'] }, null, 2), { mode: 0o600, flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
export default defineConfig({
  globalSetup: fileURLToPath(new URL('../../e2e/helpers/readingAlignerFixture.mjs', import.meta.url)),
  testDir: fileURLToPath(new URL('../../e2e', import.meta.url)), testMatch: ['reading-aligner-release.spec.js', 'reading-personal-context.spec.js'],
  workers: 1, retries: 0, maxFailures: 0, timeout: 60000, outputDir: path.join(manifest.evidenceRoot, 'artifacts'),
  reporter: [['list'], ['json', { outputFile: path.join(manifest.evidenceRoot, 'results.json') }]],
  use: { baseURL: manifest.origins.frontend, serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure' }, projects
});
