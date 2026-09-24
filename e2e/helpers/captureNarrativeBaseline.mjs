import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { createNarrativeFixture, openChat, startReading } from './narrativeFixtures.js';

// A bounded observation of the clean baseline on its own temporary server.
// Failed product assertions are recorded and retained; no force clicks or DOM
// mutations are used to make the baseline complete the remediated flow.
const output = path.resolve('output/narrative-remediation');
await mkdir(output, { recursive: true });
const result = {
  baselineCommit: '7e9170fb2b64184a6225940f4cbef7b9e92caced',
  baselineURL: 'http://localhost:5176',
  viewport: { width: 1440, height: 500 },
  reducedMotion: 'no-preference',
  steps: [], states: [], pageErrors: [], consoleWarnings: [], failedResources: [], requestLog: []
};
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: result.baselineURL, viewport: result.viewport,
  reducedMotion: result.reducedMotion, serviceWorkers: 'block'
});
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage();
page.setDefaultTimeout(6000);
page.setDefaultNavigationTimeout(45000);
page.on('pageerror', error => result.pageErrors.push(error.message));
page.on('console', message => {
  if (['error', 'warning'].includes(message.type())) result.consoleWarnings.push(message.text());
});
page.on('response', response => {
  if (response.status() >= 400) result.failedResources.push({ url: response.url(), status: response.status() });
});
page.on('request', request => {
  if (request.method() === 'POST' && /\/api\/(tarot-reading\/jobs|reading-followup)$/.test(new URL(request.url()).pathname)) {
    result.requestLog.push({ method: request.method(), url: request.url() });
  }
});
const fixture = await createNarrativeFixture(page);
const finalText = `${'Begin with a pause and notice what matters.\n\n'.repeat(20)}Keep room for rest.`;
let lastDialog;

