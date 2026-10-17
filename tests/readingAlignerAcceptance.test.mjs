import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateAcceptanceManifest, preflightAcceptance, acceptanceEnvironment } from '../scripts/evaluation/runReadingAlignerAcceptance.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const projects = ['chromium', 'webkit'].flatMap(browser => ['desktop', 'phone'].flatMap(form => ['normal', 'reduced'].map(motion => `${browser}-${form}-${motion}`)));
function candidate(sourceRoot) {
  const sourceFiles = [{ path: 'index.html', bytes: 5, sha256: digest('hello'), gitBlobSha1: createHash('sha1').update('blob 5\0hello').digest('hex') }];
  return { version: 1, sourceRoot, sourceHead: 'a'.repeat(40), sourceFiles, snapshotDigest: digest(JSON.stringify(sourceFiles)),
    origins: { frontend: 'http://127.0.0.1:19181', api: 'http://127.0.0.1:19182' }, mode: 'production', dev: false, prod: true,
    flags: { VITE_READING_ALIGNER_ENABLED: 'true', VITE_READING_MODEL_ANNOTATIONS: 'false' }, apiMode: 'offline-fail-closed', projects,
    decisions: { D1: 'retain-complete-quote-exposed-line', D7: 'pending-preserve-current' } };
}
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'aligner-unit-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'repo'); await mkdir(source); await writeFile(path.join(source, 'index.html'), 'hello');
  return { directory, manifest: candidate(source), evidenceRoot: path.join(directory, 'new-evidence'),
    adapters: { getHead: async () => 'a'.repeat(40), assertPortAvailable: async () => {} } };
}
test('accepts a pinned production candidate with eight explicit browser profiles', () => {
  assert.equal(validateAcceptanceManifest(candidate('/tmp/owned-repo')).mode, 'production');
});
for (const port of [8787, 5175, 8789, 9235]) test(`rejects protected listener ${port} before adapters can start anything`, async t => {
  const f = await fixture(t); f.manifest.origins.frontend = `http://127.0.0.1:${port}`;
  let touched = false; f.adapters.assertPortAvailable = async () => { touched = true; };
  await assert.rejects(preflightAcceptance(f), /protected|loopback/); assert.equal(touched, false);
});
for (const change of [m => { m.dev = true; }, m => { m.mode = 'reading-cue-validation'; }, m => { m.flags.VITE_READING_MODEL_ANNOTATIONS = 'true'; }, m => { m.flags.VITE_READING_ALIGNER_ENABLED = 'false'; }]) {
  test('refuses an unsafe build flag contract', () => { const m = candidate('/tmp/repo'); change(m); assert.throws(() => validateAcceptanceManifest(m), /production|flag/); });
}
test('rejects an external proxy even if listeners are local', () => {
  const m = candidate('/tmp/repo'); m.apiProxyOrigin = 'https://production.example/api';
  assert.throws(() => validateAcceptanceManifest(m), /proxy|origin/);
});
test('rejects unpinned source bytes before any listener preflight', async t => {
  const f = await fixture(t); await writeFile(path.join(f.manifest.sourceRoot, 'index.html'), 'changed');
  let touched = false; f.adapters.assertPortAvailable = async () => { touched = true; };
  await assert.rejects(preflightAcceptance(f), /source|pinned/); assert.equal(touched, false);
});
test('rejects stale source HEAD', async t => { const f = await fixture(t); f.adapters.getHead = async () => 'b'.repeat(40); await assert.rejects(preflightAcceptance(f), /HEAD/); });
test('never reuses a prior evidence directory, including an empty directory', async t => {
  const f = await fixture(t); await mkdir(f.evidenceRoot); await assert.rejects(preflightAcceptance(f), /new|evidence/);
});
test('fails closed when an owned port is already occupied', async t => {
  const f = await fixture(t); f.adapters.assertPortAvailable = async port => { if (port === 19182) throw new Error('EADDRINUSE'); };
  await assert.rejects(preflightAcceptance(f), /EADDRINUSE/);
});
test('rejects inherited provider credentials in a proposed child environment', async t => {
  const f = await fixture(t); f.runtimeEnvironment = { OPENAI_API_KEY: 'fake-unit-key' }; await assert.rejects(preflightAcceptance(f), /credential|environment/);
});
test('sanitized process environment carries no provider keys or external API origins', () => {
  const env = acceptanceEnvironment('/tmp/private', { PATH: '/usr/bin', OPENAI_API_KEY: 'fake', API_ORIGIN: 'https://provider.invalid' });
  assert.equal(env.NODE_ENV, 'production'); assert.equal(env.OPENAI_API_KEY, undefined); assert.equal(env.API_ORIGIN, undefined);
  assert.equal(env.VITE_READING_ALIGNER_ENABLED, 'true'); assert.equal(env.VITE_READING_MODEL_ANNOTATIONS, 'false');
});
test('rejects output reuse without an expected output digest', () => {
  const m = candidate('/tmp/repo'); m.prebuiltDirectory = '/tmp/stale-output'; assert.throws(() => validateAcceptanceManifest(m), /digest|reuse/);
});

