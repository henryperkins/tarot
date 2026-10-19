import { test as base, expect } from '@playwright/test';

export { expect };

/** Open the shared guest disclosure without toggling an already-open panel. */
export async function openAccountOptions(page) {
  const summary = page.locator('summary[aria-label="Account options"]');
  await expect(summary).toBeVisible();
  const disclosure = summary.locator('..');
  if (!await disclosure.evaluate(element => element.open)) await summary.click();
  await expect(disclosure).toHaveAttribute('open', '');
  return summary;
}

export const test = base.extend({
  verifiedMotion: [async ({ page, context, contextOptions }, use, testInfo) => {
    const expected = contextOptions.reducedMotion || 'no-preference';
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
      `Browser must honor the ${expected} motion profile`).toBe(expected === 'reduce');
    if (testInfo.project.name.startsWith('integration')) {
      await use();
      return;
    }
    await context.route('**/api/health/tarot-reading', route => route.fulfill({ json: { ok: true } }));
    await context.route('**/api/health/tts', route => route.fulfill({ json: { ok: true } }));
    await context.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { user: null } }));
    await context.route('**/api/archetype-journey/preferences', route => route.request().method() === 'GET'
      ? route.fulfill({ json: { preferences: { archetype_journey_enabled: false } } })
      : route.fallback());
    await context.route('**/api/generate-card-video?capabilities=true', route => route.fulfill({ json: { enabled: false } }));
    try {
      await use();
    } finally {
      // Close the live page while its API mocks still exist. Otherwise health
      // polling can race context route teardown and escape to the Vite proxy.
      if (!page.isClosed()) await page.close();
    }
  }, { auto: true }]
});
