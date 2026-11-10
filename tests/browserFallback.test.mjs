import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { assessContent, createBrowserFallback, errorMessage } from '../scripts/enrichment/lib/browserFallback.js';
import { collectSources } from '../scripts/enrichment/fetchWebSources.js';

const ARTICLE = 'The Fool Tarot Card Meanings\nThe Fool Upright\nNew beginnings\nThe Fool Reversed\nHolding back';
const CHALLENGE = '# Your connection needs to be verified before you can proceed';
const TARGETS = [{ title: 'First card', url: 'https://example.com/fool' }, { title: 'Second card', url: 'https://example.com/magician' }];
const SESSION_ID = '11111111-2222-4333-8444-555555555555';

function harness({
  fetchResponse = { statusCode: 403, content: CHALLENGE },
  fetchError,
  browserStatus = 200,
  browserContent = ARTICLE,
  initError,
  stagehandCloseError,
  browserCloseError,
  onLaunch = () => {},
  onNavigate = () => {},
  onWait = () => {},
  signal
} = {}) {
  const events = [];
  const logs = [];
  let currentUrl;
  let visits = 0;
  let elapsed = 0;
  let launches = 0;
  const waits = [];
  const status = () => typeof browserStatus === 'function' ? browserStatus(elapsed) : browserStatus;
  const text = () => typeof browserContent === 'function' ? browserContent(elapsed) : browserContent;
  const page = {
    async goto(url) {
      currentUrl = url;
      visits += 1;
      events.push(`navigate:${url}`);
      await onNavigate();
      const navigationStatus = status();
      return { status: () => navigationStatus };
    },
    async waitForSelector() { return true; },
    locator() { return { innerText: async () => `${text()}\nVisit ${visits}` }; },
    async evaluate(expression) {
      return runInNewContext(`(${expression.toString()})()`, {
        performance: { getEntriesByType: () => [{ responseStatus: status() }] },
        document: { documentElement: { outerHTML: `<html><body>${text()}</body></html>` } }
      });
    },
    async url() { return currentUrl; },
    async title() { return 'Rendered article'; }
  };
  const browserHandle = {
    sessionId: SESSION_ID,
    context: { pages: async () => [page] },
    async close() {
      events.push('browser-close');
      if (browserCloseError) throw browserCloseError;
    }
  };
  const browser = createBrowserFallback({
    apiKey: 'test-only',
    signal,
    log: (message) => logs.push(message),
    now: () => elapsed,
    async wait(ms) {
      waits.push(ms);
      elapsed += ms;
      await onWait();
      signal?.throwIfAborted();
    },
    async launch(options) {
      launches += 1;
      events.push('launch');
      assert.equal(options.apiKey, 'test-only');
      assert.equal(options.keepAlive, false);
      assert.equal(options.proxies, false);
      await onLaunch(launches);
      return { ...browserHandle, sessionId: launches === 1 ? SESSION_ID : `session-${launches}` };
    },
    async createStagehand(options) {
      events.push('stagehand-create');
      assert.equal(options.browser.context, browserHandle.context);
      if (initError) throw initError;
      return {
        async close() {
          events.push('stagehand-close');
          if (stagehandCloseError) throw stagehandCloseError;
        }
      };
    }
  });
  const bb = {
    fetchAPI: {
      async create({ url }) {
        events.push(`fetch:${url}`);
        if (fetchError) throw fetchError;
        return typeof fetchResponse === 'function' ? fetchResponse(url) : fetchResponse;
      }
    }
  };
  const collect = (targets = TARGETS, options = {}) => collectSources(targets, {
    bb, browser, signal, log: (message) => logs.push(message), ...options
  });
  return { collect, browser, events, logs, waits, advance: (ms) => { elapsed += ms; } };
}

