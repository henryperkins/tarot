/* global window, document */
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// An optimized browser entry with the real reading and journal components.
const harness = `
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NarrativePanel } from './src/components/NarrativePanel.jsx';
import { NarrativeSection } from './src/components/journal/entry-card/EntrySections/NarrativeSection.jsx';
import { createGestureSource } from './src/lib/narrativeGestureSource.js';
import { useReadingGestureRuntime } from './src/hooks/useReadingGestureRuntime.js';
import { StreamingNarrative } from './src/components/StreamingNarrative.jsx';
import { NarrativeGestureGate, GatedSpreadCompanion } from './src/components/reading/narrative/NarrativeGestureGate.jsx';
import { useNarrativeCardFocus } from './src/components/reading/narrative/narrativeFocusContext.js';
function ObserveCueState() {
 const focus = useNarrativeCardFocus();
 useEffect(() => { if (!focus) return; window.cueProbe ||= { turns: [] };
  window.cueProbe.visibility = focus.gestureState.passageVisibility;
  window.cueProbe.associations = focus.associations;
  const current = focus.gestureState.current;
  if (current && !focus.gestureState.held && !window.cueProbe.turns.includes(current.id)) window.cueProbe.turns.push(current.id);
 }, [focus]);
 return null;
}
const params = new URLSearchParams(window.location.search);
const initial = params.has('plain') ? 'The Tower. A lightning bolt strikes the stone roof beside the crown.' : 'The Tower holds a crown. **Read carefully.** [Keep focus](#focus)';
function App() {
 const [enabled, enable] = useState(params.has('gestures')); const [raw, change] = useState(initial);
 const [live, setLive] = useState(true);
 window.readingTest = { enable: () => enable(true), disable: () => enable(false), complete: () => setLive(false), extend: () => change(initial + ' The stones scatter.'), append: () => change(initial + '\\n\\nThe Tower rises above you.') };
 const runtime = useReadingGestureRuntime(enabled);
 const cardLinks = runtime?.buildCardLinkCatalog({ cards: [{ index: 0, name: 'Lust', canonicalName: 'Strength' }], deckStyle: 'thoth-a1' });
 const source = createGestureSource({ runId: 'lazy-browser', raw, status: live ? 'streaming' : 'complete' });
 const cards = [{ index: 0, occurrenceId: 'lazy-browser:0', name: 'The Tower', canonicalName: 'The Tower',
 artworkEdition: params.has('plain') ? 'rws-immanuelle-vector' : 'rws-1909-scan', inspectionAvailable: true, image: '/card.svg', frame: '100 / 172', positionLabel: 'Present' }];
 return <><a className='outside-focus' href='#outside'>Outside focus</a>{params.has('plain') ? <NarrativeGestureGate cards={cards} gestureStudyEnabled={enabled} gestureSource={source}>
 <GatedSpreadCompanion /><StreamingNarrative text={raw} gestureSource={source} useMarkdown isStreamingEnabled={false} isReadingStreaming={live} /><ObserveCueState />
 </NarrativeGestureGate> : <NarrativePanel panelModel={{ narrativeText: raw, personalReading: { hasMarkdown: true },
 gestureStudyEnabled: enabled, gestureSource: source, spreadCards: cards, isMobileStableMode: true,
 shouldStreamNarrative: false, isReadingStreaming: live }} />}
 <div className='card-links-only'><StreamingNarrative text='Lust offers courage.' useMarkdown isStreamingEnabled={false} cardLinks={cardLinks} /></div>
 <NarrativeSection narrativeText={'Saved **reading** [journal link](#journal)'} narrativeId='journal' collapsible={false} /> </>;
}
createRoot(document.getElementById('root')).render(<App />);`;

