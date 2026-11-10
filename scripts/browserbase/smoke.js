#!/usr/bin/env node
import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { parseEnv, stripVTControlCharacters } from 'node:util';
import { pathToFileURL } from 'node:url';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from '@playwright/test';
import { checkGuestUi } from './lib/guestChecks.js';

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1280, height: 900 } },
  { name: 'narrow', viewport: { width: 390, height: 844 } }
];
const READ_ONLY_API = new Set(['/api/auth/me', '/api/usage']);
export const USAGE = `Usage: npm run test:e2e:browserbase -- --url <https://app.example>

Run the Tableu guest UI in one Browserbase Chrome session at desktop and
narrow widths. Model requests, API writes, and WebSockets are blocked.

Options:
  --url <origin>       Public HTTPS app origin (or BROWSERBASE_SMOKE_URL)
  --output-dir <dir>   New report directory (default output/playwright/browserbase/<run-id>)
  --help               Show this help without creating a session

Reads BROWSERBASE_API_KEY from the environment or the existing .dev.vars.
Reports include checks, diagnostics, observed asset URLs, and full replay links.
`;

function validateTarget(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('A public HTTPS target --url is required.'); }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || url.pathname !== '/' || isIP(host) || !host.includes('.')
    || /\.(?:localhost|local|invalid)$/i.test(host)) {
    throw new Error('The target must be a public HTTPS origin without credentials, a path, query, or fragment.');
  }
  return url.origin;
}

function runDirectory() {
  return path.resolve('output', 'playwright', 'browserbase',
    `${new Date().toISOString().replace(/[-:.]/g, '')}-${randomUUID()}`);
}

export function parseSmokeArgs(argv, env = process.env) {
  const options = { targetUrl: env.BROWSERBASE_SMOKE_URL, outputDir: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') options.help = true;
    else if (flag === '--url' || flag === '--output-dir') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
      options[flag === '--url' ? 'targetUrl' : 'outputDir'] = value;
    } else throw new Error(`Unknown option: ${flag}`);
  }
  if (!options.help) options.targetUrl = validateTarget(options.targetUrl);
  options.outputDir = options.outputDir ? path.resolve(options.outputDir) : runDirectory();
  return options;
}

export function resolveSmokeApiKey({ env = process.env, devVarsPath = path.resolve('.dev.vars') } = {}) {
  if (env.BROWSERBASE_API_KEY?.trim()) return env.BROWSERBASE_API_KEY.trim();
  try { return parseEnv(fs.readFileSync(devVarsPath, 'utf8')).BROWSERBASE_API_KEY?.trim() || null; }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function publicUrl(value) {
  try {
    const url = new URL(value);
    const pathname = url.pathname.startsWith('/cdn-cgi/challenge-platform/')
      ? '/cdn-cgi/challenge-platform/[redacted]' : url.pathname;
    return `${url.origin}${pathname}`;
  }
  catch { return '[invalid URL]'; }
}

function safeMessage(error, apiKey) {
  let message = stripVTControlCharacters(String(error?.message || error));
  if (apiKey) message = message.replaceAll(apiKey, '[redacted]');
  return message.replace(/\b(?:https?|wss?):\/\/[^\s<>"']+/g, url =>
    /^wss?:/.test(url) ? '[browser connection URL redacted]' : publicUrl(url)).slice(0, 1500);
}

export async function installGuestNetworkGuard(context, { targetUrl, blockedRequests }) {
  const origin = new URL(targetUrl).origin;
  const blocked = new WeakSet();
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    let pathname;
    try { pathname = decodeURIComponent(url.pathname).toLowerCase(); }
    catch { pathname = '/api/invalid-path'; }
    let reason;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) reason = 'write-request';
    else if (/^\/(?:api(?:\/|$)|mcp(?:\/|$)|\.well-known\/oauth)/.test(pathname)
      && !(url.origin === origin && READ_ONLY_API.has(pathname))) reason = 'api-not-allowlisted';
    else if (/(^|\.)(?:openai\.com|anthropic\.com|generativelanguage\.googleapis\.com)$/.test(url.hostname)) reason = 'model-provider';
    else if (request.isNavigationRequest() && url.origin !== origin) reason = 'external-navigation';
    if (!reason) return route.continue();
    blocked.add(request);
    blockedRequests.push({ method, url: publicUrl(request.url()), reason });
    await route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', async socket => {
    blockedRequests.push({ method: 'WEBSOCKET', url: publicUrl(socket.url()), reason: 'websocket' });
    await socket.close();
  });
  return { isBlocked: request => blocked.has(request) };
}

