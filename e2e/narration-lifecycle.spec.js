import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, openReadingSupport, startReading } from './helpers/narrativeFixtures.js';
import { readFile } from 'node:fs/promises';

async function enableNarration(page) {
  await page.addInitScript(() => {
    localStorage.setItem('tarot-voice-enabled', 'true');
    localStorage.setItem('tarot-auto-narrate', 'true');
  });
}

async function recordSpeech(page) {
  const requests = [];
  await page.route(/\/api\/tts(?:\?|$)/, route => {
    const body = route.request().postDataJSON();
    if (body.context === 'full-reading') requests.push(body);
    return route.fulfill({ status: 429, json: { errorCode: 'TIER_LIMIT', tierLimited: true, used: 3, limit: 3 } });
  });
  return requests;
}

test('a failed reading never narrates its unfinished text', async ({ page }) => {
  await enableNarration(page);
  const fixture = await createNarrativeFixture(page);
  const requests = await recordSpeech(page);
  try {
    await startReading(page, fixture, { complete: false });
    await fixture.emit('reading', 'delta', { text: 'This unfinished reading has not passed final screening.' });
    await fixture.emit('reading', 'error', { message: 'Reading interrupted for this regression.' });
    await expect(page.getByRole('button', { name: 'Retry interpretation' })).toBeVisible();
    // Let passive effects and any TTS request settle after the terminal UI.
    await expect(async () => {
      expect(requests).toHaveLength(0);
      expect(await page.evaluate(async () => (await import('/src/lib/audio.js')).getCurrentTTSState().context)).not.toBe('full-reading');
    }).toPass({ timeout: 1500 });
    await page.waitForTimeout(250);
    expect(requests).toHaveLength(0);
  } finally { await fixture.close(); }
});

test('stopping an earlier narration does not suppress the next completed reading', async ({ page }) => {
  await enableNarration(page);
  const fixture = await createNarrativeFixture(page);
  const requests = await recordSpeech(page);
  try {
    await openSetup(page);
    await page.evaluate(async () => (await import('/src/lib/audio.js')).stopTTS());
    await startReading(page, fixture, { setup: false });
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0].text).toContain('What would enough look like today?');
  } finally { await fixture.close(); }
});

test('changing the narrator keeps auto narration enabled for the next reading', async ({ page }) => {
  await enableNarration(page);
  await page.addInitScript(() => localStorage.setItem('tarot-tts-provider', 'elevenlabs'));
  const fixture = await createNarrativeFixture(page);
  const requests = await recordSpeech(page);
  try {
    await openSetup(page);
    await page.goto('/account#audio');
    await page.getByRole('radio', { name: 'Deepgram Aura-2' }).click();
    await page.getByRole('link', { name: 'Done', exact: true }).click();
    await startReading(page, fixture, { setup: false });
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0].provider).toBe('deepgram');
  } finally { await fixture.close(); }
});

