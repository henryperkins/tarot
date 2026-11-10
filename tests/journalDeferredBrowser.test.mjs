/* global window, document */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createVisualCueLedger } from '../shared/reading/visualCueLedger.js';

const ORIGINAL_ENTRY = { id: 'deferred-original', question: 'A quieter pace', deckId: 'rws-1909',
  cards: [{ name: 'The Star', position: 'Theme', orientation: 'Upright' }],
  personalReading: '## Opening\n\nThe Star invites **rest**.' };
const ORIGINAL_BINDING = { readingResultId: 'deferred-original-result', sourceRevision: 0,
  spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'deferred-v1' };

const harness = String.raw`
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './src/contexts/AuthContext.jsx';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext.jsx';
import { useJournal } from './src/hooks/useJournal.js';
import { NarrativeSection } from './src/components/journal/entry-card/EntrySections/NarrativeSection.jsx';
const entry = { id: 'deferred-journal', question: 'A quieter pace', deckId: 'rws-1909',
  cards: [{ name: 'The Star', position: 'Theme', orientation: 'Upright' }],
  personalReading: '## Opening\n\nThe Star invites **rest**. [Keep focus](#focus)\n\n<script>window.unsafeJournal = true</script>' };
window.retryCalls = 0;
function App() {
  const { entries } = useJournal();
  const current = entries[0] || entry;
  return <>
  <button id='outside'>Outside focus</button>
  <NarrativeSection narrativeText={current.personalReading} narrativeId='journal-reading' entry={current}
    gestureStudyEnabled={new URLSearchParams(location.search).has('gestures')}
    onRetryVisuals={async () => { window.retryCalls += 1; }} />
  <button id='after'>After reading</button>
  </>;
}
createRoot(document.getElementById('root')).render(<AuthProvider><SubscriptionProvider><App /></SubscriptionProvider></AuthProvider>);`;

