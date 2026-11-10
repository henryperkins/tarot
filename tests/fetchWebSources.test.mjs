import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  parseArgs,
  parseDevVars,
  resolveApiKey,
  slugify,
  buildOutputPath
} from '../scripts/enrichment/fetchWebSources.js';

test('parseArgs reads a positional query and applies defaults', () => {
  const options = parseArgs(['The', 'Fool', 'tarot']);
  assert.equal(options.query, 'The Fool tarot');
  assert.equal(options.numResults, 5);
  assert.equal(options.fetchCount, 3);
  assert.equal(options.format, 'markdown');
  assert.equal(options.out, null);
  assert.equal(options.help, false);
});

test('parseArgs reads flags', () => {
  const options = parseArgs(['tarot', '--num-results', '10', '--fetch', '2', '--format', 'raw', '--out', 'out.json']);
  assert.equal(options.query, 'tarot');
  assert.equal(options.numResults, 10);
  assert.equal(options.fetchCount, 2);
  assert.equal(options.format, 'raw');
  assert.equal(options.out, 'out.json');
});

test('parseArgs returns a null query when none is given', () => {
  assert.equal(parseArgs([]).query, null);
  assert.equal(parseArgs(['--fetch', '2']).query, null);
});

test('parseArgs rejects invalid input', () => {
  assert.throws(() => parseArgs(['--nope']), /Unknown flag/);
  assert.throws(() => parseArgs(['q', '--num-results', '26']), /cannot exceed 25/);
  assert.throws(() => parseArgs(['q', '--num-results', '0']), /positive integer/);
  assert.throws(() => parseArgs(['q', '--fetch', 'abc']), /positive integer/);
  assert.throws(() => parseArgs(['q', '--fetch', '1.5']), /positive integer/);
  assert.throws(() => parseArgs(['q', '--fetch', '2oops']), /positive integer/);
  assert.throws(() => parseArgs(['q', '--format', 'json']), /--format/);
  assert.throws(() => parseArgs(['q', '--out']), /requires a file path/);
  assert.throws(() => parseArgs(['q'.repeat(201)]), /200 characters/);
  assert.throws(() => parseArgs(['--browser-fallback', 'maybe']), /auto, always, or never/);
  assert.throws(() => parseArgs(['--url', 'file:///private']), /HTTP\(S\)/);
  assert.throws(() => parseArgs(['--url', 'https://user:password@example.com']), /credentials/);
  assert.throws(() => parseArgs(['q', '--url', 'https://example.com']), /not both/);
});

test('parseArgs supports explicit URLs and browser modes for repeatable verification', () => {
  const options = parseArgs(['--url', 'https://example.com/a', '--url', 'https://example.com/b', '--browser-fallback', 'always']);
  assert.deepEqual(options.urls, ['https://example.com/a', 'https://example.com/b']);
  assert.equal(options.query, null);
  assert.equal(options.browserFallback, 'always');
  assert.equal(parseArgs(['q']).browserFallback, 'auto');
});

test('slugify normalizes and caps query text', () => {
  assert.equal(slugify('The Fool (Tarot card)!'), 'the-fool-tarot-card');
  assert.equal(slugify('---'), 'query');
  assert.equal(slugify(''), 'query');
  assert.ok(slugify('x'.repeat(200)).length <= 60);
});

test('parseDevVars handles comments, quotes, and = in values', () => {
  const vars = parseDevVars([
    '# comment',
    '',
    'A=1',
    'B="two"',
    "C='three'",
    'D=foo=bar'
  ].join('\n'));
  assert.deepEqual(vars, { A: '1', B: 'two', C: 'three', D: 'foo=bar' });
});

test('resolveApiKey prefers process.env over .dev.vars', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-web-sources-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const devVarsPath = path.join(dir, '.dev.vars');
  fs.writeFileSync(devVarsPath, 'BROWSERBASE_API_KEY=from-file\n');

  const fromEnv = resolveApiKey({ env: { BROWSERBASE_API_KEY: 'from-env' }, devVarsPath });
  assert.deepEqual(fromEnv, { value: 'from-env', source: 'process.env' });

  const fromFile = resolveApiKey({ env: {}, devVarsPath });
  assert.deepEqual(fromFile, { value: 'from-file', source: '.dev.vars' });

  assert.equal(resolveApiKey({ env: {}, devVarsPath: path.join(dir, 'missing') }), null);
  assert.equal(resolveApiKey({ env: { BROWSERBASE_API_KEY: '  ' }, devVarsPath: path.join(dir, 'missing') }), null);
});

test('buildOutputPath includes an explicit UTC timestamp and unique run suffix', () => {
  const out = buildOutputPath('The Fool tarot', path.join('data', 'enrichment'));
  assert.match(out, /the-fool-tarot-\d{8}T\d{9}Z-[a-f0-9-]{36}\.json$/);
  assert.ok(out.startsWith(path.join('data', 'enrichment')));
});

test('same-millisecond direct and query runs cannot overwrite one another', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-22T00:30:00.000Z') });
  for (const query of ['direct-sources', 'The Fool tarot']) {
    const paths = Array.from({ length: 10 }, () => buildOutputPath(query));
    assert.equal(new Set(paths).size, 10);
    assert.ok(paths.every((out) => out.includes('20261022T003000000Z')));
  }
});