test('real server start with accidental model configuration cannot dispatch without client consent', async () => {
  const { proveServerNoConsent } = await import('../e2e/helpers/readingAlignerFixture.mjs');
  const proof = await proveServerNoConsent({ spreadInfo: { name: 'One Card', key: 'single' }, cardsInfo: [{ card: 'The Star', position: 'Present', orientation: 'Upright', meaning: 'Hope', userReflection: null }], userQuestion: 'Where can I find hope?', deckStyle: 'rws-1909' });
  assert.equal(proof.narrativeDispatches, 1); assert.equal(proof.visualDispatches, 0); assert.equal(proof.providerDispatches, 0);
});

test('known blocked telemetry records successful pageload without fabricating an exception', async () => {
  const { classifyBlockedTelemetry } = await import('../e2e/helpers/readingAlignerFixture.mjs');
  assert.equal(typeof classifyBlockedTelemetry, 'function');
  const result = classifyBlockedTelemetry({ method: 'POST', url: 'https://o4508070823395328.ingest.us.sentry.io/api/4510814880661504/envelope/?sentry_version=7',
    body: '{}\n{"type":"transaction"}\n{"transaction":"/","contexts":{"trace":{"status":"ok"}},"spans":[{}]}\n' });
  assert.deepEqual(result.items, [{ type: 'transaction', transaction: '/', status: 'ok', spans: 1 }]); assert.deepEqual(result.errors, []);
});
test('a captured exception remains a failing diagnostic even on the known telemetry route', async () => {
  const { classifyBlockedTelemetry } = await import('../e2e/helpers/readingAlignerFixture.mjs');
  assert.equal(typeof classifyBlockedTelemetry, 'function');
  const result = classifyBlockedTelemetry({ method: 'POST', url: 'https://o4508070823395328.ingest.us.sentry.io/api/4510814880661504/envelope/',
    body: '{}\n{"type":"event"}\n{"exception":{"values":[{"type":"TypeError","value":"Broken product behavior"}]}}\n' });
  assert.deepEqual(result.errors, [{ type: 'event', message: 'TypeError: Broken product behavior' }]);
});
test('unknown hosts, projects and non-POST requests never become permitted telemetry', async () => {
  const { classifyBlockedTelemetry } = await import('../e2e/helpers/readingAlignerFixture.mjs'); assert.equal(typeof classifyBlockedTelemetry, 'function');
  for (const request of [
    { method: 'POST', url: 'https://other.ingest.us.sentry.io/api/4510814880661504/envelope/' },
    { method: 'POST', url: 'https://o4508070823395328.ingest.us.sentry.io/api/99/envelope/' },
    { method: 'GET', url: 'https://o4508070823395328.ingest.us.sentry.io/api/4510814880661504/envelope/' }
  ]) assert.equal(classifyBlockedTelemetry({ ...request, body: '{}' }), null);
});
test('malformed known telemetry fails closed rather than discarding diagnostics', async () => {
  const { classifyBlockedTelemetry } = await import('../e2e/helpers/readingAlignerFixture.mjs'); assert.equal(typeof classifyBlockedTelemetry, 'function');
  const result = classifyBlockedTelemetry({ method: 'POST', url: 'https://o4508070823395328.ingest.us.sentry.io/api/4510814880661504/envelope/', body: 'not-json' });
  assert.deepEqual(result.errors, [{ type: 'malformed-envelope', message: 'Known telemetry payload could not be inspected' }]);
});