test('response validation rejects HTTP errors, empty/binary content and 200 challenge pages', () => {
  for (const response of [
    { statusCode: 403, content: 'Forbidden' },
    { statusCode: 429, content: 'Too many requests' },
    { statusCode: 200, content: CHALLENGE },
    { statusCode: 200, content: '<html><title>Just a moment...</title><body>Please wait</body></html>' },
    { statusCode: 200, content: '' }
  ]) {
    assert.equal(assessContent(response).retryInBrowser, true);
    assert.ok(assessContent(response).error);
  }
  for (const response of [
    { statusCode: 404, content: 'Not found' },
    { statusCode: 500, content: 'Server error' },
    { statusCode: 200, content: 'abcd', encoding: 'base64' },
    { content: ARTICLE }
  ]) {
    assert.equal(assessContent(response).retryInBrowser, false);
    assert.ok(assessContent(response).error);
  }
  assert.equal(assessContent({ statusCode: 200, content: '<script>"checking your browser"</script><article>How CAPTCHA works. Powered by Cloudflare.</article>' }).error, null);
});

test('403 and 200 bot-check responses use one shared session across sequential sources', async () => {
  const { collect, events, logs } = harness({
    fetchResponse: (url) => ({ statusCode: url.endsWith('fool') ? 403 : 200, content: CHALLENGE })
  });
  const result = await collect();
  assert.deepEqual(result.cleanupErrors, []);
  assert.equal(result.sources.length, 2);
  assert.equal(events.filter((event) => event === 'launch').length, 1);
  assert.equal(events.filter((event) => event === 'stagehand-create').length, 1);
  for (const [index, source] of result.sources.entries()) {
    assert.equal(source.error, undefined);
    assert.equal(source.sessionId, SESSION_ID);
    assert.equal(source.finalUrl, TARGETS[index].url);
    assert.equal(source.method, 'browser');
    assert.equal(source.format, 'text');
    assert.match(source.content, new RegExp(`Visit ${index + 1}`));
    assert.ok(source.fetchFailure.error);
  }
  assert.ok(logs.some((line) => line.includes(`https://www.browserbase.com/sessions/${SESSION_ID}`)));
  assert.deepEqual(events.slice(-2), ['stagehand-close', 'browser-close']);
});

test('usable Fetch data avoids browser startup', async () => {
  const { collect, events } = harness({ fetchResponse: { statusCode: 200, content: ARTICLE } });
  const result = await collect(TARGETS.slice(0, 1));
  assert.equal(result.sources[0].method, 'fetch');
  assert.equal(result.sources[0].format, 'markdown');
  assert.deepEqual(events, [`fetch:${TARGETS[0].url}`]);
});

test('never mode records a blocked source without saving challenge text as content', async () => {
  const { collect, events } = harness();
  const result = await collect(TARGETS.slice(0, 1), { browserFallback: 'never' });
  assert.match(result.sources[0].error, /HTTP 403/);
  assert.equal(result.sources[0].content, undefined);
  assert.equal(events.includes('launch'), false);
});

test('Browserbase API authorization and quota errors never trigger browser fallback', async () => {
  for (const status of [401, 403, 429]) {
    const { collect, events } = harness({ fetchError: new Error(`Browserbase API ${status}`) });
    const result = await collect(TARGETS.slice(0, 1));
    assert.match(result.sources[0].error, new RegExp(String(status)));
    assert.equal(events.includes('launch'), false);
  }
});

test('a browser that stays blocked fails once with a replay link and closes', async () => {
  const { collect, events, waits } = harness({ browserContent: CHALLENGE });
  const result = await collect(TARGETS.slice(0, 1));
  assert.match(result.sources[0].error, /bot-verification/);
  assert.equal(result.sources[0].content, undefined);
  assert.equal(result.sources[0].sessionId, SESSION_ID);
  assert.equal(events.filter((event) => event.startsWith('navigate:')).length, 1);
  assert.equal(waits.reduce((sum, ms) => sum + ms, 0), 15_000);
  assert.deepEqual(events.slice(-2), ['stagehand-close', 'browser-close']);
});

