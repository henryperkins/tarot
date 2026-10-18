import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { Log, LogLevel } from 'miniflare';
import { journalFixture, SAVED_READING } from './helpers/journalD1.mjs';

for (const sampleRatio of ['1', '0']) {
  test(`warmed Worker keeps concurrent saves, backfills and deletes atomic (sampling ${sampleRatio})`, { timeout: 60000 }, async () => {
    const built = await build({
      entryPoints: ['src/worker/index.js'], bundle: true, write: false,
      platform: 'browser', format: 'esm', target: 'es2022', logLevel: 'silent',
      external: ['cloudflare:*', 'node:*'], conditions: ['workerd', 'worker', 'browser'],
      mainFields: ['browser', 'module', 'main']
    });
    const traceExports = [];
    const sentryExports = [];
    const telemetryTraceFlags = [];
    const fixture = await journalFixture({
      script: built.outputFiles[0].text, compatibilityFlags: ['nodejs_compat'],
      bindings: { CF_VERSION_METADATA: { id: 'isolated-test' }, OTEL_TRACE_SAMPLE_RATIO: sampleRatio, OTLP_ENDPOINT: 'https://collector.invalid/v1/traces' },
      log: new Log(LogLevel.NONE),
      // Block telemetry/provider requests; no external effects or credentials.
      outboundService: async request => {
        if (request.url.includes('collector.invalid')) {
          telemetryTraceFlags.push(request.headers.get('sentry-trace')?.split('-')[2]);
          traceExports.push(await request.text());
        }
        else if (request.url.includes('sentry.io')) sentryExports.push(await request.text());
        return new Response(null, { status: 204 });
      }
    });
    try {
      const call = (path, method = 'POST', body) => fixture.fetch(`https://example.test/api/${path}`, {
        method, headers: { Cookie: 'session=session-owner', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      // D1 bindings survive requests in a warm isolate. Instrumentation must not
      // stack new mutating wrappers every time that binding is accessed.
      for (let i = 0; i < 110; i++) {
        const response = await call('archetype-journey/preferences', 'GET');
        assert.equal(response.status, 200, await response.clone().text());
        await response.arrayBuffer();
      }
      const saved = await call('journal', 'POST', SAVED_READING);
      assert.equal(saved.status, 201, await saved.clone().text());
      const { entry } = await saved.json();
      const [backfills, saves, retries, deleted] = await Promise.all([
        Promise.all(Array.from({ length: 3 }, () => call('archetype-journey-backfill'))),
        Promise.all(Array.from({ length: 6 }, (_, i) => call('journal', 'POST', { ...SAVED_READING, sessionSeed: `new-${i}`, requestId: `new-${i}` }))),
        Promise.all(Array.from({ length: 4 }, () => call('journal', 'POST', { ...SAVED_READING, sessionSeed: 'retry', requestId: 'retry' }))),
        call(`journal/${entry.id}`, 'DELETE')
      ]);
      for (const response of backfills) assert.equal(response.status, 200, await response.clone().text());
      for (const response of saves) assert.equal(response.status, 201, await response.clone().text());
      assert.deepEqual(retries.map(response => response.status).sort(), [200, 200, 200, 201]);
      assert.equal(deleted.status, 200, await deleted.clone().text());
      assert.equal((await fixture.db.prepare('SELECT COUNT(*) AS count FROM journal_entries').first()).count, 7);
      assert.deepEqual((await fixture.db.prepare('SELECT card_name, SUM(count) AS count FROM card_appearances GROUP BY card_name ORDER BY card_name').all()).results,
        [{ card_name: 'The Hermit', count: 14 }, { card_name: 'Three of Cups', count: 7 }]);
      const diagnostics = await call('archetype-journey', 'GET');
      assert.equal((await diagnostics.json()).analytics.stats.needsBackfill, false);
      if (sampleRatio === '1') {
        const spans = traceExports.flatMap(body => JSON.parse(body).resourceSpans || [])
          .flatMap(resource => resource.scopeSpans || []).flatMap(scope => scope.spans || []);
        assert.ok(spans.some(span => span.name === 'DB batch'), 'database batch tracing must remain enabled');
        assert.ok(spans.some(span => span.name.startsWith('api POST ')), 'request tracing must remain enabled');
        assert.ok(sentryExports.some(body => body.includes('"op":"db.query"')), 'Sentry database tracing must remain enabled');
        assert.ok(!telemetryTraceFlags.includes('1'),
          'deferred OTLP exports must not create Sentry spans in another request context');
      }
    } finally { await fixture.close(); }
  });
}