test('optimized Journal defers rendering and keeps recovery usable when its gesture chunk fails', { timeout: 60000 }, async t => {
  const outdir = await mkdtemp('/tmp/opencode/tableu-journal-deferred-');
  let browser;
  let server;
  try {
    const { metafile } = await build({
      stdin: { contents: harness, resolveDir: process.cwd(), sourcefile: 'journal-deferred.jsx', loader: 'jsx' },
      bundle: true, splitting: true, format: 'esm', platform: 'browser', outdir, metafile: true,
      minify: true, jsx: 'automatic',
      define: { 'import.meta.env': JSON.stringify({ DEV: false, MODE: 'production',
        VITE_READING_ALIGNER_ENABLED: 'true', VITE_READING_MODEL_ANNOTATIONS: 'true' }), 'process.env.NODE_ENV': '"production"' },
      loader: { '.svg': 'dataurl' }, logLevel: 'silent'
    });
    const filesFor = pattern => Object.entries(metafile.outputs)
      .filter(([, output]) => Object.keys(output.inputs).some(input => pattern.test(input)))
      .map(([file]) => path.basename(file));
    const markdownFiles = filesFor(/JournalMarkdown\.jsx$/);
    const gestureFiles = filesFor(/RestoredReadingGestures\.jsx$/);
    assert.ok(markdownFiles.length && gestureFiles.length, 'optimized rich-rendering modules exist');
    server = createServer(async (request, response) => {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname.startsWith('/api/')) {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(pathname === '/api/auth/me' ? { user: null }
          : { subscription: { tier: 'free', status: 'inactive' } }));
        return;
      }
      if (pathname === '/') {
        response.setHeader('Content-Type', 'text/html');
        response.end('<div id="root"></div><script type="module" src="/stdin.js"></script>');
        return;
      }
      try {
        response.setHeader('Content-Type', 'text/javascript');
        response.end(await readFile(path.join(outdir, path.basename(pathname))));
      } catch { response.statusCode = 404; response.end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });

    const plain = await browser.newPage();
    const requested = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await plain.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      requested.push(path.basename(url.pathname));
      if (markdownFiles.includes(path.basename(url.pathname))) await gate;
      return route.continue();
    });
    try {
      await plain.goto(origin);
      const toggle = plain.getByRole('button', { name: 'Reading narrative', exact: true });
      await toggle.waitFor();
      assert.deepEqual(requested.filter(file => [...markdownFiles, ...gestureFiles].includes(file)), [], 'collapsed narrative loads no renderer');
      await toggle.click();
      await plain.locator('.journal-reading > p').waitFor();
      assert.ok((await plain.locator('.journal-reading').textContent()).includes('The Star invites **rest**.'), 'saved text is readable while formatting loads');
      await plain.locator('#outside').focus();
      await plain.locator('#outside').evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      });
      release();
      await plain.getByRole('heading', { name: 'Opening', level: 4 }).waitFor();
      await plain.getByRole('link', { name: 'Keep focus' }).waitFor();
      assert.equal(await plain.locator('#outside').evaluate(element => element === document.activeElement), true);
      assert.equal(await plain.evaluate(() => window.getSelection().toString()), 'Outside focus', 'unrelated selection neither blocks formatting nor gets cleared');
      assert.equal(await plain.evaluate(() => Boolean(window.unsafeJournal)), false, 'saved HTML never executes');
      assert.deepEqual(requested.filter(file => gestureFiles.includes(file)), [], 'ordinary Markdown never loads restored gestures');
    } finally { release(); await plain.close(); }

    const failed = await browser.newPage();
    const errors = [];
    failed.on('pageerror', error => errors.push(error.message));
    await failed.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin !== origin || gestureFiles.includes(path.basename(url.pathname)) ? route.abort() : route.continue();
    });
    await failed.goto(`${origin}/?gestures`);
    await failed.getByRole('button', { name: 'Reading narrative', exact: true }).click();
    await failed.getByRole('alert').waitFor();
    await failed.getByTestId('saved-visual-recovery').waitFor();
    assert.ok((await failed.locator('.journal-reading').textContent()).includes('The Star invites **rest**.'));
    await failed.getByRole('button', { name: 'Retry card connections', exact: true }).press('Enter');
    assert.equal(await failed.evaluate(() => window.retryCalls), 1, 'recovery remains actionable without the rich renderer');
    assert.equal(await failed.evaluate(() => Boolean(window.unsafeJournal)), false);
    assert.deepEqual(errors, [], 'a failed optional renderer does not crash the journal');
    await failed.close();

    await t.test('a selection spanning the entire fallback postpones formatting even with endpoints outside it', async () => {
      const selected = await browser.newPage();
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await selected.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (markdownFiles.includes(path.basename(url.pathname))) await gate;
        return route.continue();
      });
      try {
        await selected.goto(origin);
        await selected.getByRole('button', { name: 'Reading narrative', exact: true }).click();
        await selected.locator('.journal-reading > p').waitFor();
        const quote = await selected.evaluate(() => {
          window.getSelection().setBaseAndExtent(document.querySelector('#outside').firstChild, 0,
            document.querySelector('#after').firstChild, 'After reading'.length);
          return window.getSelection().toString();
        });
        release();
        await selected.getByRole('heading', { name: 'Opening', level: 4, includeHidden: true }).waitFor({ state: 'attached' });
        assert.equal(await selected.getByRole('heading', { name: 'Opening', level: 4 }).count(), 0);
        assert.equal(await selected.evaluate(() => window.getSelection().toString()), quote);
        await selected.evaluate(() => window.getSelection().removeAllRanges());
        await selected.getByRole('heading', { name: 'Opening', level: 4 }).waitFor();
      } finally { release(); await selected.close(); }
    });

    for (const outcome of ['complete', 401, 403, 410]) {
      await t.test(`original transport ${outcome} settles without the gesture renderer`, async () => {
        const page = await browser.newPage();
        const binding = ORIGINAL_BINDING;
        const original = { ...ORIGINAL_ENTRY, readingResultId: binding.readingResultId, visualBinding: binding,
          visual: { readingResultId: binding.readingResultId, binding, status: 'pending', ledgerRevision: 0, snapshot: null } };
        const privateKey = `tarot_visual_resume:anon:${binding.readingResultId}`;
        const requests = [];
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const ledger = { ...createVisualCueLedger(binding), raw: original.personalReading,
          analyzedEnd: original.personalReading.length, ledgerRevision: 1 };
        await page.addInitScript(({ original, privateKey, binding }) => {
          localStorage.setItem('tarot_journal', JSON.stringify([original]));
          localStorage.setItem(privateKey, JSON.stringify({ binding, visualJobToken: 'deferred-private-original', expiresAt: Date.now() + 600000 }));
        }, { original, privateKey, binding });
        await page.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.origin !== origin || gestureFiles.includes(path.basename(url.pathname))) return route.abort();
          if (url.pathname.startsWith('/api/tarot-reading/visuals/')) {
            requests.push({ method: route.request().method(), path: url.pathname });
            await gate;
            return outcome === 'complete' ? route.fulfill({ contentType: 'text/event-stream',
              body: `event: done\ndata: ${JSON.stringify({ binding, cueLedger: ledger, status: 'complete', eventId: 1 })}\n\n` })
              : route.fulfill({ status: outcome, json: { error: 'Original capability is no longer available' } });
          }
          return route.continue();
        });
        try {
          await page.goto(`${origin}/?gestures`);
          await page.getByRole('button', { name: 'Reading narrative', exact: true }).click();
          await page.getByRole('alert').waitFor();
          await page.locator('[data-recovery-phase="pending"]').waitFor();
          assert.equal(await page.getByRole('button', { name: 'Retry card connections', exact: true }).count(), 0);
          release();
          if (outcome === 'complete') {
            await page.locator('[data-recovery-phase="complete"]').waitFor();
            assert.equal(await page.getByTestId('saved-visual-recovery').textContent(), 'Card connections are ready.');
            const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_journal'))[0]);
            assert.equal(saved.visual.status, 'complete');
            assert.equal(saved.visual.snapshot.raw, original.personalReading);
          } else {
            const retry = page.getByRole('button', { name: 'Retry card connections', exact: true });
            await retry.waitFor();
            await retry.press('Enter');
            assert.equal(await page.evaluate(() => window.retryCalls), 1);
          }
          assert.equal(await page.evaluate(key => localStorage.getItem(key), privateKey), null, 'original handle is retired');
          assert.deepEqual(requests, [{ method: 'GET', path: `/api/tarot-reading/visuals/${binding.readingResultId}/stream` }], 'one original subscription and no inference request');
          assert.equal(await page.locator('.journal-reading > p').textContent(), original.personalReading);
        } finally { release(); await page.close(); }
      });
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server ? server.close(resolve) : resolve());
    await rm(outdir, { recursive: true, force: true });
  }
});
