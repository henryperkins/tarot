import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import { validateCueListenerIdentity } from './helpers/readingCueValidationIdentity.mjs';

// Run before accepting matrix labels as evidence. Physical devices remain a separate gate.
// Only an owned validation lane supplies the runtime manifest; ordinary e2e runs skip.
test.skip(!process.env.CUE_VALIDATION_MANIFEST || !process.env.CUE_VALIDATION_LANE, 'Runs only inside an owned reading-cue validation lane.');
test('owned runtime identity and actual viewport/motion match the selected browser lane', async ({ page, browser, browserName }, testInfo) => {
  const manifest = JSON.parse(await readFile(process.env.CUE_VALIDATION_MANIFEST, 'utf8'));
  const kind = process.env.CUE_VALIDATION_LANE === 'optimized' ? 'optimized' : 'frontend';
  const response = await page.goto('/__cue_validation_identity');
  expect(response.status()).toBe(200);
  const identity = JSON.parse(await page.locator('body').innerText());
  validateCueListenerIdentity(manifest, kind, identity);
  expect(identity.runId).toBe(manifest.buildIdentity.runId);
  expect(identity.snapshotDigest).toBe(manifest.buildIdentity.snapshotDigest);
  const actual = await page.evaluate(() => ({ reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio, userAgent: navigator.userAgent }));
  const expected = testInfo.project.use.contextOptions.reducedMotion === 'reduce';
  expect(actual.reducedMotion).toBe(expected);
  expect(page.viewportSize()).toEqual(testInfo.project.use.viewport);
  await testInfo.attach('actual-lane.json', { body: Buffer.from(JSON.stringify({ ...actual, browserName,
    browserVersion: browser.version(), project: testInfo.project.name, runId: identity.runId, snapshotDigest: identity.snapshotDigest,
    listenerKind: identity.listenerKind, servingOrigin: identity.servingOrigin, outputDigest: identity.outputDigest,
    optimizedFlags: identity.optimizedFlags, outputIntegrity: identity.outputIntegrity, physicalDevice: false, serviceWorkers: 'block' }, null, 2)), contentType: 'application/json' });
});
