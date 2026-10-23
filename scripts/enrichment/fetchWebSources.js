#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Browserbase from '@browserbasehq/sdk';
import { assessContent, createBrowserFallback, errorMessage } from './lib/browserFallback.js';

const DEFAULT_NUM_RESULTS = 5;
const DEFAULT_FETCH_COUNT = 3;
const MAX_NUM_RESULTS = 25;

export const USAGE = `Usage: node scripts/enrichment/fetchWebSources.js "<query>" [options]

Search the web with Browserbase Search, then fetch the top pages with
Browserbase Fetch — source material for the tarot knowledge base.
Blocked or empty Fetch responses get one Stagehand v4 browser attempt.
Browser fallback returns rendered plain text (or HTML with --format raw).

Options:
  --num-results <n>  Search results to request (1-${MAX_NUM_RESULTS}, default ${DEFAULT_NUM_RESULTS})
  --fetch <n>        How many of the top results to fetch (default ${DEFAULT_FETCH_COUNT})
  --format <fmt>     Fetch format: "markdown" (default) or "raw"
  --url <url>        Fetch a specific HTTP(S) URL instead of searching (repeatable)
  --browser-fallback <mode>  auto (default), always, or never
  --out <path>       Output JSON file (default data/enrichment/<query>-<UTC timestamp>-<run id>.json)
`;

export function parseDevVars(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, ...rest] = line.split('=');
      if (!key) return acc;
      const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
      acc[key.trim()] = value;
      return acc;
    }, {});
}

export function resolveApiKey({
  env = process.env,
  devVarsPath = path.resolve(process.cwd(), '.dev.vars')
} = {}) {
  if (typeof env.BROWSERBASE_API_KEY === 'string' && env.BROWSERBASE_API_KEY.trim()) {
    return { value: env.BROWSERBASE_API_KEY.trim(), source: 'process.env' };
  }
  if (fs.existsSync(devVarsPath)) {
    const fileVars = parseDevVars(fs.readFileSync(devVarsPath, 'utf8'));
    const value = fileVars.BROWSERBASE_API_KEY;
    if (typeof value === 'string' && value.trim()) {
      return { value: value.trim(), source: '.dev.vars' };
    }
  }
  return null;
}

export function slugify(text) {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'query';
}

