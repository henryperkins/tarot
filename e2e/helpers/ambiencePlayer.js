// Helpers for tests that watch the real ambience player.

/**
 * Some WebKit builds (Playwright's on Windows) never load MP3 audio, so a
 * real-media check cannot run there. The probe uses a page of its own:
 * Playwright's evaluate() runs with an emulated user gesture, which must not
 * reach the page whose autoplay behavior is under test.
 */
export async function canPlayMp3(page) {
  const probe = await page.context().newPage();
  try {
    await probe.goto('/offline.html');
    return await probe.evaluate(async () => {
      const control = new Audio('/sounds/flip.mp3');
      control.muted = true;
      control.play().catch(() => {});
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline && control.currentTime === 0 && !control.ended) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return control.currentTime > 0 || control.ended;
    });
  } finally {
    await probe.close();
  }
}

/**
 * Browsers refuse audible playback until the reader has interacted with the
 * page. Chromium enforces that itself, in automation too, and tests rely on
 * it there as long as nothing evaluates in the page before the app's first
 * start attempt. Other engines' automation builds may be more permissive, so
 * for them the same rule is applied from trusted clicks, taps and keys: a
 * start before any interaction is refused, and one after a real click, tap or
 * keypress plays the real element. Accepts a page or a context.
 */
export async function requireInteractionForPlayback(target, browserName) {
  if (browserName === 'chromium') return;
  await target.addInitScript(() => {
    // WebKit automation can grant activation while Playwright reads the DOM.
    // Only a real input in this document satisfies this test's autoplay gate.
    let interacted = false;
    for (const type of ['click', 'touchend', 'keydown']) {
      window.addEventListener(type, event => { if (event.isTrusted) interacted = true; }, { capture: true });
    }
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      if (!this.muted && !interacted) {
        return Promise.reject(new DOMException("play() failed because the user didn't interact with the document first.", 'NotAllowedError'));
      }
      return nativePlay.call(this);
    };
  });
}

/**
 * The app's players are detached Audio objects. Recording each one as it is
 * created lets a test read the real element's state. Accepts a page or a
 * browser context.
 */
export function trackPlayers(target) {
  return target.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.__players = [];
    window.Audio = function Audio(src) {
      const player = new NativeAudio(src);
      const play = player.play;
      player.playCalls = 0;
      player.play = function (...args) { player.playCalls++; return play.apply(this, args); };
      window.__players.push(player);
      return player;
    };
    window.Audio.prototype = NativeAudio.prototype;
  });
}

/** The ambience loops this page has created, in order. */
export function ambiencePlayers(page) {
  return page.evaluate(() => (window.__players || [])
    .filter(player => player.src.includes('/sounds/ambience.mp3'))
    .map(player => ({ paused: player.paused, currentTime: player.currentTime })));
}

/** The page's ambience loop, or null before it has created one. */
export async function ambiencePlayer(page) {
  return (await ambiencePlayers(page)).at(-1) ?? null;
}

/** Whether the page's latest ambience loop failed to load its file. */
export function ambienceLoadFailed(page) {
  return page.evaluate(() => Boolean((window.__players || [])
    .filter(player => player.src.includes('/sounds/ambience.mp3')).at(-1)?.error));
}

/**
 * Observe the sprite sources and the synthesized fallback. A one-shot has a
 * duration or a scheduled stop. A loop needs an explicit stop.
 */
export function trackTones(target) {
  return target.addInitScript(() => {
    window.__tones = [];
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    for (const method of ['createBufferSource', 'createOscillator']) {
      const create = Context.prototype[method];
      Context.prototype[method] = function (...args) {
        const source = create.apply(this, args);
        const { start, stop } = source;
        source.start = function (...args) {
          const tone = { method, offset: args[1], ending: method === 'createBufferSource' && !source.loop };
          window.__tones.push(tone);
          source.stop = function (...times) { tone.ending = true; return stop.apply(this, times); };
          return start.apply(this, args);
        };
        return source;
      };
    }
  });
}

/** How many looping tones the page has started and not stopped. */
export function loopingTones(page) {
  return page.evaluate(() => (window.__tones || []).filter(tone => !tone.ending).length);
}
