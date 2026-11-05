import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, QUESTION, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';
import { readFile } from 'node:fs/promises';

const WAITING = 'Finishing card narration before your reading…';
const BUSY = 'Another narration is finishing. Please wait a moment, then try again.';
const mp3 = await readFile(new URL('../public/sounds/ambience.mp3', import.meta.url));
const buffered = { audio: `data:audio/mpeg;base64,${mp3.toString('base64')}`, provider: 'workers-ai-aura-2' };
const state = page => page.evaluate(async () => (await import('/src/lib/audio.js')).getCurrentTTSState());
const play = page => page.getByRole('button', { name: /^Read this aloud$|^Play$/ }).filter({ visible: true }).first();

async function preferences(page, auto = true) {
  await page.addInitScript(auto => {
    localStorage.setItem('tarot-voice-enabled', 'true');
    localStorage.setItem('tarot-auto-narrate', String(auto));
    localStorage.setItem('tarot-ambience-enabled', 'false');
  }, auto);
  await page.route(/^https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/, route => route.abort());
}
async function revealFive(page) {
  await openSetup(page);
  await page.getByRole('radio', { name: /Five-Card Clarity/ }).click();
  await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(QUESTION);
  await page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first().click();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: /^(Reveal next:|Reveal next \(|Draw next \(|Draw card for)/ }).filter({ visible: true }).first().press('Enter');
  }
}
async function interpret(page, fixture) {
  await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().press('Enter');
  await fixture.completeReading();
}
async function success(route) {
  if (route.request().postDataJSON().context === 'full-reading') {
    await route.fulfill({ body: mp3, contentType: 'audio/mpeg', headers: { 'x-tts-provider': 'workers-ai-aura-2' } });
  } else await route.fulfill({ json: buffered });
}