function parsePositiveInt(value, flag) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer, got "${value}".`);
  }
  return parsed;
}

export function parseArgs(argv) {
  const options = {
    query: null,
    numResults: DEFAULT_NUM_RESULTS,
    fetchCount: DEFAULT_FETCH_COUNT,
    format: 'markdown',
    urls: [],
    browserFallback: 'auto',
    out: null,
    help: false
  };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--num-results') {
      options.numResults = parsePositiveInt(argv[++index], '--num-results');
    } else if (arg === '--fetch') {
      options.fetchCount = parsePositiveInt(argv[++index], '--fetch');
    } else if (arg === '--format') {
      const format = argv[++index];
      if (!['markdown', 'raw'].includes(format)) {
        throw new Error(`--format must be "markdown" or "raw", got "${format}".`);
      }
      options.format = format;
    } else if (arg === '--url') {
      const url = new URL(argv[++index]);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('--url must be an HTTP(S) URL without embedded credentials.');
      }
      options.urls.push(url.href);
    } else if (arg === '--browser-fallback') {
      options.browserFallback = argv[++index];
      if (!['auto', 'always', 'never'].includes(options.browserFallback)) {
        throw new Error('--browser-fallback must be auto, always, or never.');
      }
    } else if (arg === '--out') {
      options.out = argv[++index];
      if (!options.out) throw new Error('--out requires a file path.');
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  options.query = positional.join(' ').trim() || null;
  if (options.numResults > MAX_NUM_RESULTS) {
    throw new Error(`--num-results cannot exceed ${MAX_NUM_RESULTS}.`);
  }
  if (options.query?.length > 200) throw new Error('Search query cannot exceed 200 characters.');
  if (options.query && options.urls.length) throw new Error('Use a query or --url, not both.');
  return options;
}

export function buildOutputPath(query, outDir = path.resolve(process.cwd(), 'data', 'enrichment')) {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
  return path.join(outDir, `${slugify(query)}-${timestamp}-${randomUUID()}.json`);
}

export async function collectSources(targets, {
  bb,
  browser,
  format = 'markdown',
  browserFallback = 'auto',
  signal,
  log = console.log
}) {
  const sources = [];
  let primaryError;
  let cleanupErrors;
  try {
    for (const target of targets) {
      signal?.throwIfAborted();
      let fetchFailure;
      let attemptedBrowser = false;
      try {
        if (browserFallback !== 'always') {
          log(`Fetching ${target.url}`);
          // API auth/quota failures throw here. They are not target-site bot blocks.
          const response = await bb.fetchAPI.create({
            url: target.url, format, allowRedirects: true
          }, { signal, timeout: 30_000, maxRetries: 0 });
          const assessment = assessContent(response);
          if (!assessment.error) {
            sources.push({
              url: target.url,
              title: target.title,
              method: 'fetch',
              statusCode: response.statusCode,
              contentType: response.contentType,
              format,
              content: response.content
            });
            log(`Fetched HTTP ${response.statusCode} (${response.content.length} chars)`);
            continue;
          }
          fetchFailure = { statusCode: response.statusCode, error: assessment.error };
          if (!assessment.retryInBrowser || browserFallback === 'never') {
            throw new Error(assessment.error);
          }
          log(`${assessment.error}; trying the cloud browser once.`);
        }
        attemptedBrowser = true;
        const rendered = await browser.render(target.url, format);
        sources.push({ url: target.url, ...rendered, ...(fetchFailure && { fetchFailure }) });
        log(`Rendered HTTP ${rendered.statusCode} (${rendered.content.length} chars)`);
      } catch (error) {
        signal?.throwIfAborted();
        const message = errorMessage(error);
        sources.push({
          url: target.url,
          title: target.title,
          error: message,
          ...(fetchFailure && { fetchFailure }),
          ...(attemptedBrowser && browser.session())
        });
        log(`Source failed: ${message}`);
      }
    }
  } catch (error) {
    primaryError = error;
  } finally {
    cleanupErrors = await browser.close();
  }
  if (primaryError) {
    primaryError.cleanupErrors = cleanupErrors;
    throw primaryError;
  }
  return { sources, cleanupErrors };
}

async function run(signal) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || (!options.query && !options.urls.length)) {
    console.log(USAGE);
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.error('Missing BROWSERBASE_API_KEY. Set it in .dev.vars or export it first.');
    process.exitCode = 1;
    return;
  }

  const bb = new Browserbase({ apiKey: apiKey.value, timeout: 30_000, maxRetries: 0 });
  let search;
  if (options.urls.length) {
    search = { results: options.urls.map((url) => ({ url, title: url })) };
  } else {
    console.log(`Searching (key from ${apiKey.source}): "${options.query}"`);
    search = await bb.search.web({ query: options.query, numResults: options.numResults }, { signal });
    console.log(`Search request ${search.requestId} returned ${search.results.length} result(s):`);
  }
  search.results.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.title}\n     ${result.url}`);
  });

  const browser = createBrowserFallback({ apiKey: apiKey.value, signal });
  const { sources, cleanupErrors } = await collectSources(search.results.slice(0, options.fetchCount), {
    bb, browser, format: options.format, browserFallback: options.browserFallback, signal
  });

  const outPath = options.out ? path.resolve(options.out) : buildOutputPath(options.query || 'direct-sources');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const payload = {
    query: options.query,
    fetchedAt: new Date().toISOString(),
    searchRequestId: search.requestId,
    results: search.results,
    sources,
    cleanupErrors
  };
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: options.out ? 'w' : 'wx' });
  const succeeded = sources.filter((source) => !source.error).length;
  console.log(`\nWrote ${succeeded}/${sources.length} fetched source(s) to ${path.relative(process.cwd(), outPath) || outPath}`);
  for (const error of cleanupErrors) console.error(error);
  if (!sources.length || succeeded !== sources.length || cleanupErrors.length) process.exitCode ||= 1;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const controller = new AbortController();
  const onInterrupt = () => {
    process.exitCode = 130;
    controller.abort(new Error('Cancelled by SIGINT'));
  };
  const onTerminate = () => {
    process.exitCode = 143;
    controller.abort(new Error('Cancelled by SIGTERM'));
  };
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onTerminate);
  run(controller.signal)
    .catch((error) => {
      console.error(errorMessage(error));
      for (const cleanupError of error.cleanupErrors || []) console.error(cleanupError);
      process.exitCode ||= 1;
    })
    .finally(() => {
      process.removeListener('SIGINT', onInterrupt);
      process.removeListener('SIGTERM', onTerminate);
    });
}