export async function runBrowserbaseSmoke({ targetUrl, apiKey, outputDir = runDirectory(), signal, log = console.log }, {
  client = new Browserbase({ apiKey, timeout: 20000, maxRetries: 0 }),
  connect = url => chromium.connectOverCDP(url, { timeout: 20000 }),
  checkGuest = checkGuestUi
} = {}) {
  targetUrl = validateTarget(targetUrl);
  if (!apiKey?.trim()) throw new Error('Missing BROWSERBASE_API_KEY. Set it in .dev.vars or the environment.');
  signal?.throwIfAborted();
  outputDir = path.resolve(outputDir);
  await mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, 'report.json');
  const report = {
    schemaVersion: 1, targetUrl, startedAt: new Date().toISOString(), finishedAt: null,
    passed: false, cancelled: false, reportPath, session: null, runs: [], errors: [], cleanupErrors: [],
    coverage: 'Guest UI in cloud Chrome; narrow viewport emulation, no Safari or device certification.',
    requestPolicy: 'Only read-only auth/me and usage API requests are allowed; all writes, other APIs, model-provider requests, and WebSockets are blocked.'
  };
  // Reserve evidence before creating a billable resource; never replace a previous run.
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  let browser;
  try {
    signal?.throwIfAborted();
    const session = await client.sessions.create({
      api_timeout: 180, keepAlive: false, proxies: false,
      browserSettings: { recordSession: true, logSession: true, solveCaptchas: false },
      userMetadata: { workflow: 'tableu-guest-ui-smoke' }
    }, { signal, timeout: 20000, maxRetries: 0 });
    report.session = { id: session.id, url: `https://www.browserbase.com/sessions/${session.id}`, finalStatus: null };
    log(`Browser session: ${report.session.url}`);
    signal?.throwIfAborted();
    browser = await connect(session.connectUrl);
    report.browserVersion = browser.version();
    for (const profile of VIEWPORTS) {
      signal?.throwIfAborted();
      const run = { ...profile, checks: [], errors: [], pageErrors: [], consoleErrors: [], failedRequests: [], blockedRequests: [], assets: [] };
      report.runs.push(run);
      let context;
      let closing;
      const close = () => closing ??= context?.close();
      const abort = () => { void close()?.catch(() => {}); };
      try {
        context = await browser.newContext({ viewport: profile.viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
        signal?.addEventListener('abort', abort, { once: true });
        signal?.throwIfAborted();
        const guard = await installGuestNetworkGuard(context, { targetUrl, blockedRequests: run.blockedRequests });
        await checkGuest(context, run, { targetUrl, guard, signal, log });
        signal?.throwIfAborted();
      } catch (error) {
        run.errors.push(safeMessage(error, apiKey));
      } finally {
        signal?.removeEventListener('abort', abort);
        try { await close(); }
        catch (error) { report.cleanupErrors.push(`${profile.name} context: ${safeMessage(error, apiKey)}`); }
      }
      if (run.pageErrors.length) run.errors.push(...run.pageErrors.map(error => safeMessage(error, apiKey)));
      const unexpectedConsole = run.consoleErrors.filter(error => !error.expected);
      if (unexpectedConsole.length) run.errors.push(`${unexpectedConsole.length} unexpected console error(s); see consoleErrors.`);
      if (run.failedRequests.length) run.errors.push(`${run.failedRequests.length} unexpected network failure(s); see failedRequests.`);
      if (signal?.aborted) break;
    }
  } catch (error) {
    report.errors.push(safeMessage(error, apiKey));
  } finally {
    // Disconnect and explicitly release independently; a CDP failure must not leak a session.
    if (browser) {
      try { await browser.close(); }
      catch (error) { report.cleanupErrors.push(`Browser disconnect: ${safeMessage(error, apiKey)}`); }
    }
    if (report.session) {
      try {
        await client.sessions.update(report.session.id, { status: 'REQUEST_RELEASE' }, { timeout: 10000, maxRetries: 0 });
      } catch (error) { report.cleanupErrors.push(`Session release: ${safeMessage(error, apiKey)}`); }
      try {
        const session = await client.sessions.retrieve(report.session.id, { timeout: 10000, maxRetries: 0 });
        report.session.finalStatus = session.status;
        if (session.status !== 'COMPLETED') {
          report.cleanupErrors.push(`Session status is ${session.status} after release (expected COMPLETED); inspect its dashboard link.`);
        }
      } catch (error) { report.cleanupErrors.push(`Session status: ${safeMessage(error, apiKey)}`); }
    }
  }
  report.cancelled = Boolean(signal?.aborted);
  report.finishedAt = new Date().toISOString();
  report.passed = !report.cancelled && !report.errors.length && !report.cleanupErrors.length
    && report.runs.length === VIEWPORTS.length
    && report.runs.every(run => !run.errors.length && run.checks.length > 0 && run.checks.every(check => check.status === 'passed'));
  await writeFile(reportPath, `${JSON.stringify(report, (_key, value) => typeof value === 'string' ? safeMessage(value, apiKey) : value, 2)}\n`);
  log(`Result: ${report.passed ? 'PASS' : 'FAIL'}. Report: ${reportPath}`);
  if (report.session) log(`Replay: ${report.session.url}`);
  return report;
}

async function main() {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  let apiKey;
  try {
    const options = parseSmokeArgs(process.argv.slice(2));
    if (options.help) { console.log(USAGE); return; }
    apiKey = resolveSmokeApiKey();
    const report = await runBrowserbaseSmoke({ ...options, apiKey, signal: controller.signal });
    process.exitCode = report.cancelled ? 130 : report.passed ? 0 : 1;
  } catch (error) {
    console.error(safeMessage(error, apiKey));
    process.exitCode = controller.signal.aborted ? 130 : 1;
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
