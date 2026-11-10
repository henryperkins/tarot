import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, startReading } from './helpers/narrativeFixtures.js';

// Keep the real hook, React lifecycle and native focus events. Only viewport
// geometry is controlled; desktop browsers cannot open a software keyboard.
const HARNESS = `<!doctype html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>input, textarea, [contenteditable] { font-size:16px }</style>
</head><body>
  <input id="text" aria-label="Question">
  <textarea id="notes" aria-label="Notes"></textarea>
  <input id="readonly" readonly aria-label="Read only">
  <input id="checkbox" type="checkbox" aria-label="Toggle">
  <input id="range" type="range" aria-label="Range">
  <div id="editor" contenteditable="true" role="textbox" aria-label="Editor"></div>
  <button id="other">Other action</button><div id="root"></div>
  <script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/e2e/helpers/keyboardViewportHarness.js');
  </script>
</body></html>`;

async function prepare(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(url => url.pathname === '/__keyboard-viewport', route => route.fulfill({ contentType: 'text/html', body: HARNESS }));
  await page.goto('/__keyboard-viewport');
  await expect(page.getByTestId('keyboard-offset')).toHaveText('0');
}

async function change(page, geometry, event = 'resize') {
  await page.evaluate(({ geometry, event }) => window.keyboardViewportTest.change(geometry, event), { geometry, event });
}

test.describe('keyboard and magnification', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('a smaller viewport without editable focus leaves keyboard clearance at zero', async ({ page }) => {
    await prepare(page);
    await change(page, { height: 500, offsetTop: 20 });
    await expect(page.getByTestId('keyboard-offset')).toHaveText('0');
    // Overlay sizing still consumes the actual visible geometry.
    await expect(page.getByTestId('visible-viewport')).toHaveText('{"height":500,"offsetTop":20}');
  });

  test('zooming and panning a focused draft does not invent a keyboard', async ({ page }) => {
    await prepare(page);
    const notes = page.locator('#notes');
    await notes.fill('My draft — café, 42?');
    await change(page, { scale: 2, height: 422 });
    await expect(page.getByTestId('keyboard-offset')).toHaveText('0');
    await change(page, { offsetTop: 140 }, 'scroll');
    await expect(page.getByTestId('keyboard-offset')).toHaveText('0');
    await expect(notes).toBeFocused();
    await expect(notes).toHaveValue('My draft — café, 42?');
  });

  test('focus and blur update keyboard clearance without a viewport event', async ({ page }) => {
    await prepare(page);
    await change(page, { height: 500 });
    await page.locator('#text').focus();
    await expect(page.getByTestId('keyboard-offset')).toHaveText('344');
    await page.locator('#other').focus();
    await expect(page.getByTestId('keyboard-offset')).toHaveText('0');
    await page.locator('#editor').focus();
    await expect(page.getByTestId('keyboard-offset')).toHaveText('344');
  });

  test('keyboard shrink and panning retain their offsets before and after zoom', async ({ page }) => {
    await prepare(page);
    await page.locator('#notes').focus();
    await change(page, { height: 500, offsetTop: 20 });
    await expect(page.getByTestId('keyboard-offset')).toHaveText('324');
    await change(page, { scale: 2, height: 250, offsetTop: 30 });
    await expect(page.getByTestId('keyboard-offset')).toHaveText('564');
    await change(page, { offsetTop: 100 }, 'scroll');
    await expect(page.getByTestId('keyboard-offset')).toHaveText('494');
    // Dismiss while still zoomed and focused: only magnification remains.
    await change(page, { height: 422, offsetTop: 0 });
    await expect(page.getByTestId('keyboard-offset')).toHaveText('0');
    // Opening the keyboard after zoom follows the same geometry path.
    await change(page, { height: 250, offsetTop: 30 });
    await expect(page.getByTestId('keyboard-offset')).toHaveText('564');
  });

  for (const id of ['readonly', 'checkbox', 'range']) {
    test(`${id} focus cannot turn viewport shrink into keyboard clearance`, async ({ page }) => {
      await prepare(page);
      await page.locator(`#${id}`).focus();
      await change(page, { height: 500 });
      await expect(page.getByTestId('keyboard-offset')).toHaveText('0');
    });
  }

  test('layout viewport resizing recomputes clearance and unmount clears it', async ({ page }) => {
    await prepare(page);
    await page.locator('#text').focus();
    await change(page, { height: 500 });
    await expect(page.getByTestId('keyboard-offset')).toHaveText('344');
    await page.setViewportSize({ width: 390, height: 700 });
    await expect(page.getByTestId('keyboard-offset')).toHaveText('200');
    await page.evaluate(() => window.keyboardViewportTest.unmount());
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--keyboard-offset'))).toBe('0px');
  });

  test('Chromium page-scale magnification keeps destinations mounted and permits the Save shortcut', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'CDP page-scale override is Chromium-only; physical checks remain unrun.');
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await createNarrativeFixture(page);
    try {
      await startReading(page, fixture);
      await page.locator('.narrative-stream').evaluate(element => element.scrollIntoView({ block: 'start' }));
      await page.evaluate(() => { scrollBy(0, 250); document.activeElement.blur(); });
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
      await expect.poll(() => page.evaluate(() => visualViewport.scale)).toBe(2);
      const region = page.locator('[data-app-bottom-region]');
      await expect(region).toHaveAttribute('data-keyboard-offset', '0');
      await expect(page.locator('[data-destination-group="dock"]')).not.toHaveAttribute('hidden');
      const shortcut = page.getByRole('button', { name: 'Save or ask about this reading', exact: true });
      await shortcut.focus();
      await shortcut.press('Enter');
      await expect(region.getByRole('button', { name: 'Save to journal', exact: true })).toBeFocused();
      await expect.poll(() => page.evaluate(() => visualViewport.scale)).toBe(2);
      await page.screenshot({ path: testInfo.outputPath('pinch200-reading.png'), animations: 'disabled' });
      await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
      const ask = region.getByRole('button', { name: 'Ask about this reading', exact: true });
      await ask.click();
      const dialog = page.getByRole('dialog', { name: 'Follow-up chat', exact: true });
      const question = dialog.getByRole('textbox', { name: 'Your follow-up question', exact: true });
      await question.fill('Keep this question while I zoom.');
      await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
      await expect.poll(() => page.evaluate(() => visualViewport.scale)).toBe(2);
      await expect(region).toHaveAttribute('data-keyboard-offset', '0');
      await expect(question).toBeFocused();
      await expect(question).toHaveValue('Keep this question while I zoom.');
      const close = page.getByRole('button', { name: 'Close follow-up chat', exact: true });
      await close.focus();
      await close.press('Enter');
      await expect(dialog).toBeHidden();
      await expect(ask).toBeFocused();
      // CDP's scale override resets on history traversal even on plain HTML.
      // Real pinch retention across drawer dismissal remains a device check.
      await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
      await session.detach();
      await expect(ask).toBeInViewport();
    } finally { await fixture.close(); }
  });
});
