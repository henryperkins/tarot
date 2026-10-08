import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, QUESTION } from './helpers/narrativeFixtures.js';

test.use({ serviceWorkers: 'block' });
test.setTimeout(60000);

for (const width of [1440, 390]) {
  for (const theme of ['dark', 'light']) {
    test(`voice migration and enable/play quota recovery at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(value => {
        localStorage.setItem('tarot-theme', value);
        localStorage.setItem('tarot-tts-provider', 'hume');
        localStorage.setItem('tarot-voice-enabled', 'false');
        localStorage.setItem('tarot-auto-narrate', 'false');
      }, theme);
      await page.route(/^https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/, route => route.abort());
      const fixture = await createNarrativeFixture(page);
      let narrationRequests = 0;
      await page.route('**/api/generate-card-video?capabilities=true', route => route.fulfill({ json: { cardVideo: false } }));
      await page.route('**/api/tts?stream=true', route => {
        narrationRequests++;
        return route.fulfill({ status: 429, json: { errorCode: 'TIER_LIMIT', tierLimited: true, used: 3, limit: 3 } });
      });
      try {
        await page.goto('/account');
        const engines = page.getByRole('radiogroup', { name: 'Select voice engine' });
        const clear = engines.getByRole('radio', { name: 'Clear Reader voice' });
        await expect(clear).toHaveAttribute('aria-checked', 'true');
        await expect(engines.getByRole('radio')).toHaveCount(2);
        await clear.focus();
        await clear.press('Enter');
        await page.keyboard.press('Tab');
        await expect(engines.getByRole('radio', { name: 'Word-Sync Azure SDK' })).toBeFocused();
        await openSetup(page);
        await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(QUESTION);
        await page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first().click();
        await page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first().click();
        await page.getByRole('button', { name: /^Reveal all cards/ }).filter({ visible: true }).first().click();
        await expect(page.getByRole('button', { name: /Cinematic|Generate.*video|Watch.*video/i })).toHaveCount(0);
        const details = page.getByRole('button', { name: /Click to view details\./ }).filter({ visible: true }).first();
        await details.press('Enter');
        await page.getByRole('button', { name: 'Open full card' }).press('Enter');
        const cardDialog = page.getByRole('dialog');
        await expect(cardDialog).toBeVisible();
        await expect(cardDialog.getByRole('button', { name: 'Cinematic reveal' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Close modal' }).press('Enter');
        await expect(cardDialog).toHaveCount(0);
        await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().press('Enter');
        await fixture.completeReading();
        await page.getByRole('button', { name: /^Read this aloud$|^Play$/ }).filter({ visible: true }).first().press('Enter');
        await page.getByRole('button', { name: 'Enable voice & play' }).press('Enter');
        await expect.poll(() => narrationRequests).toBe(1);
        await expect(page.getByRole('alert').filter({ hasText: 'Monthly limit reached (3/3)' })).toBeVisible();
        const plans = page.getByRole('button', { name: 'View subscription options' });
        await plans.focus();
        await expect(plans).toBeFocused();
        await plans.press('Enter');
        await expect(page).toHaveURL(/\/pricing$/);
      } finally { await fixture.close(); }
    });
  }
}

test('stream duration stays indeterminate until a finite length is available', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const reactModule = await import('/node_modules/.vite/deps/react.js');
    const React = reactModule.default || reactModule;
    const clientModule = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { createRoot } = clientModule.default || clientModule;
    const { NarrationProgress } = await import('/src/components/NarrationProgress.jsx');
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const results = [];
    try {
      for (const duration of [Infinity, 0, NaN, 125]) {
        root.render(React.createElement(NarrationProgress, {
          ttsState: { status: 'playing', progress: 0.2, currentTime: 25, duration }
        }));
        await new Promise(resolve => setTimeout(resolve, 50));
        const progress = container.querySelector('[role="progressbar"]');
        results.push({ text: container.textContent, value: progress?.getAttribute('aria-valuenow'), label: progress?.getAttribute('aria-label') });
      }
    } finally { root.unmount(); container.remove(); }
    return results;
  });
  for (const result of results.slice(0, 3)) {
    expect(result.text).toBe('0:25');
    expect(result.value).toBeNull();
    expect(result.label).toBe('Narration progress: 0:25');
  }
  expect(results[3]).toEqual({ text: '0:25 / 2:05', value: '20', label: 'Narration progress: 0:25 of 2:05' });
});