for (const mode of ['automatic', 'manual', 'auto-off']) {
  const automatic = mode !== 'manual';
  test(`${mode} completed reading follows five rapid reveals with first-card then full-reading requests`, async ({ page }, testInfo) => {
    await preferences(page, automatic);
    const fixture = await createNarrativeFixture(page, { authMode: 'mock-pro' });
    const calls = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(/\/api\/tts(?:\?|$)/, async route => {
      calls.push(route.request().postDataJSON());
      if (calls.length === 1) await gate;
      await success(route).catch(() => {});
    });
    try {
      await revealFive(page);
      expect(calls.map(call => call.context)).toEqual(['card-reveal']);
      await interpret(page, fixture);
      if (mode === 'auto-off') {
        await page.locator('[data-app-header]').getByRole('button', { name: /^User menu for/ }).click();
        await page.getByRole('link', { name: 'Account & Settings', exact: true }).click();
        await page.getByRole('switch', { name: 'Toggle Auto-Narrate', exact: true }).click();
        await page.locator('main').getByRole('link', { name: 'Back to reading', exact: true }).first().click();
      }
      if (mode !== 'automatic') {
        await expect(play(page)).toBeEnabled();
        await play(page).click();
      }
      expect(calls).toHaveLength(1);
      await page.locator('.reading-screen__status').scrollIntoViewIfNeeded();
      await expect(page.locator('.reading-screen__status').getByRole('status').filter({ hasText: WAITING }).first()).toBeInViewport();
      expect(calls).toHaveLength(1);
      await page.screenshot({ path: testInfo.outputPath('waiting.png'), fullPage: true });
      if (testInfo.project.name === 'webkit-iphone') {
        await page.setViewportSize({ width: 320, height: 900 });
        expect(calls).toHaveLength(1);
        await page.locator('.reading-screen__status').scrollIntoViewIfNeeded();
        await expect(page.locator('.reading-screen__status').getByRole('status').filter({ hasText: WAITING }).first()).toBeInViewport();
        await expectNoHorizontalOverflow(page, '.reading-screen');
        await page.screenshot({ path: testInfo.outputPath('waiting-320.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
      }
      release();
      await expect.poll(() => calls.length).toBe(2);
      expect(calls.map(call => call.context)).toEqual(['card-reveal', 'full-reading']);
      expect(calls[1].text).toContain('What would enough look like today?');
      await expect.poll(async () => (await state(page)).currentTime).toBeGreaterThan(0);
      expect((await state(page)).errorCode).toBeNull();
      expect(calls.filter(call => call.context === 'full-reading')).toHaveLength(1);
    } finally { release(); await fixture.close(); }
  });
}

for (const retryAfter of ['5', undefined, 'invalid']) {
  test(`mock-Pro second-tab busy clears queued reading and waits for manual Play (${retryAfter ?? 'missing'} retry interval)`, async ({ page, context }, testInfo) => {
    await preferences(page);
    const fixture = await createNarrativeFixture(page, { authMode: 'mock-pro' });
    const other = await context.newPage();
    const otherFixture = await createNarrativeFixture(other, { authMode: 'mock-pro' });
    let releaseOther;
    let releaseCard;
    let occupied = true;
    let otherCalls = 0;
    const otherGate = new Promise(resolve => { releaseOther = resolve; });
    const cardGate = new Promise(resolve => { releaseCard = resolve; });
    const calls = [];
    await other.route(/\/api\/tts(?:\?|$)/, async route => {
      if (route.request().postDataJSON().text.startsWith('Other tab')) {
        otherCalls++;
        await otherGate;
        await success(route).catch(() => {});
      } else await route.fallback();
    });
    await page.route(/\/api\/tts(?:\?|$)/, async route => {
      calls.push(route.request().postDataJSON());
      if (calls.length === 1) await cardGate;
      if (occupied) return route.fulfill({ status: 409, json: { errorCode: 'NARRATION_BUSY', retryable: true }, headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter } });
      return success(route);
    });
    try {
      await other.goto('/');
      await other.evaluate(async () => { void (await import('/src/lib/audio.js')).speakText({ text: 'Other tab synthetic narration.', enabled: true, context: 'full-reading', stream: true }); });
      await expect.poll(() => otherCalls).toBe(1);
      await revealFive(page);
      await interpret(page, fixture);
      expect(calls).toHaveLength(1);
      await page.locator('.reading-screen__status').scrollIntoViewIfNeeded();
      await expect(page.locator('.reading-screen__status').getByRole('status').filter({ hasText: WAITING }).first()).toBeInViewport();
      releaseCard();
      const surface = page.locator('.reading-screen__status').getByRole('status').filter({ hasText: BUSY }).first();
      await surface.scrollIntoViewIfNeeded();
      await expect(surface).toBeInViewport();
      await expect(surface).toContainText(`Use Play to try again after at least ${retryAfter === '5' ? 5 : 2} seconds; another narration may take longer.`);
      await expect(page.getByText(WAITING, { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'View subscription options' })).toHaveCount(0);
      await page.waitForTimeout(150);
      expect(calls).toHaveLength(1);
      await page.screenshot({ path: testInfo.outputPath('busy.png'), fullPage: true });
      if (retryAfter === 'invalid') {
        await page.setViewportSize({ width: 320, height: 900 });
        await surface.scrollIntoViewIfNeeded();
        await expect(surface).toBeInViewport();
        await expectNoHorizontalOverflow(page, '.reading-screen');
        await page.screenshot({ path: testInfo.outputPath('busy-320.png'), fullPage: true });
      }
      occupied = false;
      releaseOther();
      await play(page).click();
      await expect.poll(() => calls.length).toBe(2);
      await expect.poll(async () => (await state(page)).currentTime).toBeGreaterThan(0);
    } finally { releaseOther(); releaseCard(); await otherFixture.close(); await other.close(); await fixture.close(); }
  });
}

for (const action of ['Stop', 'reset', 'voice-off', 'provider change', 'unmount', 'duplicate full reading']) {
  test(`real hook handles ${action} while a card response and full reading are pending`, async ({ page }) => {
    await preferences(page, false);
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.goto('/');
    await page.evaluate(async ({ buffered, bytes }) => {
      const { mountNarrationControllerHarness } = await import('/e2e/helpers/narrationControllerHarness.js');
      window.harness = mountNarrationControllerHarness();
      const audio = await import('/src/lib/audio.js');
      await audio.unlockAudio();
      const nativeFetch = window.fetch;
      window.narrationCalls = [];
      window.fetch = (url, options) => {
        if (!String(url).startsWith('/api/tts')) return nativeFetch(url, options);
        const body = JSON.parse(options.body);
        window.narrationCalls.push(body);
        if (window.narrationCalls.length === 1) {
          options.signal.addEventListener('abort', () => { window.cardAborted = true; });
          return new Promise(resolve => { window.releaseOldCard = () => resolve(Response.json(buffered)); });
        }
        return Promise.resolve(new Response(new Uint8Array(bytes), { headers: { 'content-type': 'audio/mpeg' } }));
      };
      void window.harness.controller.speak('Held card.', 'card-reveal');
      void window.harness.controller.speak('A complete screened reading.', 'full-reading');
    }, { buffered, bytes: [...mp3] });
    await expect.poll(() => page.evaluate(() => window.harness.controller.ttsState.reason)).toBe('waiting-for-card');
    await page.evaluate(action => {
      const h = window.harness;
      if (action === 'Stop') h.controller.handleNarrationStop();
      if (action === 'reset') h.controller.resetNarrationStream();
      if (action === 'voice-off') h.preferences.setVoiceOn(false);
      if (action === 'provider change') h.preferences.setTtsProvider('elevenlabs');
      if (action === 'unmount') h.close();
      if (action === 'duplicate full reading') void h.controller.handleNarrationButtonClick('A complete screened reading.', false);
    }, action);
    if (action !== 'duplicate full reading') await expect.poll(() => page.evaluate(() => Boolean(window.cardAborted))).toBe(true);
    await page.evaluate(() => window.releaseOldCard());
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.narrationCalls.length)).toBe(action === 'duplicate full reading' ? 2 : 1);
    if (action !== 'unmount') await page.evaluate(() => window.harness.close());
  });
}
