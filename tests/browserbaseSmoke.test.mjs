import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import {
  parseSmokeArgs, resolveSmokeApiKey, installGuestNetworkGuard, runBrowserbaseSmoke
} from '../scripts/browserbase/smoke.js';

const targetUrl = 'https://tableu.example';

async function directory(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tableu-browserbase-smoke-'));
  t.after(async () => {
    const resolved = path.resolve(dir);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('tableu-browserbase-smoke-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return dir;
}

function cloudFixture({ connectError, releaseError, finalStatus = 'COMPLETED', checkGuest } = {}) {
  const effects = { created: 0, released: [], contextsClosed: 0, disconnected: 0 };
  const client = { sessions: {
    async create() {
      effects.created++;
      return { id: 'bc093aee-b9a7-4ccd-a7a8-2da584c92c3a', connectUrl: 'wss://connect.browserbase.com?apiKey=private-connect-token' };
    },
    async update(id, body) {
      effects.released.push({ id, body });
      if (releaseError) throw releaseError;
      return { id, status: 'COMPLETED' };
    },
    async retrieve(id) { return { id, status: finalStatus }; }
  } };
  const browser = {
    version: () => 'test-browser',
    async newContext() {
      return {
        async route() {}, async routeWebSocket() {},
        async close() { effects.contextsClosed++; }
      };
    },
    async close() { effects.disconnected++; }
  };
  return {
    effects,
    dependencies: {
      client,
      async connect() {
        if (connectError) throw connectError;
        return browser;
      },
      checkGuest: checkGuest || (async (_context, run) => {
        run.checks.push({ name: 'guest UI', status: 'passed' });
      })
    }
  };
}

test('requires an explicit public HTTPS target before a cloud session can be created', async (t) => {
  const outputDir = await directory(t);
  const fixture = cloudFixture();
  for (const url of ['http://localhost:8787', 'https://127.0.0.1', 'https://10.0.0.1',
    'https://user:password@example.com', 'https://example.com?token=secret', 'https://example.com/account']) {
    await assert.rejects(runBrowserbaseSmoke({ targetUrl: url, apiKey: 'fake-key', outputDir }, fixture.dependencies));
  }
  assert.equal(fixture.effects.created, 0);
  assert.throws(() => parseSmokeArgs([], {}), /url|target/i);
});

test('accepts an explicit target and keeps help independent of credentials', () => {
  assert.equal(parseSmokeArgs(['--url', 'https://tableu.example/'], {}).targetUrl, targetUrl);
  assert.equal(parseSmokeArgs([], { BROWSERBASE_SMOKE_URL: targetUrl }).targetUrl, targetUrl);
  assert.equal(parseSmokeArgs(['--help'], {}).help, true);
  assert.throws(() => parseSmokeArgs(['--unknown'], {}), /unknown/i);
});

test('uses the existing private dev-vars convention without replacing an environment key', async (t) => {
  const devVarsPath = path.join(await directory(t), '.dev.vars');
  await fs.writeFile(devVarsPath, '# other settings\nBROWSERBASE_API_KEY="fake-file-key"\n');
  assert.equal(resolveSmokeApiKey({ env: {}, devVarsPath }), 'fake-file-key');
  assert.equal(resolveSmokeApiKey({ env: { BROWSERBASE_API_KEY: 'fake-env-key' }, devVarsPath }), 'fake-env-key');
});

test('the browser guard prevents model, unknown API, mutation, and websocket requests from reaching a server', {
  skip: !existsSync(chromium.executablePath()), timeout: 20000
}, async (t) => {
  const received = [];
  let upgrades = 0;
  const server = http.createServer((request, response) => {
    received.push(`${request.method} ${request.url}`);
    response.setHeader('Content-Type', request.url === '/' ? 'text/html' : 'application/json');
    response.end(request.url === '/' ? '<!doctype html><title>Guard test</title>' : '{}');
  });
  server.on('upgrade', (_request, socket) => { upgrades++; socket.destroy(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const blockedRequests = [];
  await installGuestNetworkGuard(context, { targetUrl: origin, blockedRequests });
  const page = await context.newPage();
  await page.goto(origin);
  await page.evaluate(async () => {
    await Promise.all([
      fetch('/api/auth/me'),
      fetch('/api/tarot-reading/jobs', { method: 'POST', body: 'synthetic' }).catch(() => {}),
      fetch('/api/unknown-generator?token=private-query').catch(() => {}),
      fetch('/api/health/tts').catch(() => {}),
      fetch('/write-outside-api', { method: 'POST' }).catch(() => {})
    ]);
    await new Promise(resolve => {
      const socket = new WebSocket(globalThis.location.origin.replace('http:', 'ws:') + '/model-stream');
      socket.onclose = resolve;
      socket.onerror = resolve;
    });
  });
  assert.ok(received.includes('GET /api/auth/me'));
  assert.ok(!received.some(request => /jobs|unknown-generator|health\/tts|write-outside-api/.test(request)));
  assert.equal(upgrades, 0);
  assert.ok(blockedRequests.length >= 5);
  assert.ok(!JSON.stringify(blockedRequests).includes('private-query'));
});

test('a failed CDP connection still releases the created session and writes a redacted failure report', async (t) => {
  const outputDir = await directory(t);
  const fixture = cloudFixture({ connectError: new Error('CDP failed wss://connect.browserbase.com?apiKey=private-connect-token fake-key') });
  const report = await runBrowserbaseSmoke({ targetUrl, apiKey: 'fake-key', outputDir, log() {} }, fixture.dependencies);
  assert.equal(report.passed, false);
  assert.equal(fixture.effects.released.length, 1);
  assert.deepEqual(fixture.effects.released[0].body, { status: 'REQUEST_RELEASE' });
  assert.equal(report.session.finalStatus, 'COMPLETED');
  const saved = await fs.readFile(path.join(outputDir, 'report.json'), 'utf8');
  assert.ok(saved.includes('CDP failed'));
  assert.ok(!saved.includes('private-connect-token'));
  assert.ok(!saved.includes('fake-key'));
  assert.ok(saved.includes('https://www.browserbase.com/sessions/bc093aee-b9a7-4ccd-a7a8-2da584c92c3a'));
});

test('failed UI checks keep both viewport results and close every context in one session', async (t) => {
  const outputDir = await directory(t);
  const fixture = cloudFixture({ checkGuest: async (_context, run) => {
    run.checks.push({ name: 'onboarding', status: 'passed' });
    throw new Error('Card controls missing');
  } });
  const report = await runBrowserbaseSmoke({ targetUrl, apiKey: 'fake-key', outputDir, log() {} }, fixture.dependencies);
  assert.equal(report.passed, false);
  assert.equal(report.runs.length, 2);
  assert.ok(report.runs.every(run => run.errors.some(error => error.includes('Card controls missing'))));
  assert.equal(fixture.effects.created, 1);
  assert.equal(fixture.effects.contextsClosed, 2);
  assert.equal(fixture.effects.disconnected, 1);
  assert.equal(fixture.effects.released.length, 1);
});

test('cleanup failure makes an otherwise successful UI run fail', async (t) => {
  const fixture = cloudFixture({ releaseError: new Error('Release refused') });
  const report = await runBrowserbaseSmoke({ targetUrl, apiKey: 'fake-key', outputDir: await directory(t), log() {} }, fixture.dependencies);
  assert.equal(report.passed, false);
  assert.ok(report.cleanupErrors.some(error => error.includes('Release refused')));
});

test('an errored or timed-out cloud session cannot qualify a successful smoke run', async (t) => {
  for (const finalStatus of ['ERROR', 'TIMED_OUT', 'RUNNING']) {
    const fixture = cloudFixture({ finalStatus });
    const report = await runBrowserbaseSmoke({ targetUrl, apiKey: 'fake-key', outputDir: await directory(t), log() {} }, fixture.dependencies);
    assert.equal(report.passed, false);
    assert.equal(report.session.finalStatus, finalStatus);
  }
});

test('unexpected console errors fail the report while labelled guest and guard diagnostics do not', async (t) => {
  for (const expected of [false, true]) {
    const outputDir = path.join(await directory(t), String(expected));
    const fixture = cloudFixture({ checkGuest: async (_context, run) => {
      run.checks.push({ name: 'guest UI', status: 'passed' });
      run.consoleErrors.push({ text: 'Resource error', expected });
    } });
    const report = await runBrowserbaseSmoke({ targetUrl, apiKey: 'fake-key', outputDir, log() {} }, fixture.dependencies);
    assert.equal(report.passed, expected);
  }
});

test('cancellation after connecting stops further viewports and still releases the session', async (t) => {
  const controller = new AbortController();
  const fixture = cloudFixture({ checkGuest: async () => { controller.abort(); } });
  const report = await runBrowserbaseSmoke({ targetUrl, apiKey: 'fake-key', outputDir: await directory(t), signal: controller.signal, log() {} }, fixture.dependencies);
  assert.equal(report.passed, false);
  assert.equal(report.cancelled, true);
  assert.equal(report.runs.length, 1);
  assert.equal(fixture.effects.contextsClosed, 1);
  assert.equal(fixture.effects.released.length, 1);
});

test('refuses to overwrite evidence from an earlier run before spending browser time', async (t) => {
  const outputDir = await directory(t);
  await fs.writeFile(path.join(outputDir, 'report.json'), 'preserved evidence');
  const fixture = cloudFixture();
  await assert.rejects(runBrowserbaseSmoke({ targetUrl, apiKey: 'fake-key', outputDir, log() {} }, fixture.dependencies), /exist/i);
  assert.equal(fixture.effects.created, 0);
  assert.equal(await fs.readFile(path.join(outputDir, 'report.json'), 'utf8'), 'preserved evidence');
});
