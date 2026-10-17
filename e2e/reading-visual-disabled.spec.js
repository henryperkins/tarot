import { test, expect } from '@playwright/test';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';

// This lane runs without VITE_READING_GESTURES. A returned capability must not
// activate optional browser transport when the presentation is disabled.
for (const authMode of ['guest', 'mock-pro']) {
  test(`${authMode}: disabled gestures ignore a returned visual capability`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
    const binding = {
      readingResultId: `disabled-${authMode}`, sourceRevision: 0,
      spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64),
      artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'controlled-disabled-v1'
    };
    const fixture = await createNarrativeFixture(page, {
      authMode, sourceUsage: null,
      startData: { readingResultId: binding.readingResultId, visualBinding: binding, visualJobToken: 'controlled-token' }
    });
    try {
      await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
      await fixture.completeReading();
      await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-source-status', 'complete');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      expect(fixture.requests.visual).toEqual([]);
      expect(fixture.requests.reading).toHaveLength(1);
    } finally { await fixture.close(); }
  });
}