for (const initialStatus of [403, 200]) {
  test(`a ${initialStatus} challenge can clear through same-URL navigation without a reload`, async () => {
    const { collect, events, waits } = harness({
      browserStatus: (elapsed) => elapsed < 2_000 ? initialStatus : 200,
      browserContent: (elapsed) => elapsed < 2_000 ? CHALLENGE : ARTICLE
    });
    const result = await collect(TARGETS.slice(0, 1));
    assert.equal(result.sources[0].error, undefined);
    assert.equal(result.sources[0].statusCode, 200);
    assert.match(result.sources[0].content, /The Fool Tarot Card Meanings/);
    assert.deepEqual(waits, [1_000, 1_000]);
    assert.equal(events.filter((event) => event.startsWith('navigate:')).length, 1);
  });
}

test('a persistent 403 challenge fails within the settlement budget', async () => {
  const { collect, waits } = harness({ browserStatus: 403, browserContent: CHALLENGE });
  const result = await collect(TARGETS.slice(0, 1));
  assert.match(result.sources[0].error, /HTTP 403/);
  assert.equal(result.sources[0].content, undefined);
  assert.equal(waits.reduce((sum, ms) => sum + ms, 0), 15_000);
});

test('challenge settlement tolerates the old document disappearing during navigation', async () => {
  const { collect, waits } = harness({
    browserStatus: (elapsed) => elapsed < 2_000 ? 403 : 200,
    browserContent: (elapsed) => {
      if (elapsed === 1_000) throw new Error('Execution context was destroyed during navigation');
      return elapsed < 2_000 ? CHALLENGE : ARTICLE;
    }
  });
  const result = await collect(TARGETS.slice(0, 1));
  assert.equal(result.sources[0].error, undefined);
  assert.equal(result.sources[0].statusCode, 200);
  assert.deepEqual(waits, [1_000, 1_000]);
});

test('cancelling challenge settlement preserves cancellation and closes both resources', async () => {
  const controller = new AbortController();
  const reason = new Error('Cancelled while challenge was pending');
  const { collect, events, waits } = harness({
    signal: controller.signal,
    browserContent: CHALLENGE,
    onWait: () => controller.abort(reason)
  });
  await assert.rejects(collect(), (error) => error === reason);
  assert.deepEqual(waits, [1_000]);
  assert.deepEqual(events.slice(-2), ['stagehand-close', 'browser-close']);
});

test('terminal browser HTTP errors fail without challenge polling', async () => {
  const { collect, waits } = harness({ browserStatus: 404, browserContent: 'Not found' });
  const result = await collect(TARGETS.slice(0, 1));
  assert.match(result.sources[0].error, /HTTP 404/);
  assert.deepEqual(waits, []);
});

test('a long run rotates sessions before starting a read near the five-minute expiry', async () => {
  const { browser, events, advance } = harness();
  try {
    const first = await browser.render(TARGETS[0].url, 'markdown');
    advance(245_000);
    const second = await browser.render(TARGETS[1].url, 'markdown');
    assert.equal(second.error, undefined);
    assert.notEqual(second.sessionId, first.sessionId);
    assert.deepEqual(events, [
      'launch', 'stagehand-create', `navigate:${TARGETS[0].url}`,
      'stagehand-close', 'browser-close',
      'launch', 'stagehand-create', `navigate:${TARGETS[1].url}`
    ]);
  } finally {
    assert.deepEqual(await browser.close(), []);
  }
});

test('session rotation retains cleanup failures until the run closes', async () => {
  const { browser, advance, events } = harness({ stagehandCloseError: new Error('Runtime close failed') });
  try {
    await browser.render(TARGETS[0].url, 'markdown');
    advance(245_000);
    await browser.render(TARGETS[1].url, 'markdown');
  } finally {
    assert.deepEqual(await browser.close(), [
      'Stagehand cleanup failed: Runtime close failed',
      'Stagehand cleanup failed: Runtime close failed'
    ]);
  }
  assert.equal(events.filter((event) => event === 'browser-close').length, 2);
});

