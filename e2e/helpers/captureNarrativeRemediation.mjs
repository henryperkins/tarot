import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, devices } from 'playwright';
import { expect } from '@playwright/test';
import {
  createNarrativeFixture, expectForeground, installSimulatedVisualViewport,
  openChat, startReading
} from './narrativeFixtures.js';

// Run after the local acceptance tests. These are genuine rendered application
// states backed by deterministic jobs/SSE fixtures, not reference-image edits.
const output = path.resolve('output/narrative-remediation');
await mkdir(output, { recursive: true });
const captures = process.env.NARRATIVE_CAPTURE_TRACE_ONLY
  ? JSON.parse(await readFile(path.join(output, 'capture-metadata.json'), 'utf8')).filter(capture => capture.name !== 'interaction-trace')
  : [];
const scenarios = process.env.NARRATIVE_CAPTURE_TRACE_ONLY ? [] : [
  { name: '01-light-reading', theme: 'light', width: 1440, height: 1000, reading: true },
  { name: '01-dark-reading', theme: 'dark', width: 1440, height: 1000, reading: true },
  { name: '02-mobile-follow-up-light', theme: 'light', width: 390, height: 844, mobile: true },
  { name: '02-mobile-follow-up-dark', theme: 'dark', width: 390, height: 844, mobile: true },
  { name: '03-short-desktop-chat', theme: 'light', width: 1440, height: 500 },
  { name: '04-narrow-focus', theme: 'dark', width: 320, height: 740, mobile: true, draft: true },
  { name: '05-short-enlarged-text', theme: 'light', width: 1440, height: 500, enlarged: true },
  { name: '06-simulated-keyboard', theme: 'light', width: 390, height: 844, mobile: true, keyboard: true, enlarged: true }
];

for (const scenario of scenarios) {
  console.log(`Capturing ${scenario.name}`);
  const browser = await (scenario.mobile ? webkit : chromium).launch();
  const context = await browser.newContext({
    ...(scenario.mobile ? devices['iPhone 13'] : {}),
    viewport: { width: scenario.width, height: scenario.height },
    baseURL: 'http://localhost:5173', reducedMotion: 'reduce', serviceWorkers: 'block'
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleMessages = [];
  const failedResources = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) consoleMessages.push({ type: message.type(), text: message.text() });
  });
  page.on('response', response => {
    if (response.status() >= 400) failedResources.push({ url: response.url(), status: response.status() });
  });
  await page.addInitScript(theme => localStorage.setItem('tarot-theme', theme), scenario.theme);
  if (scenario.keyboard) await installSimulatedVisualViewport(page);
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    await expect(page.locator('html')).toHaveClass(scenario.theme === 'light' ? /light/ : /^(?!.*\blight\b)/);
    if (scenario.reading) {
      await page.getByRole('button', { name: /How did this reading land/ }).click();
      for (const name of ['overallAccuracy', 'narrativeCoherence', 'practicalValue']) {
        await page.locator(`input[name="${name}"]`).nth(3).locator('..').click();
      }
      const spreadDisclosure = page.getByRole('button', { name: /^Spread Insights/ });
      if (await spreadDisclosure.isVisible()) await spreadDisclosure.click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `${scenario.name}.png`), fullPage: true });
    } else {
      const { dialog } = await openChat(page);
      if (scenario.enlarged) await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
      if (scenario.keyboard) {
        await page.evaluate(() => window.__setVisualViewport(340));
        await expect.poll(async () => (await dialog.boundingBox()).height).toBeLessThanOrEqual(340);
      }
      if (scenario.draft || scenario.keyboard) {
        const input = dialog.getByRole('textbox', { name: 'Follow-up question' });
        await input.fill('What boundary would support my energy tomorrow?');
        await input.focus();
        await expectForeground(input);
      } else if (!scenario.enlarged) {
        await page.keyboard.press('Tab');
        await dialog.locator('[aria-label="Suggested questions"]').getByRole('button').first().focus();
      }
      if (scenario.enlarged && !scenario.keyboard) {
        await dialog.evaluate(node => node.scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, `${scenario.name}-header.png`) });
        await expectForeground(dialog.getByRole('checkbox').locator('..'));
      }
      await page.screenshot({
        path: path.join(output, `${scenario.name}.png`),
        ...(scenario.keyboard ? { clip: { x: 0, y: 0, width: scenario.width, height: 340 } } : {})
      });
    }
    captures.push({
      ...scenario, browser: scenario.mobile ? 'webkit' : 'chromium',
      file: `${scenario.name}.png`, pageErrors, consoleMessages, failedResources,
      readingRequests: fixture.requests.reading.length,
      themeClass: await page.locator('html').getAttribute('class'),
      fonts: await page.evaluate(() => ({
        inter: document.fonts.check('16px "Inter Variable"'),
        sourceSerif: document.fonts.check('16px "Source Serif 4 Variable"'),
        loadedFaces: [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family)
      }))
    });
    await writeFile(path.join(output, 'capture-metadata.json'), `${JSON.stringify(captures, null, 2)}\n`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${scenario.name}-failed.png`), fullPage: true });
    await writeFile(path.join(output, `${scenario.name}-failed.txt`), `${error.stack}\n${await page.locator('body').ariaSnapshot()}`);
    throw error;
  } finally {
    await fixture.close();
    await context.close();
    await browser.close();
  }
}

// A single continuous trace covers closed/open states, an in-flight close,
// streaming completion, older-message scrolling, and a responsive resize.
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: 'http://localhost:5173', viewport: { width: 1440, height: 500 },
  reducedMotion: 'no-preference', serviceWorkers: 'block'
});
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const fixture = await createNarrativeFixture(page);
try {
  console.log('Tracing reading setup');
  await startReading(page, fixture);
  console.log('Tracing open and streaming');
  const { dialog } = await openChat(page);
  await dialog.getByRole('textbox').fill('What can I do next?');
  await dialog.getByRole('button', { name: 'Send question' }).click();
  await fixture.emit('followup', 'delta', { text: 'Begin with a pause. ' });
  await dialog.getByRole('button', { name: 'Close follow-up chat' }).click();
  await fixture.emit('followup', 'done', { fullText: `${'Begin with a pause and notice what matters.\n\n'.repeat(20)}Keep room for rest.` });
  await openChat(page);
  console.log('Tracing scrolling and resizing');
  await expect(dialog.getByRole('log')).toContainText('Keep room for rest.');
  const scroll = dialog.locator('.follow-up-chat__scroll');
  await scroll.hover();
  await page.mouse.wheel(0, -1000);
  await page.mouse.wheel(0, 1000);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.setViewportSize({ width: 1440, height: 500 });
  await expectForeground(dialog.getByRole('textbox'));
  expect(fixture.requests.followup).toHaveLength(1);
  captures.push({ name: 'interaction-trace', readingRequests: fixture.requests.reading.length, followupRequests: fixture.requests.followup.length });
} finally {
  console.log('Saving interaction trace');
  await fixture.close();
  await context.tracing.stop({ path: path.join(output, 'interaction-trace.zip') });
  await context.close();
  await browser.close();
}
await writeFile(path.join(output, 'capture-metadata.json'), `${JSON.stringify(captures, null, 2)}\n`);
console.log(`Saved ${captures.length - 1} rendered states and one interaction trace to ${output}`);