test('long streaming audio buffers a bounded window and reaches the end without overflow', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.goto('/');
  await page.evaluate(async () => {
    const audio = await import('/src/lib/audio.js');
    await audio.unlockAudio();
    const nativeFetch = window.fetch;
    const bytes = new Uint8Array(await (await nativeFetch('/sounds/ambience.mp3')).arrayBuffer());
    const NativeAudio = window.Audio;
    window.narrationBufferTest = { read: 0, appended: 0, appendErrors: [], maxBufferedSeconds: 0 };
    const result = window.narrationBufferTest;
    window.Audio = function(src) { const player = new NativeAudio(src); result.player = player; return player; };
    const append = SourceBuffer.prototype.appendBuffer;
    SourceBuffer.prototype.appendBuffer = function(buffer) {
      result.buffer = this;
      try { append.call(this, buffer); result.appended += buffer.byteLength; }
      catch (error) { result.appendErrors.push(error.name); throw error; }
    };
    window.fetch = (input, options) => {
      if (!String(input).startsWith('/api/tts')) return nativeFetch(input, options);
      return Promise.resolve(new Response(new ReadableStream({
        pull(controller) {
          if (result.read < 45) { result.read++; controller.enqueue(bytes); }
          else controller.close();
        }
      }), { headers: { 'content-type': 'audio/mpeg', 'x-tts-provider': 'elevenlabs' } }));
    };
    result.totalBytes = bytes.byteLength * 45;
    result.play = audio.speakText({ text: 'A long complete reading.', enabled: true, stream: true, context: 'full-reading' });
  });
  await expect.poll(() => page.evaluate(async () => (await import('/src/lib/audio.js')).getCurrentTTSState().status)).toBe('playing');
  await page.waitForTimeout(500);
  const initial = await page.evaluate(() => {
    const r = window.narrationBufferTest;
    return { read: r.read, end: r.buffer.buffered.end(r.buffer.buffered.length - 1), errors: r.appendErrors };
  });
  expect(initial.errors).toEqual([]);
  expect(initial.end).toBeLessThan(150);
  expect(initial.read).toBeLessThan(45);
  // Seek through consumed audio instead of waiting 22 minutes for this fixture.
  await expect.poll(async () => page.evaluate(() => {
    const r = window.narrationBufferTest;
    const ranges = r.buffer.buffered;
    if (ranges.length) {
      const end = ranges.end(ranges.length - 1);
      r.maxBufferedSeconds = Math.max(r.maxBufferedSeconds, end - ranges.start(0));
      r.player.currentTime = Math.max(r.player.currentTime, end - 0.1);
    }
    return r.appended;
  }), { timeout: 40000, intervals: [50] }).toBe(await page.evaluate(() => window.narrationBufferTest.totalBytes));
  await expect.poll(() => page.evaluate(async () => (await import('/src/lib/audio.js')).getCurrentTTSState().status)).toBe('completed');
  const final = await page.evaluate(() => ({ errors: window.narrationBufferTest.appendErrors, max: window.narrationBufferTest.maxBufferedSeconds }));
  expect(final.errors).toEqual([]);
  expect(final.max).toBeLessThan(160);
  expect(errors).toEqual([]);
});

for (const provider of ['elevenlabs', 'deepgram']) {
  test(`${provider} narration supports auto play, pause, resume, stop, replay and reading reset`, async ({ page }) => {
    await enableNarration(page);
    await page.addInitScript(value => localStorage.setItem('tarot-tts-provider', value), provider);
    const fixture = await createNarrativeFixture(page, { signedOut: provider === 'deepgram' });
    const mp3 = await readFile(new URL('../public/sounds/ambience.mp3', import.meta.url));
    const requests = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/\/api\/tts(?:\?|$)/, route => {
      const body = route.request().postDataJSON();
      if (body.context === 'full-reading') requests.push(body);
      return route.fulfill({ body: mp3, contentType: 'audio/mpeg', headers: { 'x-tts-provider': provider === 'deepgram' ? 'workers-ai-aura-2' : 'elevenlabs' } });
    });
    const state = () => page.evaluate(async () => (await import('/src/lib/audio.js')).getCurrentTTSState());
    const control = name => page.getByRole('button', { name }).filter({ visible: true }).first();
    try {
      await startReading(page, fixture);
      await expect.poll(async () => (await state()).status).toBe('playing');
      await expect.poll(async () => (await state()).currentTime).toBeGreaterThan(0);
      expect(requests).toHaveLength(1);
      expect(requests[0].provider).toBe(provider);
      await control(/^Pause narration$|^Pause$/).click();
      await expect.poll(async () => (await state()).status).toBe('paused');
      await control(/^Resume narration$|^Resume$/).click();
      await expect.poll(async () => (await state()).status).toBe('playing');
      await control(/^Stop$/).click();
      await expect.poll(async () => (await state()).status).toBe('stopped');
      await page.waitForTimeout(250);
      expect(requests).toHaveLength(1);
      await control(/^Read this aloud$|^Play$/).click();
      await expect.poll(async () => (await state()).status).toBe('playing');
      expect(requests).toHaveLength(2);
      await openReadingSupport(page);
      await control('Start a new reading and reset this spread').click();
      await expect.poll(async () => (await state()).status).toBe('idle');
      expect(errors).toEqual([]);
    } finally { await fixture.close(); }
  });
}