test('cancellation during session rotation waits for and closes the replacement browser', async () => {
  const controller = new AbortController();
  const { browser, advance, events } = harness({
    signal: controller.signal,
    onLaunch: (count) => { if (count === 2) controller.abort(new Error('Cancelled during relaunch')); }
  });
  try {
    await browser.render(TARGETS[0].url, 'markdown');
    advance(245_000);
    await assert.rejects(browser.render(TARGETS[1].url, 'markdown'), /Cancelled during relaunch/);
  } finally {
    assert.deepEqual(await browser.close(), []);
  }
  assert.equal(events.filter((event) => event === 'stagehand-create').length, 1);
  assert.equal(events.filter((event) => event === 'browser-close').length, 2);
});

test('a failed Stagehand initialization still closes its browser and preserves the original error', async () => {
  const { collect, events } = harness({
    initError: new Error('Initialization failed'),
    browserCloseError: new Error('Release failed')
  });
  const result = await collect(TARGETS.slice(0, 1));
  assert.equal(result.sources[0].error, 'Initialization failed');
  assert.deepEqual(result.cleanupErrors, ['Browser cleanup failed: Release failed']);
  assert.equal(events.at(-1), 'browser-close');
});

test('both cleanup operations are attempted and reported when successful work cannot close cleanly', async () => {
  const { collect, browser, events } = harness({
    stagehandCloseError: new Error('Runtime close failed'),
    browserCloseError: new Error('Session close failed')
  });
  const result = await collect(TARGETS.slice(0, 1));
  assert.equal(result.sources[0].error, undefined);
  assert.equal(result.cleanupErrors.length, 2);
  assert.deepEqual(events.slice(-2), ['stagehand-close', 'browser-close']);
  assert.deepEqual(await browser.close(), result.cleanupErrors);
  assert.equal(events.filter((event) => event === 'browser-close').length, 1);
});

test('cancellation during navigation preserves the cancellation and reports cleanup separately', async () => {
  const controller = new AbortController();
  const reason = new Error('User cancelled');
  const { collect, events } = harness({
    signal: controller.signal,
    onNavigate: () => controller.abort(reason),
    stagehandCloseError: new Error('Runtime close failed'),
    browserCloseError: new Error('Session close failed')
  });
  await assert.rejects(collect(), (error) => {
    assert.equal(error, reason);
    assert.equal(error.cleanupErrors.length, 2);
    return true;
  });
  assert.deepEqual(events.slice(-2), ['stagehand-close', 'browser-close']);
  assert.equal(events.filter((event) => event.startsWith('navigate:')).length, 1);
});

test('cancellation during launch waits for the acquired browser and releases it', async () => {
  const controller = new AbortController();
  const { collect, events } = harness({
    signal: controller.signal,
    onLaunch: () => controller.abort(new Error('Cancelled during launch'))
  });
  await assert.rejects(collect(), /Cancelled during launch/);
  assert.equal(events.includes('stagehand-create'), false);
  assert.equal(events.at(-1), 'browser-close');
});

test('always mode skips Fetch and labels rendered HTML accurately', async () => {
  const { collect, events } = harness();
  const result = await collect(TARGETS.slice(0, 1), { browserFallback: 'always', format: 'raw' });
  assert.equal(events.some((event) => event.startsWith('fetch:')), false);
  assert.equal(result.sources[0].format, 'raw');
  assert.equal(result.sources[0].contentType, 'text/html');
  assert.match(result.sources[0].content, /^<html>/);
});

test('error output redacts Browserbase credentials and signed connection query values', () => {
  const message = errorMessage(new Error('bb_test_exampleCredential wss://example.com?apiKey=private-value&t=private-token'));
  assert.doesNotMatch(message, /exampleCredential|private-value|private-token/);
});
