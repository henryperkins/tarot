/* global window, document */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, expect, webkit } from '@playwright/test';
import sharp from 'sharp';
import { createServer } from 'vite';

const fixturePath = '/__particle-compatibility__.html';
const html = `<!doctype html><html><head><meta charset="utf-8">
<style>body{margin:0;background:#171717}#root,#scene-particles{width:640px;height:360px}.absolute{position:absolute}.inset-0{inset:0}</style>
</head><body><div id="root"></div><script type="module">
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { tsParticles } from '@tsparticles/engine';
import { ParticleLayer } from '/src/components/ParticleLayer.jsx';
import { createParticleSession } from '/src/lib/particleLifecycle.js';
const root = createRoot(document.querySelector('#root'));
let generation = 0;
let failedLoads = 0;
window.particleTest = {
  engine: tsParticles,
  get failedLoads() { return failedLoads; },
  observeFailedLoads() {
    const load = tsParticles.load.bind(tsParticles);
    tsParticles.load = async (...args) => {
      try { return await load(...args); }
      catch (error) { failedLoads++; throw error; }
    };
  },
  render(preset) {
    generation += 1;
    root.render(React.createElement(StrictMode, null,
      React.createElement('div', { 'data-generation': generation, style: { position: 'relative' } },
        React.createElement(ParticleLayer, { preset }))));
    return generation;
  },
  dispose() { root.unmount(); },
  async failedLoad() {
    const element = document.createElement('div');
    element.style.cssText = 'width:400px;height:250px';
    document.body.append(element);
    const session = createParticleSession(async () => ({
      get items() { return tsParticles.items; },
      async load(parameters) {
        await tsParticles.load(parameters);
        throw new Error('controlled startup failure');
      }
    }));
    const view = session.mount({ id: 'controlled-failure', element,
      options: { fullScreen: { enable: false }, particles: { number: { value: 6 } } } });
    try {
      await view.ready;
      throw new Error('startup should reject');
    } catch (error) {
      return error.message;
    } finally {
      view.dispose();
      element.remove();
    }
  }
};
</script></body></html>`;

test('real particle engine paints presets and releases every canvas owner', { timeout: 90000 }, async t => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'tableu-particle-browser-'));
  let server;
  try {
    server = await createServer({
      configFile: path.resolve('vite.config.js'),
      cacheDir,
      logLevel: 'error',
      optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', '@tsparticles/engine', '@tsparticles/slim'] },
      server: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
      plugins: [{
        name: 'particle-compatibility-fixture',
        configureServer(instance) {
          instance.middlewares.use(async (request, response, next) => {
            if (request.url !== fixturePath) return next();
            try {
              response.setHeader('Content-Type', 'text/html');
              response.end(await instance.transformIndexHtml(fixturePath, html));
            } catch (error) { next(error); }
          });
        }
      }]
    });
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const [name, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
      await t.test(name, async t => {
        const browser = await browserType.launch({ headless: true });
        try {
          const page = await browser.newPage({ viewport: { width: 900, height: 650 }, reducedMotion: 'no-preference' });
          page.setDefaultTimeout(10000);
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
          await page.goto(`${origin}${fixturePath}`, { waitUntil: 'commit', timeout: 30000 });
          await page.waitForFunction(() => Boolean(window.particleTest), undefined, { timeout: 30000 });
          if (!await page.evaluate(() => typeof globalThis.OffscreenCanvas === 'function')) {
            t.diagnostic('OffscreenCanvas is unavailable. Checking decorative fallback.');
            await page.evaluate(() => window.particleTest.observeFailedLoads());
            for (const [index, preset] of ['idle', 'shuffle'].entries()) {
              await page.evaluate(value => window.particleTest.render(value), preset);
              await page.waitForFunction(attempts => window.particleTest.failedLoads >= attempts
                && window.particleTest.engine.items.length === 0 && !document.querySelector('canvas'), index + 1);
            }
            await page.evaluate(() => window.particleTest.dispose());
            assert.deepEqual(errors, []);
            return;
          }
          for (const preset of ['idle', 'shuffle', 'deal-trail', 'element-ambient', 'narrative-glow', 'idle']) {
            const generation = await page.evaluate(value => window.particleTest.render(value), preset);
            await page.waitForFunction(value => {
              const canvas = document.querySelector('[data-generation="' + value + '"] canvas');
              const containers = window.particleTest.engine.items;
              return Boolean(canvas?.width && canvas.height && containers.length === 1 && containers[0].started);
            }, generation);
            // Worker paint can arrive after the main thread has advanced several frames.
            const canvas = page.locator(`[data-generation="${generation}"] canvas`);
            await expect.poll(async () => {
              const { channels } = await sharp(await canvas.screenshot()).stats();
              return channels.slice(0, 3).some(channel => channel.max > 30);
            }, { timeout: 10000, message: `${preset} must paint visible particles` }).toBe(true);
          }
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.waitForFunction(() => !document.querySelector('canvas') && window.particleTest.engine.items.length === 0);
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          await page.waitForFunction(() => window.particleTest.engine.items.length === 1 && window.particleTest.engine.items[0].started);
          await page.evaluate(() => window.particleTest.dispose());
          await page.waitForFunction(() => window.particleTest.engine.items.length === 0);
          assert.equal(await page.evaluate(() => window.particleTest.failedLoad()), 'controlled startup failure');
          assert.equal(await page.evaluate(() => window.particleTest.engine.items.length), 0, 'rejected startup releases its registered container');
          assert.deepEqual(errors, []);
        } finally { await browser.close(); }
      });
    }
  } finally {
    await server?.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
});
