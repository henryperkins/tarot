import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

const origins = { frontend: 'http://127.0.0.1:5317', optimized: 'http://127.0.0.1:5318', api: 'http://127.0.0.1:8817' };
const listeners = values => Object.entries(values).map(([kind, origin]) => ({kind, host:'127.0.0.1', port:Number(new URL(origin).port)}));
const config = new URL('../output/reading-motion/reading-cue-remediation.playwright.config.mjs', import.meta.url).href;
const load = env => spawnSync(process.execPath, ['--input-type=module', '-e', `const {default:c}=await import(${JSON.stringify(config)}); console.log(JSON.stringify({workers:c.workers,retries:c.retries,use:c.use,outputDir:c.outputDir,projects:c.projects,webServer:c.webServer,testMatch:c.testMatch}));`],
  { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });

test('config fails closed without the explicit owned manifest and lane', () => {
  const result = load({});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /owned manifest|explicit.*lane/i);
});

test('explicit owned config defines all eight browser/device/motion lanes and unique evidence without server reuse', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cue-config-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const manifest = path.join(dir, 'runtime.json');
  await writeFile(manifest, JSON.stringify({ origins, ownedResources: { listeners: listeners(origins) },
    buildIdentity: { origins, runId: 'synthetic-run', snapshotDigest: 'a'.repeat(64), apiMode: 'offline-fail-closed', mode: 'reading-cue-validation', dev: false } }));
  const valid = JSON.parse(await readFile(manifest, 'utf8'));
  await writeFile(manifest, JSON.stringify({...valid, origins:{...origins, frontend:origins.optimized, optimized:origins.frontend}}));
  const swapped = load({ CUE_VALIDATION_MANIFEST:manifest, CUE_VALIDATION_LANE:'optimized', CUE_VALIDATION_EVIDENCE_ROOT:dir });
  assert.notEqual(swapped.status, 0, 'swapped origins must fail before browser execution');
  await writeFile(manifest, JSON.stringify(valid));
  const env = { CUE_VALIDATION_MANIFEST: manifest, CUE_VALIDATION_LANE: 'fixture', CUE_VALIDATION_EVIDENCE_ROOT: dir };
  const first = load(env); assert.equal(first.status, 0, first.stderr); const config = JSON.parse(first.stdout);
  const second = load(env); assert.equal(second.status, 0, second.stderr);
  assert.notEqual(config.outputDir, JSON.parse(second.stdout).outputDir);
  assert.notEqual(load({ ...env, CUE_VALIDATION_RUN_DIRECTORY: path.dirname(config.outputDir) }).status, 0);
  assert.equal(config.retries, 0); assert.equal(config.workers, 1);
  assert.equal(config.use.serviceWorkers, 'block'); assert.equal(config.webServer, undefined);
  assert.equal(config.use.baseURL, 'http://127.0.0.1:5317');
  // The fixture lane owns geometry and the full artwork presentation matrix.
  for (const spec of ['reading-gestures-deck.spec.js', 'reading-gestures-geometry.spec.js', 'reading-gestures-artwork-matrix.spec.js']) assert.ok(config.testMatch.includes(spec), spec);
  assert.equal(config.projects.length, 8);
  for (const browser of ['chromium', 'webkit']) for (const form of ['desktop', 'phone']) for (const motion of ['normal', 'reduced']) {
    const project = config.projects.find(project => project.name === `${browser}-${form}-${motion}`);
    assert.ok(project); assert.equal(project.use.browserName, browser);
    assert.equal(project.use.contextOptions.reducedMotion, motion === 'reduced' ? 'reduce' : 'no-preference');
  }
  assert.notEqual(load({ ...env, CUE_VALIDATION_LANE: 'qualification' }).status, 0);
  // Artwork performance runs only against the optimized build.
  const optimized = load({ ...env, CUE_VALIDATION_LANE: 'optimized' }); assert.equal(optimized.status, 0, optimized.stderr);
  const optimizedConfig = JSON.parse(optimized.stdout);
  assert.ok(optimizedConfig.testMatch.includes('reading-cue-artwork-performance.spec.js'));
  assert.equal(optimizedConfig.use.baseURL, 'http://127.0.0.1:5318');
  for (const lane of ['fixture', 'application']) {
    const other = load({ ...env, CUE_VALIDATION_LANE: lane }); assert.equal(other.status, 0, other.stderr);
    assert.ok(!JSON.parse(other.stdout).testMatch.includes('reading-cue-artwork-performance.spec.js'), lane);
  }
  assert.equal(load({ ...env, CUE_VALIDATION_LANE: 'qualification', CUE_QUALIFICATION: 'true' }).status, 0);
  assert.notEqual(load({ ...env, CUE_REAL_PRO_PROBES: 'true' }).status, 0);
  await writeFile(manifest, JSON.stringify({ origins: { frontend: 'http://127.0.0.1:5175' }, buildIdentity: {} }));
  assert.notEqual(load(env).status, 0);
});