test('optimized browser preserves prose, selection and focus while loading gated gestures', { timeout: 60000 }, async () => {
  const outdir = await mkdtemp(path.join(tmpdir(), 'tableu-lazy-browser-'));
  let browser; let server;
  try {
    const { metafile } = await build({ stdin: { contents: harness, resolveDir: process.cwd(), sourcefile: 'lazy-browser.jsx', loader: 'jsx' },
      bundle: true, splitting: true, format: 'esm', platform: 'browser', outdir, metafile: true,
      minify: true, jsx: 'automatic', define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' },
      loader: { '.svg': 'dataurl' }, logLevel: 'silent' });
    const heavyFiles = Object.entries(metafile.outputs).filter(([, value]) => Object.keys(value.inputs).some(input =>
      /(?:NarrativeCardFocus\.jsx|narrativePassageAligner\.js|narrativeCardLinks\.js|cardTouchPoints\.js|cardGestureArtwork\.js)$/.test(input)))
      .map(([file]) => path.basename(file));
    server = createServer(async (req, res) => {
      const file = path.basename(new URL(req.url, 'http://localhost').pathname);
      if (!file) { res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script type="module" src="/stdin.js"></script>'); return; }
      if (file === 'card.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="172"/>'); return; }
      try { res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(await readFile(path.join(outdir, file))); }
      catch { res.statusCode = 404; res.end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4193, '127.0.0.1', resolve); });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage(); const requests = []; const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(path.basename(new URL(request.url()).pathname)));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:4193/');
    await page.getByRole('link', { name: 'Keep focus' }).waitFor();
    assert.equal(await page.getByText('Read carefully.', { exact: true }).count(), 1);
    assert.equal(await page.getByRole('link', { name: 'journal link' }).count(), 1);
    assert.deepEqual(requests.filter(file => heavyFiles.includes(file)), [], 'gate off downloads no gesture implementation');
    await page.getByRole('link', { name: 'Keep focus' }).focus();
    await page.evaluate(() => { window.originalFocus = document.activeElement; const range = document.createRange();
      range.selectNodeContents(document.querySelector('strong')); window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
      window.readingTest.enable(); });
    await page.locator('.gesture-companion').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement === window.originalFocus), true, 'runtime arrival preserves keyboard focus');
    assert.equal(await page.evaluate(() => window.getSelection().toString()), 'Read carefully.', 'runtime arrival preserves text selection');
    assert.ok(requests.some(file => heavyFiles.includes(file)), 'gate on requests real gesture runtime');
    await page.evaluate(() => window.readingTest.append());
    await page.getByText('The Tower rises above you.', { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement === window.originalFocus), true, 'stream update preserves focused link node');
    await page.locator('.card-links-only [data-card-index="0"]').waitFor();
    assert.equal(await page.locator('.card-links-only [data-card-index="0"]').textContent(), 'Lust', 'ordinary links still resolve the selected deck alias');
    await page.evaluate(() => window.readingTest.complete());
    const shelfCard = page.locator('[data-gesture-shelf] button');
    await shelfCard.focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-gesture-window][data-held="true"]').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-gesture-window]').hasAttribute('data-held'));
    assert.equal(await shelfCard.evaluate(element => element === document.activeElement), true, 'lazy state and API share the same context identity');
    await page.evaluate(() => window.readingTest.disable());
    await page.waitForFunction(() => !document.querySelector('.gesture-companion'));
    assert.equal(await page.getByRole('link', { name: 'Keep focus' }).count(), 1, 'disabling gestures keeps the reading');
    assert.deepEqual(errors, []);

    // Selection must survive annotations wrapping the selected plain text itself.
    // Gate starts enabled; only its runtime response is delayed, reproducing the
    // first-render race rather than changing the gate after rendering.
    for (const quote of ['The Tower', 'lightning bolt']) {
      const selectedPage = await browser.newPage();
      let releaseRuntime;
      const runtimeResponse = new Promise(resolve => { releaseRuntime = resolve; });
      await selectedPage.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname !== '127.0.0.1') return route.abort();
        if (heavyFiles.includes(path.basename(url.pathname))) await runtimeResponse;
        return route.continue();
      });
      await selectedPage.goto('http://127.0.0.1:4193/?gestures&plain');
      await selectedPage.getByText('The Tower. A lightning bolt strikes the stone roof beside the crown.', { exact: true }).waitFor();
      await selectedPage.locator('.outside-focus').focus();
      await selectedPage.evaluate(selectedQuote => {
        const paragraph = [...document.querySelectorAll('p')].find(element => element.textContent.startsWith('The Tower.'));
        const node = paragraph.firstChild;
        const start = node.textContent.indexOf(selectedQuote);
        window.selectedTextNode = node;
        window.originalFocus = document.activeElement;
        // Exercise direction as well as the string: details select backwards.
        const reverse = selectedQuote === 'lightning bolt';
        window.getSelection().setBaseAndExtent(node, reverse ? start + selectedQuote.length : start,
          node, reverse ? start : start + selectedQuote.length);
        window.originalAnchorOffset = window.getSelection().anchorOffset;
        window.originalFocusOffset = window.getSelection().focusOffset;
      }, quote);
      releaseRuntime();
      await selectedPage.locator('.gesture-companion').waitFor();
      await selectedPage.locator('.card-links-only [data-card-index="0"]').waitFor();
      await selectedPage.evaluate(() => new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))));
      const selectionState = () => selectedPage.evaluate(() => ({ quote: window.getSelection().toString(),
        connected: window.selectedTextNode.isConnected, sameNode: window.getSelection().anchorNode === window.selectedTextNode,
        sameDirection: window.getSelection().anchorOffset === window.originalAnchorOffset && window.getSelection().focusOffset === window.originalFocusOffset,
        focused: document.activeElement === window.originalFocus }));
      const expectedSelection = { quote, connected: true, sameNode: true, sameDirection: true, focused: true };
      assert.deepEqual(await selectionState(), expectedSelection, `${quote}: delayed annotation arrival preserves the selected text node`);
      await selectedPage.evaluate(() => window.readingTest.extend());
      await selectedPage.getByText('The stones scatter.', { exact: false }).waitFor();
      assert.deepEqual(await selectionState(), expectedSelection, `${quote}: same-paragraph stream growth preserves selection and focus`);
      await selectedPage.evaluate(() => window.getSelection().removeAllRanges());
      await selectedPage.locator('[data-gesture-id]').filter({ hasText: quote }).waitFor();
      // No source append, remount or resize after clearing selection: the real
      // provider must learn these committed spans and follow the literal cue.
      await selectedPage.waitForFunction(() => {
        const literal = window.cueProbe?.associations.find(cue => cue.kind === 'literal');
        return literal && window.cueProbe.visibility[literal.id] === true && window.cueProbe.turns.includes(literal.id);
      });
      assert.equal(await selectedPage.locator('.narrative-stream').first().textContent().then(text => text.includes('The stones scatter.')), true);
      await selectedPage.close();
    }

    const unavailable = await browser.newPage();
    const unavailableErrors = [];
    unavailable.on('pageerror', error => unavailableErrors.push(error.message));
    await unavailable.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.hostname !== '127.0.0.1' || heavyFiles.includes(path.basename(url.pathname)) ? route.abort() : route.continue();
    });
    await unavailable.goto('http://127.0.0.1:4193/');
    await unavailable.getByRole('link', { name: 'Keep focus' }).waitFor();
    const rejectedChunk = unavailable.waitForEvent('requestfailed', request => heavyFiles.includes(path.basename(new URL(request.url()).pathname)));
    await unavailable.evaluate(() => window.readingTest.enable());
    await rejectedChunk;
    await unavailable.evaluate(() => window.readingTest.append());
    await unavailable.getByText('The Tower rises above you.', { exact: false }).waitFor();
    assert.equal(await unavailable.getByRole('link', { name: 'Keep focus' }).count(), 1, 'optional chunk failure never blocks streamed prose');
    assert.deepEqual(unavailableErrors, []);
  } finally { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); await rm(outdir, { recursive: true, force: true }); }
});
