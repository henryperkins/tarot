import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { browserbase, Stagehand } from '@browserbasehq/stagehand';

// Match challenge text, not incidental references to CAPTCHA/Cloudflare in articles.
const CHALLENGE = /^(?:#{1,6}\s*)?(?:your connection needs to be verified[^\n]*|just a moment[.!…]*|(?:please )?verify (?:that )?you are (?:a )?human[^\n]*|checking your browser[^\n]*|performing security verification[^\n]*|enable javascript and cookies to continue[.!]*|access denied[.!]*|attention required[! ]*(?:\|\s*cloudflare)?)\s*$/im;
const SESSION_TIMEOUT_SECONDS = 300;
const READ_RESERVE_MS = 60_000;
const CHALLENGE_WAIT_MS = 15_000;

export function assessContent({ statusCode, content, encoding }) {
  if (statusCode === 403 || statusCode === 429) {
    return { error: `Source returned HTTP ${statusCode}`, retryInBrowser: true };
  }
  if (!Number.isInteger(statusCode) || statusCode < 200 || statusCode >= 300) {
    return { error: `Source returned HTTP ${statusCode ?? 'unknown'}`, retryInBrowser: false };
  }
  if (encoding === 'base64') {
    return { error: 'Binary content is not a text source', retryInBrowser: false };
  }
  if (typeof content !== 'string' || !content.trim()) {
    return { error: 'Source returned no text', retryInBrowser: true };
  }
  const visibleText = content
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ');
  if (CHALLENGE.test(visibleText)) {
    return { error: 'Source returned a bot-verification page', retryInBrowser: true };
  }
  return { error: null, retryInBrowser: false };
}

export function errorMessage(error) {
  return String(error?.message || error)
    .replace(/bb_(?:live|test)_[\w-]+/g, '[REDACTED]')
    .replace(/([?&](?:apiKey|api_key|token|t)=)[^\s&"']+/gi, '$1[REDACTED]');
}

async function abortable(operation, signal) {
  if (!signal) return operation;
  let onAbort;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        onAbort = () => reject(signal.reason || new Error('Cancelled'));
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
      })
    ]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

/** Lazily reuse a browser, rotating before its session can expire mid-read. */
export function createBrowserFallback({
  apiKey,
  signal,
  log = console.log,
  marker = `enrichment-${randomUUID()}`,
  launch = (options) => browserbase.launch(options),
  createStagehand = (options) => Stagehand.create(options),
  now = Date.now,
  wait = (ms) => delay(ms, undefined, { signal })
}) {
  let browser;
  let stagehand;
  let page;
  let initialization;
  let closing;
  let expiresAt;
  const cleanupErrors = [];

  const session = () => browser?.sessionId ? {
    sessionId: browser.sessionId,
    sessionUrl: `https://www.browserbase.com/sessions/${browser.sessionId}`
  } : {};

  async function initialize() {
    signal?.throwIfAborted();
    log('Starting a Browserbase browser for source rendering...');
    expiresAt = now() + SESSION_TIMEOUT_SECONDS * 1_000;
    browser = await launch({
      apiKey,
      timeout: SESSION_TIMEOUT_SECONDS,
      keepAlive: false,
      proxies: false,
      browserSettings: { solveCaptchas: false },
      userMetadata: { enrichment_run: marker },
      clientOptions: { timeout: 30_000, maxRetries: 0 }
    });
    log(`Browser session: ${session().sessionUrl}`);
    signal?.throwIfAborted();
    stagehand = await createStagehand({ browser, cache: true, logging: { level: 'off' } });
    signal?.throwIfAborted();
    page = (await browser.context.pages())[0] || await browser.context.newPage();
  }

  async function readPage(url, format) {
    signal?.throwIfAborted();
    log(`Rendering ${url}`);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    signal?.throwIfAborted();
    const ready = await page.waitForSelector('body', { state: 'visible', timeout: 10_000 });
    if (!ready) throw new Error('Browser page did not render a visible body');
    signal?.throwIfAborted();
    // Read rendered text for validation even when the caller requests raw HTML.
    let text;
    let statusCode = response?.status();
    let settling = statusCode === 403 || statusCode === 429;
    let waitingLogged = false;
    const deadline = now() + CHALLENGE_WAIT_MS;
    while (true) {
      signal?.throwIfAborted();
      let assessment;
      try {
        text = await page.locator('body').innerText({ timeout: 1_000 });
        settling ||= assessContent({ statusCode, content: text }).retryInBrowser;
        // goto's Response describes the first document. A challenge can replace
        // it at the same URL, so use the current document's navigation timing.
        const currentStatus = await page.evaluate(() =>
          globalThis.performance.getEntriesByType('navigation')[0]?.responseStatus
        );
        if (Number.isInteger(currentStatus) && currentStatus > 0) statusCode = currentStatus;
        assessment = assessContent({ statusCode, content: text });
      } catch (error) {
        signal?.throwIfAborted();
        // Auto-navigation can briefly destroy the old execution context.
        if (!settling) throw error;
        assessment = { error: errorMessage(error), retryInBrowser: true };
      }
      if (!assessment.error) break;
      const remaining = deadline - now();
      if (!assessment.retryInBrowser || remaining <= 0) throw new Error(assessment.error);
      if (!waitingLogged) {
        log('Waiting for browser verification to settle...');
        waitingLogged = true;
      }
      await wait(Math.min(1_000, remaining));
    }
    signal?.throwIfAborted();
    const content = format === 'raw'
      ? await page.evaluate(() => globalThis.document.documentElement.outerHTML)
      : text;
    return {
      ...session(),
      finalUrl: await page.url(),
      title: await page.title(),
      statusCode,
      method: 'browser',
      // Rendered innerText is plain text, not Markdown or the original HTML.
      format: format === 'raw' ? 'raw' : 'text',
      contentType: format === 'raw' ? 'text/html' : 'text/plain',
      content
    };
  }

  async function release() {
    for (const [name, resource] of [['Stagehand', stagehand], ['Browser', browser]]) {
      if (!resource) continue;
      try {
        await resource.close();
      } catch (error) {
        cleanupErrors.push(`${name} cleanup failed: ${errorMessage(error)}`);
      }
    }
    stagehand = undefined;
    browser = undefined;
    page = undefined;
  }

  return {
    session,
    async render(url, format) {
      if (closing) throw new Error('Browser fallback is already closed');
      signal?.throwIfAborted();
      initialization ??= initialize();
      await abortable(initialization, signal);
      signal?.throwIfAborted();
      if (now() >= expiresAt - READ_RESERVE_MS) {
        initialization = (async () => {
          await release();
          await initialize();
        })();
        await abortable(initialization, signal);
      }
      signal?.throwIfAborted();
      return abortable(readPage(url, format), signal);
    },
    close() {
      closing ??= (async () => {
        // If cancellation happens during launch, wait for ownership before cleanup.
        await initialization?.catch(() => {});
        await release();
        return cleanupErrors;
      })();
      return closing;
    }
  };
}