test('starting a new reading aborts narration still waiting for its response', async ({ page }) => {
  await enableNarration(page);
  const fixture = await createNarrativeFixture(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let fullReadingRequests = 0;
  await page.route(/\/api\/tts(?:\?|$)/, async route => {
    if (route.request().postDataJSON().context === 'full-reading') {
      fullReadingRequests++;
      await gate;
    }
    await route.fulfill({ status: 429, json: { errorCode: 'TIER_LIMIT' } }).catch(() => {});
  });
  try {
    await openSetup(page);
    await page.evaluate(() => {
      const nativeFetch = window.fetch;
      window.fetch = (input, options) => {
        if (String(input) === '/api/tts?stream=true') {
          options.signal.addEventListener('abort', () => { window.pendingNarrationAborted = true; });
        }
        return nativeFetch(input, options);
      };
    });
    await startReading(page, fixture, { setup: false });
    await expect.poll(() => fullReadingRequests).toBe(1);
    await openReadingSupport(page);
    await page.getByRole('button', { name: 'Start a new reading and reset this spread' }).click();
    await expect.poll(() => page.evaluate(() => window.pendingNarrationAborted)).toBe(true);
    release();
    await expect.poll(() => page.evaluate(async () => (await import('/src/lib/audio.js')).getCurrentTTSState().status)).toBe('idle');
  } finally { release(); await fixture.close(); }
});

for (const action of ['play', 'enable', 'delayed-enable']) {
  test(`reset cancels a pending ${action} UI intent before it can submit old text`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tarot-voice-enabled', 'true');
      localStorage.setItem('tarot-auto-narrate', 'false');
    });
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    const requests = await recordSpeech(page);
    await page.goto('/');
    await page.evaluate(async action => {
      const { mountNarrationControllerHarness } = await import('/e2e/helpers/narrationControllerHarness.js');
      const harness = mountNarrationControllerHarness();
      window.narrationControllerHarness = harness;
      const nativePlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function() {
        if (this.src.startsWith('data:audio/mp3')) {
          return new Promise(resolve => { window.releaseNarrationUnlock = resolve; });
        }
        return nativePlay.call(this);
      };
      const nativeTimeout = window.setTimeout;
      window.setTimeout = (callback, delay, ...args) => {
        if (action === 'delayed-enable' && delay === 120) {
          window.releaseNarrationTimer = () => callback(...args);
          return 0;
        }
        return nativeTimeout(callback, delay, ...args);
      };
      window.narrationIntent = action === 'play'
        ? harness.controller.handleNarrationButtonClick('Old reading awaiting interaction.', false)
        : harness.controller.handleVoicePromptEnable('Old reading awaiting interaction.');
    }, action);
    await expect.poll(() => page.evaluate(() => typeof window.releaseNarrationUnlock)).toBe('function');
    if (action === 'delayed-enable') {
      await page.evaluate(() => window.releaseNarrationUnlock());
      await expect.poll(() => page.evaluate(() => typeof window.releaseNarrationTimer)).toBe('function');
    }
    await page.evaluate(async action => {
      window.narrationControllerHarness.controller.resetNarrationStream();
      if (action === 'delayed-enable') window.releaseNarrationTimer();
      else window.releaseNarrationUnlock();
      await window.narrationIntent;
    }, action);
    await page.waitForTimeout(200);
    expect(requests).toHaveLength(0);
    expect(await page.evaluate(async () => (await import('/src/lib/audio.js')).getCurrentTTSState().status)).toBe('idle');
    await page.evaluate(() => window.narrationControllerHarness.close());
  });
}
