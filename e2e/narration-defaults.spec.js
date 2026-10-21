import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, startReading } from './helpers/narrativeFixtures.js';

test.use({ serviceWorkers: 'block' });

for (const [saved, expected] of [[null, 'deepgram'], ['azure-sdk', 'deepgram'], ['deepgram', 'deepgram'], ['elevenlabs', 'elevenlabs']]) {
  test(`${saved === null ? 'new device default' : `saved ${saved}`} survives reload and narrates with ${expected}`, async ({ page }) => {
    await page.addInitScript(saved => {
      if (sessionStorage.getItem('narration-default-initialized')) return;
      sessionStorage.setItem('narration-default-initialized', 'true');
      if (saved === null) localStorage.removeItem('tarot-tts-provider');
      else localStorage.setItem('tarot-tts-provider', saved);
      localStorage.setItem('tarot-voice-enabled', 'true');
      localStorage.setItem('tarot-auto-narrate', 'true');
      localStorage.setItem('tarot-ambience-enabled', 'false');
    }, saved);
    const fixture = await createNarrativeFixture(page);
    const requests = [];
    await page.route(/\/api\/tts(?:\?|$)/, route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ status: 429, json: { errorCode: 'TIER_LIMIT', tierLimited: true, used: 3, limit: 3 } });
    });
    try {
      await openSetup(page);
      await page.goto('/account#audio');
      const selected = page.getByRole('radio', { name: expected === 'deepgram' ? 'Deepgram Aura-2' : 'ElevenLabs Eleven v4' });
      await expect(selected).toHaveAttribute('aria-checked', 'true');
      await expect.poll(() => page.evaluate(() => localStorage.getItem('tarot-tts-provider'))).toBe(expected);
      await page.reload();
      await expect(selected).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('switch', { name: 'Toggle Reader Voice' })).toHaveAttribute('aria-checked', 'true');
      await page.locator('main').getByRole('link', { name: 'Back to reading', exact: true }).first().click();
      await startReading(page, fixture, { setup: false });
      await expect.poll(() => requests.filter(request => request.context === 'full-reading').length).toBe(1);
      const fullReading = requests.find(request => request.context === 'full-reading');
      expect(fullReading.provider).toBe(expected);
      expect(fullReading.text).toContain('What would enough look like today?');
    } finally { await fixture.close(); }
  });
}
