import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, QUESTION } from './helpers/narrativeFixtures.js';
import { ambiencePlayer, ambiencePlayers, canPlayMp3, requireInteractionForPlayback, trackPlayers } from './helpers/ambiencePlayer.js';

const AMBIENCE_KEY = 'tarot-ambience-enabled';

// Checks that read the loop's clock need a browser build that plays MP3.
async function requirePlayableMp3(page) {
  test.skip(!await canPlayMp3(page), 'This browser build cannot play MP3 audio; run the real-media checks on one that can.');
}

// Opens Settings for a guest in a fresh tab, where the browser refuses
// playback until an interaction, with the app's real players observable.
// Tabs opened later in the same context are set up the same way.
async function openSettingsWithAmbience(page, browserName, saved) {
  await requireInteractionForPlayback(page.context(), browserName);
  await trackPlayers(page.context());
  if (saved !== undefined) await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [AMBIENCE_KEY, saved]);
  await page.goto('/account');
  return page.locator('#ambience-toggle');
}

// A second tab of the same browser profile. The two share localStorage, so a
// choice made in one reaches the other as a real storage event.
async function openSecondSettingsTab(page) {
  const tab = await page.context().newPage();
  const fixture = await createNarrativeFixture(tab, { signedOut: true });
  const close = async () => {
    await tab.close();
    await fixture.close();
  };
  try {
    await tab.goto('/account');
  } catch (error) {
    await close();
    throw error;
  }
  return { tab, ambience: tab.locator('#ambience-toggle'), close };
}