async function step(name, action) {
  const started = performance.now();
  try {
    await action();
    result.steps.push({ name, status: 'passed', durationMs: Math.round(performance.now() - started) });
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    result.steps.push({ name, status: 'failed', durationMs: Math.round(performance.now() - started), error: error.message.slice(0, 2000) });
    console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`);
    return false;
  }
}

async function state(name, screenshot) {
  const active = page.getByRole('dialog', { name: 'Follow-up chat' });
  const value = {
    name, viewport: page.viewportSize(), activeDialogs: await active.count(),
    readingRequests: fixture.requests.reading.length, followupRequests: fixture.requests.followup.length,
    previousDialogConnected: lastDialog ? await lastDialog.evaluate(element => element.isConnected) : null,
    previousDialogInert: lastDialog ? await lastDialog.evaluate(element => element.inert) : null,
    activeElement: await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      label: document.activeElement?.getAttribute('aria-label'),
      text: document.activeElement?.textContent?.slice(0, 80)
    }))
  };
  if (value.activeDialogs === 1) {
    value.dialog = await active.evaluate(element => {
      const rectangle = node => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom };
      };
      const dialogBox = rectangle(element);
      const describe = node => {
        if (!node) return null;
        const box = rectangle(node);
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        return {
          ...box, centerHits: node.contains(document.elementFromPoint(x, y)),
          fullyInsideDialog: box.y >= dialogBox.y && box.bottom <= dialogBox.bottom,
          fontSize: getComputedStyle(node).fontSize
        };
      };
      const log = element.querySelector('[role="log"]');
      return {
        ...dialogBox,
        overflowY: getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
        input: describe(element.querySelector('textarea')),
        send: describe(element.querySelector('[aria-label="Send question"]')),
        close: describe(element.querySelector('[aria-label="Close follow-up chat"]')),
        history: describe(element.querySelector('input[type="checkbox"]')?.closest('label')),
        retainedFinalResponse: Boolean(log?.textContent.includes('Keep room for rest.')),
        log: log ? { ...rectangle(log), scrollTop: log.scrollTop, scrollHeight: log.scrollHeight, clientHeight: log.clientHeight } : null
      };
    });
  }
  result.states.push(value);
  if (screenshot) await page.screenshot({ path: path.join(output, screenshot) });
}

try {
  console.log('Capturing clean baseline interaction');
  if (!await step('Create the same jobs/SSE reading', () => startReading(page, fixture))) throw new Error('Baseline reading fixture did not reach its ready state.');
  result.fonts = await page.evaluate(() => ({
    inter: document.fonts.check('16px "Inter Variable"'),
    sourceSerif: document.fonts.check('16px "Source Serif 4 Variable"'),
    loadedFaces: [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family)
  }));
  let opener;
  let dialog;
  if (!await step('Open short desktop chat', async () => {
    ({ opener, dialog } = await openChat(page));
    lastDialog = await dialog.elementHandle();
  })) throw new Error('Baseline chat could not be opened by its normal entry point.');
  await state('initial-open', 'baseline-short-desktop-open.png');
  const sent = await step('Fill and click Send', async () => {
    await dialog.getByRole('textbox').fill('What can I do next?');
    await dialog.getByRole('button', { name: 'Send question' }).click();
    await expect.poll(() => fixture.requests.followup.length).toBe(1);
  });
  if (sent) {
    await step('Receive partial response', async () => {
      await fixture.emit('followup', 'delta', { text: 'Begin with a pause. ' });
      await expect(dialog.getByRole('log')).toContainText('Begin with a pause.');
    });
    const closed = await step('Close while response is in flight', () => dialog.getByRole('button', { name: 'Close follow-up chat' }).click());
    await fixture.emit('followup', 'done', { fullText: finalText });
    if (closed) {
      await state('closed-during-completion');
      await step('Closed dialog is genuinely inert', async () => expect(await lastDialog.evaluate(element => element.inert)).toBe(true));
      await step('Close restores its opener', () => expect(opener).toBeFocused());
      await step('Reopen completed conversation', async () => {
        ({ dialog } = await openChat(page));
        await expect(dialog.getByRole('log')).toContainText('Keep room for rest.');
      });
    }
    await state('response-reopened', 'baseline-short-desktop-response.png');
    const log = page.getByRole('dialog', { name: 'Follow-up chat' }).getByRole('log');
    if (await log.count()) {
      await step('Scroll older and newer messages', async () => {
        await log.hover();
        await page.mouse.wheel(0, -1000);
        await page.waitForTimeout(200);
        await state('older-messages');
        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(200);
        await state('newer-messages');
      });
    }
  } else {
    result.steps.push({ name: 'Streaming/close/reopen/message scrolling', status: 'not-reached', reason: 'Normal Send action failed; no alternate or forced submit was used.' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await state('handset-resize', 'baseline-handset-resize.png');
  await step('Resize retains one active chat', () => expect(page.getByRole('dialog', { name: 'Follow-up chat' })).toHaveCount(1));
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.waitForTimeout(300);
  await state('return-short-desktop');
  if (sent) await step('Resize retains the same completed message', () => expect(page.getByRole('dialog', { name: 'Follow-up chat' }).getByRole('log')).toContainText('Keep room for rest.'));
  await step('No duplicate generation or follow-up request', async () => {
    expect(fixture.requests.reading).toHaveLength(1);
    expect(fixture.requests.followup).toHaveLength(sent ? 1 : 0);
  });
} catch (error) {
  result.fatal = error.message;
  await page.screenshot({ path: path.join(output, 'baseline-capture-stopped.png') });
} finally {
  result.requests = { reading: fixture.requests.reading.length, followup: fixture.requests.followup.length };
  await fixture.close();
  await context.tracing.stop({ path: path.join(output, 'baseline-interaction-trace.zip') });
  await context.close();
  await browser.close();
}

const final = JSON.parse(await readFile(path.join(output, 'interaction-trace-inspection.json'), 'utf8'));
result.finalComparison = {
  finalTrace: 'interaction-trace.zip',
  readingRequests: final.requests.filter(request => request.url.endsWith('/api/tarot-reading/jobs')).length,
  followupRequests: final.requests.filter(request => request.url.endsWith('/api/reading-followup')).length,
  failedActions: final.errors.length,
  finalBehavior: 'The same open/send/partial/close/complete/reopen/scroll/resize flow completed. One active dialog was asserted after handset resize. The final acceptance tests also verify retained draft/preferences/messages, real middle overflow, reachable footer, and inert closed content.',
  limits: 'This is one local intercepted browser comparison, not a performance benchmark, physical-device test, or listener/heap audit. Baseline assertion failures are retained rather than bypassed.'
};
await writeFile(path.join(output, 'baseline-interaction-observations.json'), `${JSON.stringify(result, null, 2)}\n`);
const states = Object.fromEntries(result.states.map(value => [value.name, value]));
const comparison = {
  baselineCommit: result.baselineCommit,
  environment: { browser: 'Chromium', initialViewport: result.viewport, reducedMotion: result.reducedMotion, baselinePort: 5176, finalPort: 5173, services: 'Local intercepted Pro jobs/SSE fixtures' },
  baselineTrace: 'baseline-interaction-trace.zip', finalTrace: 'interaction-trace.zip',
  baselineObservations: 'baseline-interaction-observations.json', baselineTracePosts: result.requestLog,
  comparison: {
    requestCounts: { baseline: result.requests, final: { reading: result.finalComparison.readingRequests, followup: result.finalComparison.followupRequests } },
    closedDialogInert: { baseline: states['closed-during-completion']?.previousDialogInert, final: true, finalEvidence: 'A02 closed-state acceptance assertions' },
    completedResponseRetained: {
      baselineAfterReopen: states['response-reopened']?.dialog?.retainedFinalResponse,
      baselineAfterResize: states['return-short-desktop']?.dialog?.retainedFinalResponse,
      final: true, finalEvidence: 'Continuous trace reopen check and A02 responsive acceptance assertions'
    },
    shortDesktopAfterReopen: {
      baseline: states['response-reopened']?.dialog,
      final: 'The final continuous flow completed with a passing textarea center hit after returning to the short viewport; A05 also verifies long-message footer/history reachability in both motion modes.'
    },
    messageScrolling: {
      baselineScrollTopOlder: states['older-messages']?.dialog?.log?.scrollTop,
      baselineScrollTopNewer: states['newer-messages']?.dialog?.log?.scrollTop,
      final: 'Both wheel actions completed; A05 verifies real middle overflow and reachable final content.'
    },
    handsetResize: {
      baselineActiveDialogs: states['handset-resize']?.activeDialogs,
      baselineRetainedResponse: states['handset-resize']?.dialog?.retainedFinalResponse,
      baselineCenterHits: Object.fromEntries(['close', 'input', 'send', 'history'].map(name => [name, states['handset-resize']?.dialog?.[name]?.centerHits])),
      finalActiveDialogs: 1, finalControlHitTests: 'A01 passes checked control centers at 320 and 390 in normal/reduced motion.'
    }
  },
  baselineFailedChecks: result.steps.filter(value => value.status === 'failed').map(value => value.name),
  baselinePageErrors: result.pageErrors, baselineFailedResources: result.failedResources, baselineFonts: result.fonts,
  limits: result.finalComparison.limits
};
await writeFile(path.join(output, 'baseline-interaction-comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`);
console.log(`Saved baseline trace and comparison with ${result.steps.filter(entry => entry.status === 'failed').length} observed failed checks.`);
if (result.fatal) process.exitCode = 1;