test('qualification attaches to the verified external frontend and borrowed close preserves its owner', async t => {
  const { attachCueValidationFrontend } = await import('../e2e/helpers/readingCueFrontend.mjs');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cue-attachment-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let kind = 'frontend'; let outputIntegrity = true;
  const identity = { runId: 'synthetic-attachment', snapshotDigest: 'a'.repeat(64), apiMode: 'offline-fail-closed' };
  const server = http.createServer((_request, response) => response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({...identity, listenerKind:kind, servingOrigin:origin, servingFlags:{dev:kind === 'frontend',prod:kind === 'optimized',mode:kind === 'frontend' ? 'development':'reading-cue-validation'}, outputIntegrity, optimizedFlags:{dev:false,prod:true,mode:'reading-cue-validation'}, outputDigest:'c'.repeat(64)})));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const manifestPath = path.join(dir, 'manifest.json');
  const mapping = {...origins, frontend:origin};
  const manifest = { origins:mapping, ownedResources:{listeners:listeners(mapping)}, buildIdentity:{...identity, origins:mapping, optimizedFlags:{dev:false,prod:true,mode:'reading-cue-validation'}, outputDigest:'c'.repeat(64)} };
  await writeFile(manifestPath, JSON.stringify(manifest));
  const frontend = await attachCueValidationFrontend(manifestPath);
  assert.equal(frontend.origin, origin); assert.equal(frontend.buildIdentity.snapshotDigest, 'a'.repeat(64));
  assert.deepEqual(await frontend.close(), { borrowed: true, closed: false, runId: 'synthetic-attachment', listenerKind:'frontend', outputDigest:'c'.repeat(64), outputIntegrity:true });
  assert.equal((await fetch(origin)).status, 200);
  kind = 'optimized';
  await assert.rejects(attachCueValidationFrontend(manifestPath), /listener|mismatch/);
  await assert.rejects(frontend.close(), /listener|mismatch/);
  const { verifyCueListener } = await import('../e2e/helpers/readingCueValidationIdentity.mjs');
  kind = 'frontend';
  // A manifest consistently relabeled to route optimized traffic to the real frontend still fails its handshake.
  const swapped = {...mapping, optimized:mapping.frontend, frontend:mapping.optimized};
  await assert.rejects(verifyCueListener({...manifest, origins:swapped, buildIdentity:{...manifest.buildIdentity, origins:swapped}, ownedResources:{listeners:listeners(swapped)}}, 'optimized'), /listener|mismatch/);
  // Playwright's all-spec teardown must invalidate previously successful lane evidence.
  const {default: verifyLane} = await import('../e2e/helpers/readingCueValidationLane.mjs');
  const saved = {...process.env};
  Object.assign(process.env, {CUE_VALIDATION_MANIFEST:manifestPath, CUE_VALIDATION_LANE:'fixture', CUE_VALIDATION_RUN_DIRECTORY:dir});
  try {
    const teardown = await verifyLane();
    outputIntegrity = false;
    await assert.rejects(teardown(), /integrity/);
    const recorded = JSON.parse(await readFile(path.join(dir, 'lane-integrity.json'), 'utf8'));
    assert.equal(recorded.before.outputIntegrity, true); assert.equal(recorded.after.outputIntegrity, false);
  } finally {
    outputIntegrity = true;
    for (const key of ['CUE_VALIDATION_MANIFEST','CUE_VALIDATION_LANE','CUE_VALIDATION_RUN_DIRECTORY']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
  kind = 'frontend';
  await writeFile(manifestPath, JSON.stringify({ ...manifest, buildIdentity: { ...identity, snapshotDigest: 'b'.repeat(64) } }));
  await assert.rejects(attachCueValidationFrontend(manifestPath), /mismatch/);
  await writeFile(manifestPath, JSON.stringify({ ...manifest, origins: { frontend: 'http://127.0.0.1:5175' } }));
  await assert.rejects(attachCueValidationFrontend(manifestPath), /owned/i);
});