// The tab's loop is paused and its clock is not moving.
async function expectSilent(page) {
  const loop = await ambiencePlayer(page);
  expect(loop.paused).toBe(true);
  await page.waitForTimeout(600);
  expect(await ambiencePlayer(page)).toEqual(loop);
  return loop;
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Initial loading — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

    test('onboarding defers sound and hidden spread artwork until the reading setup is needed', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      const requests = [];
      page.on('request', request => requests.push({ path: new URL(request.url()).pathname, type: request.resourceType() }));
      try {
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 2, name: 'Welcome to Tableu', exact: true })).toBeVisible();
        await page.waitForLoadState('networkidle');
        expect(requests.filter(({ path, type }) => path.startsWith('/sounds/') && type !== 'script')).toEqual([]);
        const startupRequests = [...requests];
        await expect(page.locator('.follow-up-dialog')).toHaveCount(0);

        await page.getByRole('button', { name: 'Skip onboarding', exact: true }).click();
        await page.getByRole('button', { name: 'Skip now', exact: true }).click();
        await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
        const artwork = page.getByRole('radiogroup', { name: 'Spread selection' }).locator('img').first();
        await expect.poll(() => artwork.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
        const artworkPath = new URL(await artwork.evaluate(image => image.currentSrc)).pathname;
        expect(startupRequests.filter(({ path, type }) => path === artworkPath && type === 'image')).toEqual([]);
        expect(startupRequests.filter(({ path, type }) => type === 'image' && path.includes('/spread-art/'))).toEqual([]);
        expect(requests.filter(({ path, type }) => path === artworkPath && type === 'image')).toHaveLength(1);
        await expect(page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first()).toBeVisible();
      } finally {
        await fixture.close();
      }
    });

    for (const mode of ['onboarding', 'setup']) {
      test(`production ${mode} stays within its startup JavaScript budget`, async ({ page }) => {
        const fixture = await createNarrativeFixture(page, { signedOut: true });
        try {
          if (mode === 'setup') await openSetup(page);
          else await page.goto('/');
          const isBuild = await page.locator('script[type="module"][src^="/assets/"]').count();
          test.skip(!isBuild, 'JavaScript budgets apply to the production build.');
          await page.waitForLoadState('networkidle');
          const scriptBytes = await page.evaluate(() => performance.getEntriesByType('resource')
            .filter(entry => /\.js(?:\?|$)/.test(entry.name))
            .reduce((total, entry) => total + entry.decodedBodySize, 0));
          expect(scriptBytes).toBeGreaterThan(0);
          expect(scriptBytes).toBeLessThan(mode === 'onboarding' ? 1_500_000 : 1_400_000);
          const readingOnlyScripts = await page.evaluate(() => performance.getEntriesByType('resource')
            .filter(entry => /\/(ReadingDisplay|CardModal|markdown)-[^/]+\.js(?:\?|$)/.test(entry.name))
            .map(entry => entry.name));
          expect(readingOnlyScripts).toEqual([]);
          await expect(page.locator('.follow-up-dialog')).toHaveCount(0);
        } finally {
          await fixture.close();
        }
      });
    }

    test('mobile Journal defers Journey and chart chunks until their disclosures request them', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      const cards = [
        { position: 'Past', name: 'The Hermit', number: 9, orientation: 'Upright' },
        { position: 'Present', name: 'Three of Cups', suit: 'Cups', orientation: 'Reversed' },
        { position: 'Future', name: 'The Star', number: 17, orientation: 'Upright' }
      ];
      const entries = [0, 1, 2].map(index => ({
        id: `startup-journal-${index}`,
        readingResultId: `startup-result-${index}`,
        ts: new Date(2026, 8 + index, 2).getTime(),
        question: `How can I make room for reflection ${index}?`,
        spread: 'Three-Card Story',
        spreadKey: 'threeCard',
        deckId: 'rws-1909',
        context: 'self',
        cards,
        personalReading: 'Make space for a small pause before the next commitment.',
        reflections: { Overall: 'A steadier pace is available.' }
      }));
      await page.addInitScript(value => {
        localStorage.setItem('tarot-onboarding-complete', 'true');
        localStorage.setItem('tarot_journal', JSON.stringify(value));
      }, entries);
      const requests = [];
      page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (/\.js$/.test(path)) requests.push(path);
      });
      try {
        await page.goto('/journal');
        await expect(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true })).toBeVisible();
        await expect(page.getByRole('article')).toHaveCount(3);
        test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Chunk timing applies to the production build.');
        await page.waitForTimeout(800);

        const journeyChunks = () => requests.filter(path => /\/(?:JourneyContent|JourneyMobileSheet)-[^/]+\.js$/.test(path));
        const chartChunks = () => requests.filter(path => /\/(?:AreaChart|CartesianChart|BarChart|CadenceChart|TrendSparkline)-[^/]+\.js$/.test(path));
        expect(journeyChunks()).toEqual([]);
        expect(chartChunks()).toEqual([]);

        // Widening the analytics scope recomputes stats without requesting Journey code.
        // The monthly cadence chart needs entries across at least two scoped months.
        const practiceSummary = page.getByText('Practice snapshot', { exact: true }).first();
        const practiceDetails = practiceSummary.locator('xpath=ancestor::details[1]');
        await practiceSummary.click();
        await expect(practiceDetails).toHaveAttribute('open');
        await practiceDetails.getByRole('button', { name: 'All time', exact: true }).click();
        expect(journeyChunks()).toEqual([]);
        expect(chartChunks()).toEqual([]);

        await page.getByText('Your reading journey', { exact: true }).click();
        const region = page.locator('[aria-label="Journal insights and journey"]');
        await expect(region).toBeVisible();
        await expect.poll(() => journeyChunks().length).toBeGreaterThan(0);
        await expect(region.getByRole('button', { name: /See Full Journey/ })).toBeVisible();
        expect(chartChunks()).toEqual([]);

        await region.getByRole('button', { name: /See Full Journey/ }).click();
        const sheet = page.getByRole('dialog', { name: 'Your Reading Journey' });
        await sheet.getByRole('tab', { name: 'Patterns', exact: true }).click();
        await expect.poll(() => chartChunks().some(path => /\/(?:BarChart|CadenceChart)-/.test(path))).toBe(true);
        await expect(sheet.getByText('Reading Rhythm', { exact: true })).toBeVisible();
      } finally {
        await fixture.close();
      }
    });

    test('a slow reading chunk loads only after drawing and preserves the pending draw', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      let release;
      let requested = false;
      const held = new Promise(resolve => { release = resolve; });
      await page.route(/\/assets\/ReadingDisplay-[^/]+\.js(?:\?.*)?$/, async route => {
        requested = true;
        await held;
        await route.continue();
      });
      try {
        await openSetup(page);
        test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Chunk timing applies to the production build.');
        await page.waitForLoadState('networkidle');
        expect(requested).toBe(false);
        await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(QUESTION);
        await page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first().press('Enter');
        await expect.poll(() => requested).toBe(true);
        await expect(page.getByText('Loading your reading space…', { exact: true })).toBeVisible();
        release();
        await expect(page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first()).toBeEnabled();
      } finally {
        release();
        await fixture.close();
      }
    });

    test('deferred telemetry still reports browser errors', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      const envelopes = [];
      await page.route(/https:\/\/[^/]*sentry\.io\/.*\/envelope\//, route => {
        envelopes.push(route.request().postData() || '');
        return route.fulfill({ json: {} });
      });
      try {
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 2, name: 'Welcome to Tableu', exact: true })).toBeVisible();
        await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', {
          message: 'startup-telemetry-fixture', error: new Error('startup-telemetry-fixture')
        })));
        await expect.poll(() => envelopes.some(body => body.includes('startup-telemetry-fixture'))).toBe(true);
      } finally {
        await fixture.close();
      }
    });

    test('ambience is fetched on activation and the setting can be switched off again', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      const sounds = [];
      page.on('request', request => {
        const { pathname, search } = new URL(request.url());
        if (pathname.startsWith('/sounds/')) sounds.push(pathname + search);
      });
      try {
        await page.goto('/account');
        const ambience = page.locator('#ambience-toggle');
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
        await page.waitForLoadState('networkidle');
        expect(sounds).toEqual([]);
        await ambience.click();
        await expect(ambience).toHaveAttribute('aria-checked', 'true');
        // A versioned URL is what moves a returning browser off its cached copy of an older mix.
        await expect.poll(() => sounds.some(sound => /^\/sounds\/ambience\.mp3\?v=\w+$/.test(sound))).toBe(true);
        expect(sounds).not.toContain('/sounds/flip.mp3');
        await ambience.click();
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
      } finally {
        await fixture.close();
      }
    });

    test('a saved ambience preference starts playing on the first interaction', async ({ page, browserName }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await requirePlayableMp3(page);
        const ambience = await openSettingsWithAmbience(page, browserName, 'true');
        await expect(ambience).toHaveAttribute('aria-checked', 'true');
        // The restored preference was tried and refused: loaded, not running.
        await expect.poll(async () => (await ambiencePlayer(page))?.paused).toBe(true);
        expect((await ambiencePlayer(page)).currentTime).toBe(0);
        // A development build mounts twice and releases its first loop.
        const loops = (await ambiencePlayers(page)).length;

        // An ordinary interaction, away from the audio controls.
        await page.getByRole('heading', { level: 1, name: 'Settings', exact: true }).click();
        await expect.poll(async () => (await ambiencePlayer(page)).currentTime).toBeGreaterThan(0);
        // The loop that was refused is the one that plays; nothing else does.
        const played = await ambiencePlayers(page);
        expect(played).toHaveLength(loops);
        expect(played.slice(0, -1).filter(loop => !loop.paused || loop.currentTime > 0)).toEqual([]);
        await expect(ambience).toHaveAttribute('aria-checked', 'true');
      } finally {
        await fixture.close();
      }
    });

    test('a keyboard toggle to Off pauses ambience and stops its clock', async ({ page, browserName }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await requirePlayableMp3(page);
        const ambience = await openSettingsWithAmbience(page, browserName, 'true');
        await page.getByRole('heading', { level: 1, name: 'Settings', exact: true }).click();
        await expect.poll(async () => (await ambiencePlayer(page))?.currentTime ?? 0).toBeGreaterThan(0);

        await ambience.focus();
        await page.keyboard.press('Space');
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
        expect((await ambiencePlayer(page)).paused).toBe(true);
        const stoppedAt = (await ambiencePlayer(page)).currentTime;
        await page.waitForTimeout(600);
        expect((await ambiencePlayer(page)).currentTime).toBe(stoppedAt);
        // Later interactions must not bring it back.
        await page.getByRole('heading', { level: 1, name: 'Settings', exact: true }).click();
        await page.waitForTimeout(300);
        expect(await ambiencePlayer(page)).toEqual({ paused: true, currentTime: stoppedAt });
      } finally {
        await fixture.close();
      }
    });

    test('turning ambience on with the switch starts playing inside that interaction', async ({ page, browserName }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await requirePlayableMp3(page);
        const ambience = await openSettingsWithAmbience(page, browserName);
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
        expect(await ambiencePlayer(page)).toBeNull();
        await ambience.focus();
        await page.keyboard.press('Enter');
        await expect(ambience).toHaveAttribute('aria-checked', 'true');
        await expect.poll(async () => (await ambiencePlayer(page))?.currentTime ?? 0).toBeGreaterThan(0);
      } finally {
        await fixture.close();
      }
    });

    test('an ambience choice made in another tab moves the switch here without saving it again', async ({ page, browserName }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      let other;
      try {
        // Records what this tab itself writes for the setting.
        await page.addInitScript(key => {
          window.__ambienceWrites = [];
          const setItem = Storage.prototype.setItem;
          Storage.prototype.setItem = function (name, value) {
            if (name === key) window.__ambienceWrites.push(value);
            return setItem.call(this, name, value);
          };
        }, AMBIENCE_KEY);
        const ambience = await openSettingsWithAmbience(page, browserName);
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
        other = await openSecondSettingsTab(page);

        await other.ambience.click();
        await expect(other.ambience).toHaveAttribute('aria-checked', 'true');
        await expect(ambience).toHaveAttribute('aria-checked', 'true');
        await other.ambience.click();
        await expect(other.ambience).toHaveAttribute('aria-checked', 'false');
        await expect(ambience).toHaveAttribute('aria-checked', 'false');

        // A saved choice that is removed, or cleared with everything else, reads as Off.
        for (const forget of [key => localStorage.removeItem(key), () => localStorage.clear()]) {
          await other.tab.evaluate(key => localStorage.setItem(key, 'true'), AMBIENCE_KEY);
          await expect(ambience).toHaveAttribute('aria-checked', 'true');
          await other.tab.evaluate(forget, AMBIENCE_KEY);
          await expect(ambience).toHaveAttribute('aria-checked', 'false');
        }
        expect(await page.evaluate(() => window.__ambienceWrites)).toEqual([]);
      } finally {
        await other?.close();
        await fixture.close();
      }
    });

    test('ambience turned on in another tab is not loaded here until an interaction', async ({ page, browserName }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      const sounds = [];
      page.on('request', request => {
        const { pathname, search } = new URL(request.url());
        if (pathname.startsWith('/sounds/')) sounds.push(pathname + search);
      });
      let other;
      try {
        const ambience = await openSettingsWithAmbience(page, browserName);
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
        other = await openSecondSettingsTab(page);
        await other.ambience.click();
        await expect(ambience).toHaveAttribute('aria-checked', 'true');
        expect(await ambiencePlayer(page)).toBeNull();
        expect(sounds).toEqual([]);

        await page.getByRole('heading', { level: 1, name: 'Settings', exact: true }).click();
        await expect.poll(async () => (await ambiencePlayer(page))?.paused).toBe(false);
      } finally {
        await other?.close();
        await fixture.close();
      }
    });

    test('ambience muted in another tab stops here, and turned back on there it waits for an interaction here', async ({ page, browserName }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      let other;
      try {
        await requirePlayableMp3(page);
        const ambience = await openSettingsWithAmbience(page, browserName);
        const heading = page.getByRole('heading', { level: 1, name: 'Settings', exact: true });
        await ambience.click();
        await expect.poll(async () => (await ambiencePlayer(page))?.currentTime ?? 0).toBeGreaterThan(0);

        other = await openSecondSettingsTab(page);
        await expect(other.ambience).toHaveAttribute('aria-checked', 'true');
        await other.ambience.click();
        await expect(other.ambience).toHaveAttribute('aria-checked', 'false');
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
        const stopped = await expectSilent(page);
        // A later interaction here must not bring it back.
        await heading.click();
        expect(await expectSilent(page)).toEqual(stopped);

        await other.ambience.click();
        await expect(other.ambience).toHaveAttribute('aria-checked', 'true');
        await expect.poll(async () => (await ambiencePlayer(other.tab)).currentTime).toBeGreaterThan(0);
        // On here as well, but not as a second loop behind the reader's back.
        await expect(ambience).toHaveAttribute('aria-checked', 'true');
        expect(await expectSilent(page)).toEqual(stopped);
        await heading.click();
        await expect.poll(async () => (await ambiencePlayer(page)).currentTime).toBeGreaterThan(stopped.currentTime);
      } finally {
        await other?.close();
        await fixture.close();
      }
    });

    test('ambience muted in another tab cancels a start that was waiting for an interaction here', async ({ page, browserName }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      let other;
      try {
        await requirePlayableMp3(page);
        const ambience = await openSettingsWithAmbience(page, browserName, 'true');
        const heading = page.getByRole('heading', { level: 1, name: 'Settings', exact: true });
        await expect(ambience).toHaveAttribute('aria-checked', 'true');
        // The saved preference was refused on load and waits for an interaction.
        await expect.poll(async () => (await ambiencePlayer(page))?.paused).toBe(true);

        other = await openSecondSettingsTab(page);
        await other.ambience.click();
        await expect(other.ambience).toHaveAttribute('aria-checked', 'false');
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
        // The interaction it was waiting for no longer starts it.
        await heading.click();
        expect(await expectSilent(page)).toEqual({ paused: true, currentTime: 0 });

        await other.ambience.click();
        await expect(ambience).toHaveAttribute('aria-checked', 'true');
        expect(await expectSilent(page)).toEqual({ paused: true, currentTime: 0 });
        await heading.click();
        await expect.poll(async () => (await ambiencePlayer(page)).currentTime).toBeGreaterThan(0);
      } finally {
        await other?.close();
        await fixture.close();
      }
    });

    test('the ambience switch still works when the browser blocks storage', async ({ page, browserName }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      try {
        await page.addInitScript(() => {
          Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get() { throw new DOMException('Test storage property access denied', 'SecurityError'); }
          });
        });
        const ambience = await openSettingsWithAmbience(page, browserName);
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
        await ambience.click();
        await expect(ambience).toHaveAttribute('aria-checked', 'true');
        await expect.poll(async () => (await ambiencePlayer(page))?.paused).toBe(false);
        await ambience.click();
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
        expect((await ambiencePlayer(page)).paused).toBe(true);
        expect(pageErrors).toEqual([]);
      } finally {
        await fixture.close();
      }
    });

    test('the first reading can load effects and flip audio, then release effects for reduced motion', async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const fixture = await createNarrativeFixture(page);
      const sounds = [];
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (path.startsWith('/sounds/')) sounds.push(path);
      });
      try {
        await openSetup(page);
        await page.locator('#question-input').fill(QUESTION);
        await page.getByRole('button', { name: /^Draw cards$/ }).click();
        await page.getByRole('button', { name: /^Deal spread/ }).click();
        await page.getByRole('button', { name: /^Reveal next:/ }).click();
        await expect.poll(() => sounds.includes('/sounds/flip.mp3')).toBe(true);
        expect(sounds).not.toContain('/sounds/ambience.mp3');
        await page.getByRole('button', { name: /^Reveal remaining cards/ }).click();
        await page.getByRole('button', { name: /^Interpret cards/ }).press('Enter');
        await fixture.completeReading();
        await expect.poll(() => page.locator('#step-reading canvas').count()).toBeGreaterThan(0);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(page.locator('#step-reading canvas')).toHaveCount(0);
        expect(errors).toEqual([]);
      } finally {
        await fixture.close();
      }
    });
  });
}
