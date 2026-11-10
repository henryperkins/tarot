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
        method, headers: {
          Cookie: 'session=session-owner; theme=compatibility-private-cookie',
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.100.42',
          'X-User-Id': 'compatibility-private-user',
          'X-Compatibility-Probe': 'compatibility-public-header'
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      // D1 bindings survive requests in a warm isolate. Instrumentation must not
      // stack new mutating wrappers every time that binding is accessed.
      for (let i = 0; i < 110; i++) {
        const query = i === 0 ? '?view=compatibility-public-query&x-user=compatibility-private-query' : '';
        const response = await call(`archetype-journey/preferences${query}`, 'GET');
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
        assert.ok(!telemetryTraceFlags.includes('1'),
          'deferred OTLP exports must not create Sentry spans in another request context');
      }
      // v11 streams v2 span batches; attributes carry typed values on the wire.
      const sentrySpans = sentryExports.flatMap(body => body.trim().split('\n').map(line => JSON.parse(line)))
        .filter(payload => payload.version === 2 && Array.isArray(payload.items)).flatMap(payload => payload.items);
      const attribute = (span, name) => span.attributes?.[name]?.value;
      const databaseSpan = sentrySpans.find(span => attribute(span, 'sentry.op') === 'db.query');
      assert.ok(databaseSpan, 'Sentry database tracing must remain enabled independently of OTEL sampling');
      assert.ok(sentrySpans.some(span => attribute(span, 'sentry.op') === 'http.server' && span.is_segment),
        'Sentry request tracing must remain enabled independently of OTEL sampling');
      assert.ok(sentrySpans.some(span => span.trace_id === databaseSpan.trace_id && span.span_id === databaseSpan.parent_span_id),
        'database spans must retain their request parent');
      const sentryPayload = sentryExports.join('\n');
      for (const value of ['session-owner', 'compatibility-private-cookie', 'compatibility-private-user',
        '198.51.100.42', 'compatibility-private-query', SAVED_READING.question, 'owner@example.test']) {
        assert.ok(!sentryPayload.includes(value), `Sentry must not collect private fixture value: ${value}`);
      }
      assert.ok(sentryPayload.includes('compatibility-public-header'), 'non-sensitive request headers remain available');
      assert.ok(sentryPayload.includes('compatibility-public-query'), 'non-sensitive query parameters remain available');
    } finally { await fixture.close(); }
  });
}
