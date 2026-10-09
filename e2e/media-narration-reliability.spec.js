import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, expectNoHorizontalOverflow, openSetup, startReading, QUESTION } from './helpers/narrativeFixtures.js';

test.use({ serviceWorkers: 'block' });
test.setTimeout(60000);

for (const width of [1440, 390]) {
  for (const theme of ['dark', 'light']) {
    const savedProvider = width === 1440 ? (theme === 'dark' ? 'hume' : 'azure') : (theme === 'dark' ? 'azure-sdk' : 'deepgram');
    const selectedProvider = theme === 'dark' ? 'deepgram' : 'elevenlabs';
    test(`voice choice, migration and enable/play quota recovery at ${width}px ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(({ theme, savedProvider }) => {
        if (sessionStorage.getItem('narration-test-initialized')) return;
        sessionStorage.setItem('narration-test-initialized', 'true');
        localStorage.setItem('tarot-theme', theme);
        localStorage.setItem('tarot-tts-provider', savedProvider);
        localStorage.setItem('tarot-voice-enabled', 'false');
        localStorage.setItem('tarot-auto-narrate', 'false');
      }, { theme, savedProvider });
      await page.route(/^https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/, route => route.abort());
      const fixture = await createNarrativeFixture(page, { signedOut: width === 390 });
      let narrationRequests = 0;
      let requestedProvider = null;
      await page.route('**/api/generate-card-video?capabilities=true', route => route.fulfill({ json: { cardVideo: false } }));
      await page.route('**/api/tts?stream=true', route => {
        narrationRequests++;
        requestedProvider = route.request().postDataJSON().provider;
        return route.fulfill({ status: 429, json: { errorCode: 'TIER_LIMIT', tierLimited: true, used: 3, limit: 3 } });
      });
      try {
        await openSetup(page);
        if (width === 390) {
          await page.getByRole('link', { name: 'Open settings', exact: true }).click();
          await page.getByRole('navigation', { name: 'Jump to section' }).getByRole('link', { name: 'Audio', exact: true }).click();
        } else {
          await page.locator('a[href="/account#audio"]').filter({ visible: true }).first().click();
        }
        await expect(page).toHaveURL(/\/account#audio$/);
        await expect(page.getByRole('heading', { name: width === 390 ? 'Settings' : 'Account & Settings', exact: true })).toBeVisible();
        const engines = page.getByRole('radiogroup', { name: 'Select voice engine' });
        const elevenlabs = engines.getByRole('radio', { name: 'ElevenLabs Eleven v4' });
        const deepgram = engines.getByRole('radio', { name: 'Deepgram Aura-2' });
        await expect(savedProvider === 'deepgram' ? deepgram : elevenlabs).toHaveAttribute('aria-checked', 'true');
        await expect(engines.getByRole('radio')).toHaveCount(2);
        await expect(page.getByText(/Azure SDK|Word-Sync/)).toHaveCount(0);
        await elevenlabs.focus();
        await elevenlabs.press('Enter');
        await elevenlabs.press('ArrowRight');
        await expect(deepgram).toBeFocused();
        await expect(deepgram).toHaveAttribute('aria-checked', 'true');
        await deepgram.press('Home');
        await expect(elevenlabs).toBeFocused();
        if (selectedProvider === 'deepgram') await elevenlabs.press('End');
        await expect(selectedProvider === 'deepgram' ? deepgram : elevenlabs).toHaveAttribute('aria-checked', 'true');
        await expect.poll(() => page.evaluate(() => localStorage.getItem('tarot-tts-provider'))).toBe(selectedProvider);
        expect(await page.evaluate(() => localStorage.getItem('tarot-voice-enabled'))).toBe('false');
        const voiceToggle = page.getByRole('switch', { name: 'Toggle Reader Voice' });
        await voiceToggle.click();
        const speeds = page.getByRole('radiogroup', { name: 'Select narration speed' });
        for (const engine of [elevenlabs, deepgram]) {
          await engine.click();
          await expect(speeds).toBeVisible();
          await speeds.getByRole('radio', { name: 'Normal', exact: true }).focus();
          await page.keyboard.press('End');
          await expect(speeds.getByRole('radio', { name: 'Faster', exact: true })).toBeFocused();
          await expect(speeds.getByRole('radio', { name: 'Faster', exact: true })).toHaveAttribute('aria-checked', 'true');
          await page.keyboard.press('Home');
          await expect(speeds.getByRole('radio', { name: 'Slower', exact: true })).toHaveAttribute('aria-checked', 'true');
        }
        await (selectedProvider === 'deepgram' ? deepgram : elevenlabs).click();
        await expect(voiceToggle).toHaveAttribute('aria-checked', 'true');
        await expectNoHorizontalOverflow(page, '#audio');
        await page.screenshot({ path: testInfo.outputPath(`account-${width}-${theme}.png`) });
        await voiceToggle.click();
        await page.reload();
        await expect(selectedProvider === 'deepgram' ? deepgram : elevenlabs).toHaveAttribute('aria-checked', 'true');
        await expect(voiceToggle).toHaveAttribute('aria-checked', 'false');
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
        expect(requestedProvider).toBe(selectedProvider);
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

for (const provider of ['elevenlabs', 'deepgram']) {
  test(`changing ${provider} stops pending speech and preserves enabled voice`, async ({ page }) => {
    await page.addInitScript(provider => {
      localStorage.setItem('tarot-tts-provider', provider);
      localStorage.setItem('tarot-voice-enabled', 'true');
      localStorage.setItem('tarot-auto-narrate', 'false');
    }, provider);
    const fixture = await createNarrativeFixture(page, { signedOut: true });
    try {
      await page.goto('/account#audio');
      const selected = page.getByRole('radio', { name: provider === 'elevenlabs' ? 'ElevenLabs Eleven v4' : 'Deepgram Aura-2' });
      await selected.click();
      await page.evaluate(async provider => {
        const audio = await import('/src/lib/audio.js');
        await audio.unlockAudio();
        const nativeFetch = window.fetch;
        window.fetch = (input, options = {}) => {
          if (String(input) !== '/api/tts?stream=true') return nativeFetch(input, options);
          window.pendingNarrationProvider = JSON.parse(options.body).provider;
          return new Promise((_, reject) => {
            options.signal.addEventListener('abort', () => {
              window.pendingNarrationAborted = true;
              reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          });
        };
        window.pendingNarration = audio.speakText({ text: `Pending ${provider} narration.`, enabled: true, provider, context: 'full-reading', stream: true });
      }, provider);
      await expect.poll(() => page.evaluate(() => window.pendingNarrationProvider)).toBe(provider);
      await page.getByRole('radio', { name: provider === 'elevenlabs' ? 'Deepgram Aura-2' : 'ElevenLabs Eleven v4' }).click();
      await expect.poll(() => page.evaluate(() => window.pendingNarrationAborted)).toBe(true);
      await expect(page.getByRole('switch', { name: 'Toggle Reader Voice' })).toHaveAttribute('aria-checked', 'true');
      expect(await page.evaluate(() => localStorage.getItem('tarot-voice-enabled'))).toBe('true');
      const state = await page.evaluate(async () => {
        await window.pendingNarration;
        return (await import('/src/lib/audio.js')).getCurrentTTSState();
      });
      expect(state.status).toBe('stopped');
      expect(state.reason).toBe('user');
    } finally { await fixture.close(); }
  });

  test(`${provider} automatically narrates the completed reading once`, async ({ page }) => {
    await page.addInitScript(provider => {
      localStorage.setItem('tarot-tts-provider', provider);
      localStorage.setItem('tarot-voice-enabled', 'true');
      localStorage.setItem('tarot-auto-narrate', 'true');
    }, provider);
    const fixture = await createNarrativeFixture(page);
    const fullReadingRequests = [];
    await page.route(/\/api\/tts(?:\?|$)/, route => {
      const body = route.request().postDataJSON();
      if (body.context === 'full-reading') fullReadingRequests.push(body);
      return route.fulfill({ status: 429, json: { errorCode: 'TIER_LIMIT', tierLimited: true, used: 3, limit: 3 } });
    });
    try {
      await startReading(page, fixture);
      await expect(page.getByRole('alert').filter({ hasText: 'Monthly limit reached (3/3)' })).toBeVisible();
      await expect.poll(() => fullReadingRequests.length).toBe(1);
      expect(fullReadingRequests[0].provider).toBe(provider);
      expect(fullReadingRequests[0].text).toContain('What would enough look like today?');
    } finally { await fixture.close(); }
  });
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
