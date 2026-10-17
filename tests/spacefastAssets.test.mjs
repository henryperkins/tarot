import test from 'node:test';
import assert from 'node:assert/strict';
import { createShellAssets } from '../spacefast/assets.js';

const assets = createShellAssets('<!doctype html><title>Tableu</title>');

test('SPA and share routes receive the shell, including dotted client routes', async () => {
  for (const path of ['/journal', '/share/example', '/users/jane.doe', '/index.html']) {
    const response = await assets.fetch(`https://tableu.test${path}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>Tableu/);
  }
});

test('missing assets do not become HTML responses', async () => {
  for (const path of ['/assets/missing.js', '/missing.png', '/manifest.webmanifest', '/index.html.map']) {
    assert.equal((await assets.fetch(`https://tableu.test${path}`)).status, 404);
  }
});

test('HEAD has no body and non-read methods return 405', async () => {
  assert.equal(await (await assets.fetch(new Request('https://tableu.test/journal', { method: 'HEAD' }))).text(), '');
  const response = await assets.fetch(new Request('https://tableu.test/journal', { method: 'POST' }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET, HEAD');
});
