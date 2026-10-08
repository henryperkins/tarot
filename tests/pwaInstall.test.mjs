import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPwaInstallStore, PWA_INSTALL_PREFERENCES_KEY, PWA_GUIDANCE_SNOOZE_MS, shouldShowPwaInstall } from '../src/lib/pwaInstall.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

function createHostedStore(browser, options) {
  const store = createPwaInstallStore(browser, options);
  store.registerHost();
  return store;
}

function createWindow({ userAgent = 'Mozilla/5.0 Chrome/140.0', maxTouchPoints = 0, standalone = false, legacyMedia = false, noMedia = false } = {}) {
  const browser = new EventTarget();
  const media = new EventTarget();
  media.matches = false;
  media.media = '(display-mode: standalone)';
  if (legacyMedia) {
    media.addListener = listener => EventTarget.prototype.addEventListener.call(media, 'change', listener);
    media.addEventListener = undefined;
  }
  browser.navigator = { userAgent, maxTouchPoints, standalone };
  browser.matchMedia = noMedia ? undefined : query => {
    assert.equal(query, '(display-mode: standalone)');
    return media;
  };
  browser.setStandalone = matches => {
    media.matches = matches;
    media.dispatchEvent(new Event('change'));
  };
  return browser;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function installEvent({ prompt = () => Promise.resolve(), userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' }) } = {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = prompt;
  event.userChoice = userChoice;
  return event;
}

describe('PWA install store', () => {
  it('supports server rendering and browsers without install or media APIs', async () => {
    const server = createPwaInstallStore(undefined);
    assert.doesNotThrow(() => server.initialize());
    assert.deepEqual(server.getSnapshot(), {
      canPrompt: false, isIOS: false, isInstalled: false, isPrompting: false, error: null,
      isSnoozed: false, hasAddedToHomeScreen: false, snoozedUntil: 0
    });
    assert.equal(server.getSnapshot(), server.getSnapshot());
    assert.equal(server.getServerSnapshot(), server.getServerSnapshot());
    assert.equal(await server.requestInstall(), null);

    const browser = createWindow({ noMedia: true });
    const store = createHostedStore(browser);
    store.initialize();
    assert.equal(store.getSnapshot().canPrompt, false);
    assert.equal(await store.requestInstall(), null);
  });

  for (const [device, userAgent, maxTouchPoints, expected] of [
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5, true],
    ['iPad', 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 5, true],
    ['iPod', 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)', 5, true],
    ['desktop-UA iPad', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15', 5, true],
    ['Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15', 0, false],
    ['Android', 'Mozilla/5.0 (Linux; Android 16) Chrome/140.0', 5, false]
  ]) {
    it(`detects ${device} without relying on touch support alone`, () => {
      const store = createPwaInstallStore(createWindow({ userAgent, maxTouchPoints }));
      assert.equal(store.getSnapshot().isIOS, expected);
    });
  }

  it('retains early prompt eligibility across subscriber remounts and initializes only once', () => {
    const browser = createWindow();
    const store = createHostedStore(browser);
    store.initialize();
    store.initialize();
    const event = installEvent();
    browser.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(store.getSnapshot().canPrompt, true);

    const notifications = [];
    const unsubscribe = store.subscribe(() => notifications.push(store.getSnapshot()));
    const unsubscribeSecond = store.subscribe(() => notifications.push(store.getSnapshot()));
    unsubscribe();
    unsubscribeSecond();
    const remounted = store.subscribe(() => notifications.push(store.getSnapshot()));
    assert.equal(store.getSnapshot().canPrompt, true);
    browser.dispatchEvent(new Event('appinstalled'));
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].isInstalled, true);
    assert.equal(notifications[0].canPrompt, false);
    remounted();
  });

  it('does not show an install control solely because a previous request failed', () => {
    assert.equal(shouldShowPwaInstall({ error: 'Unable to install' }), false);
    assert.equal(shouldShowPwaInstall({ isIOS: true }), true);
    assert.equal(shouldShowPwaInstall({ canPrompt: true }), true);
    assert.equal(shouldShowPwaInstall({ isPrompting: true }), true);
    assert.equal(shouldShowPwaInstall({ isInstalled: true, isIOS: true, canPrompt: true }), false);
  });

  it('does not cancel ineligible, manual-iOS or already-installed browser events', () => {
    for (const browser of [
      createWindow({ userAgent: 'iPhone' }),
      createWindow({ standalone: true }),
      createWindow()
    ]) {
      const store = createHostedStore(browser);
      store.initialize();
      const event = browser.navigator.userAgent === 'Mozilla/5.0 Chrome/140.0' && !browser.navigator.standalone
        ? new Event('beforeinstallprompt', { cancelable: true })
        : installEvent();
      browser.dispatchEvent(event);
      assert.equal(event.defaultPrevented, false);
      assert.equal(store.getSnapshot().canPrompt, false);
    }
  });

  for (const legacyMedia of [false, true]) {
    it(`updates standalone state through ${legacyMedia ? 'legacy' : 'modern'} media query events`, () => {
      const browser = createWindow({ legacyMedia });
      const store = createHostedStore(browser);
      store.initialize();
      browser.dispatchEvent(installEvent());
      browser.setStandalone(true);
      assert.equal(store.getSnapshot().isInstalled, true);
      assert.equal(store.getSnapshot().canPrompt, false);
      browser.setStandalone(false);
      assert.equal(store.getSnapshot().isInstalled, false);
      assert.equal(store.getSnapshot().canPrompt, false);
    });
  }

  it('detects initial standalone display mode before a UI consumer subscribes', () => {
    const browser = createWindow();
    browser.setStandalone(true);
    const store = createHostedStore(browser);
    assert.equal(store.getSnapshot().isInstalled, true);
    assert.equal(store.getSnapshot().canPrompt, false);
  });

  it('invokes prompt during the click and consumes the event across duplicate requests', async () => {
    const browser = createWindow();
    const store = createHostedStore(browser);
    const choice = deferred();
    let promptCalls = 0;
    store.initialize();
    const event = installEvent({
      prompt: () => { promptCalls += 1; return Promise.resolve(); },
      userChoice: choice.promise
    });
    browser.dispatchEvent(event);
    const request = store.requestInstall();
    assert.equal(promptCalls, 1, 'prompt must run before requestInstall returns to its click handler');
    assert.equal(store.getSnapshot().isPrompting, true);
    assert.equal(store.getSnapshot().canPrompt, false);
    assert.equal(await store.requestInstall(), null);
    assert.equal(promptCalls, 1);
    choice.resolve({ outcome: 'dismissed', platform: 'web' });
    assert.deepEqual(await request, { outcome: 'dismissed', platform: 'web' });
    assert.equal(store.getSnapshot().isPrompting, false);
    assert.equal(store.getSnapshot().canPrompt, false);
    assert.equal(await store.requestInstall(), null);

    browser.dispatchEvent(event);
    assert.equal(store.getSnapshot().canPrompt, false, 'a consumed event cannot be reused');
    browser.dispatchEvent(installEvent());
    assert.equal(store.getSnapshot().canPrompt, true, 'a fresh browser event permits another attempt');
  });

  it('retains a fresh event arriving while an earlier prompt is pending', async () => {
    const browser = createWindow();
    const store = createHostedStore(browser);
    const choice = deferred();
    store.initialize();
    browser.dispatchEvent(installEvent({ userChoice: choice.promise }));
    const request = store.requestInstall();
    browser.dispatchEvent(installEvent());
    assert.equal(store.getSnapshot().canPrompt, false);
    choice.resolve({ outcome: 'dismissed', platform: 'web' });
    await request;
    assert.equal(store.getSnapshot().canPrompt, true);
  });

  it('hides controls immediately when installation completes during a pending choice', async () => {
    const browser = createWindow();
    const store = createHostedStore(browser);
    const choice = deferred();
    store.initialize();
    browser.dispatchEvent(installEvent({ userChoice: choice.promise }));
    const request = store.requestInstall();
    browser.dispatchEvent(new Event('appinstalled'));
    assert.equal(store.getSnapshot().isInstalled, true);
    assert.equal(store.getSnapshot().isPrompting, false);
    assert.equal(store.getSnapshot().canPrompt, false);
    const lateEvent = installEvent();
    browser.dispatchEvent(lateEvent);
    assert.equal(lateEvent.defaultPrevented, false);
    choice.reject(new Error('browser-specific private details'));
    assert.equal(await request, null);
    assert.equal(store.getSnapshot().error, null);
    assert.equal(store.getSnapshot().isInstalled, true);
    browser.setStandalone(false);
    assert.equal(store.getSnapshot().isInstalled, true);
  });

  for (const failure of ['synchronous prompt', 'rejected prompt', 'rejected choice']) {
    it(`handles a ${failure} failure with a safe error and no stale prompt`, async () => {
      const browser = createWindow();
      const store = createHostedStore(browser);
      store.initialize();
      browser.dispatchEvent(installEvent({
        prompt: failure === 'synchronous prompt'
          ? () => { throw new Error('sensitive implementation details'); }
          : failure === 'rejected prompt'
            ? () => Promise.reject(new Error('sensitive implementation details'))
            : () => Promise.resolve(),
        userChoice: failure === 'rejected choice'
          ? Promise.reject(new Error('sensitive implementation details'))
          : Promise.resolve({ outcome: 'dismissed', platform: 'web' })
      }));
      assert.equal(await store.requestInstall(), null);
      assert.equal(store.getSnapshot().isPrompting, false);
      assert.equal(store.getSnapshot().canPrompt, false);
      assert.match(store.getSnapshot().error, /install/i);
      assert.doesNotMatch(store.getSnapshot().error, /sensitive|details/);
      browser.dispatchEvent(installEvent());
      assert.equal(store.getSnapshot().error, null);
      assert.equal(store.getSnapshot().canPrompt, true);
    });
  }
});

describe('PWA install UI hosts', () => {
  it('leaves fresh offers uncanceled and uncached without a host, including subscriber-only routes', () => {
    const browser = createWindow();
    const store = createPwaInstallStore(browser);
    store.initialize();
    for (const withSubscriber of [false, true]) {
      const unsubscribe = withSubscriber ? store.subscribe(() => {}) : () => {};
      const event = installEvent();
      browser.dispatchEvent(event);
      assert.equal(event.defaultPrevented, false);
      assert.equal(store.getSnapshot().canPrompt, false);
      unsubscribe();
    }
    store.registerHost();
    assert.equal(store.getSnapshot().canPrompt, false, 'an offer from a route without install UI was not cached');
  });

  it('keeps independent hosts registered through idempotent cleanup and preserves captured unused offers on remount', async () => {
    const browser = createWindow();
    const store = createPwaInstallStore(browser);
    const first = store.registerHost();
    const second = store.registerHost();
    first();
    first();
    const event = installEvent();
    browser.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true, 'the second host remains mounted');
    second();
    const whileAway = installEvent();
    browser.dispatchEvent(whileAway);
    assert.equal(whileAway.defaultPrevented, false);
    assert.equal(store.getSnapshot().canPrompt, true, 'navigation retains the earlier hosted offer');
    const remount = store.registerHost();
    remount();
    store.registerHost();
    assert.equal(store.getSnapshot().canPrompt, true, 'StrictMode cleanup/remount retains the offer');
    await store.requestInstall();
    browser.dispatchEvent(event);
    assert.equal(store.getSnapshot().canPrompt, false, 'consumed offers remain consumed after host remount');
  });
});

describe('iOS install guidance preferences', () => {
  for (const action of ['snoozeGuidance', 'dismissGuidance']) {
    it(`does not cancel a browser event when iOS guidance is hidden by ${action}`, () => {
      const browser = createWindow({ userAgent: 'iPhone' });
      const store = createHostedStore(browser, { storage: createStorage() });
      store[action]();
      const event = installEvent();
      browser.dispatchEvent(event);
      assert.equal(event.defaultPrevented, false);
      assert.equal(store.getSnapshot().canPrompt, false);
      assert.equal(shouldShowPwaInstall(store.getSnapshot()), false);
    });
  }

  it('snoozes for seven days across route remounts and reloads, then expires', () => {
    const storage = createStorage();
    let time = 1000;
    const browser = createWindow({ userAgent: 'iPhone' });
    const store = createHostedStore(browser, { storage, now: () => time });
    assert.deepEqual(store.snoozeGuidance(), { persisted: true });
    assert.equal(store.getSnapshot().snoozedUntil, time + PWA_GUIDANCE_SNOOZE_MS);
    assert.equal(store.getSnapshot().isSnoozed, true);
    assert.equal(store.getSnapshot().isInstalled, false);
    assert.equal(shouldShowPwaInstall(store.getSnapshot()), false);
    const unsubscribe = store.subscribe(() => {});
    unsubscribe();
    store.subscribe(() => {});
    assert.equal(shouldShowPwaInstall(store.getSnapshot()), false);
    time += PWA_GUIDANCE_SNOOZE_MS - 1;
    const reloaded = createHostedStore(createWindow({ userAgent: 'iPhone' }), { storage, now: () => time });
    assert.equal(shouldShowPwaInstall(reloaded.getSnapshot()), false);
    time += 1;
    browser.dispatchEvent(new Event('focus'));
    assert.equal(store.getSnapshot().isSnoozed, false);
    assert.equal(shouldShowPwaInstall(store.getSnapshot()), true);
    const afterExpiry = createHostedStore(createWindow({ userAgent: 'iPhone' }), { storage, now: () => time });
    assert.equal(shouldShowPwaInstall(afterExpiry.getSnapshot()), true);
  });

  it('expires a snooze in the mounted page when its timer runs', () => {
    let time = 1000;
    const browser = createWindow({ userAgent: 'iPhone' });
    const timers = new Map();
    let id = 0;
    browser.setTimeout = (callback, delay) => {
      timers.set(++id, { callback, delay });
      return id;
    };
    browser.clearTimeout = timer => timers.delete(timer);
    const store = createHostedStore(browser, { storage: createStorage(), now: () => time });
    store.snoozeGuidance();
    const timer = [...timers.values()][0];
    assert.equal(timer.delay, PWA_GUIDANCE_SNOOZE_MS);
    time += timer.delay;
    timer.callback();
    assert.equal(store.getSnapshot().isSnoozed, false);
    assert.equal(shouldShowPwaInstall(store.getSnapshot()), true);
  });

  it('keeps Already added durable without claiming this browser is in standalone mode', () => {
    const storage = createStorage();
    const store = createHostedStore(createWindow({ userAgent: 'iPhone' }), { storage });
    assert.deepEqual(store.dismissGuidance(), { persisted: true });
    assert.equal(store.getSnapshot().hasAddedToHomeScreen, true);
    assert.equal(store.getSnapshot().isInstalled, false);
    const reloaded = createHostedStore(createWindow({ userAgent: 'iPhone' }), { storage });
    assert.equal(reloaded.getSnapshot().hasAddedToHomeScreen, true);
    assert.equal(shouldShowPwaInstall(reloaded.getSnapshot()), false);
  });

  for (const installedBy of ['standalone', 'appinstalled']) {
    it(`remembers ${installedBy} installation when reopening a link in Safari`, () => {
      const storage = createStorage();
      const browser = createWindow({ userAgent: 'iPhone', standalone: installedBy === 'standalone' });
      const installed = createHostedStore(browser, { storage });
      if (installedBy === 'appinstalled') browser.dispatchEvent(new Event('appinstalled'));
      assert.equal(installed.getSnapshot().isInstalled, true);
      const safari = createHostedStore(createWindow({ userAgent: 'iPhone' }), { storage });
      assert.equal(safari.getSnapshot().isInstalled, false);
      assert.equal(safari.getSnapshot().hasAddedToHomeScreen, true);
      assert.equal(shouldShowPwaInstall(safari.getSnapshot()), false);
    });
  }

  for (const failure of ['missing storage', 'throwing storage', 'silent writes', 'different read-back']) {
    for (const action of ['snoozeGuidance', 'dismissGuidance']) {
      it(`${action} hides for the session without claiming persistence with ${failure}`, () => {
        const storage = failure === 'missing storage' ? null : createStorage();
        if (failure === 'throwing storage') {
          storage.getItem = () => { throw new Error('Storage denied'); };
          storage.setItem = () => { throw new Error('Storage denied'); };
        } else if (failure === 'silent writes') storage.setItem = () => {};
        else if (failure === 'different read-back') {
          const write = storage.setItem;
          storage.setItem = key => write(key, '{}');
        }
        const browser = createWindow({ userAgent: 'iPhone' });
        const store = createHostedStore(browser, { storage });
        assert.deepEqual(store[action](), { persisted: false });
        assert.equal(shouldShowPwaInstall(store.getSnapshot()), false);
        store.subscribe(() => {})();
        browser.dispatchEvent(new Event('focus'));
        assert.equal(shouldShowPwaInstall(store.getSnapshot()), false, 'session choice survives route/focus refresh');
        const reloaded = createHostedStore(createWindow({ userAgent: 'iPhone' }), { storage });
        assert.equal(shouldShowPwaInstall(reloaded.getSnapshot()), true);
      });
    }
  }

  it('ignores corrupt or unsupported preference records and synchronizes valid changes across tabs', () => {
    for (const raw of ['{', '{}', '{"version":2,"hasAddedToHomeScreen":true}', '{"version":1,"hasAddedToHomeScreen":"true","snoozedUntil":"tomorrow"}']) {
      const store = createHostedStore(createWindow({ userAgent: 'iPhone' }), { storage: createStorage({ [PWA_INSTALL_PREFERENCES_KEY]: raw }) });
      assert.equal(shouldShowPwaInstall(store.getSnapshot()), true);
    }
    const storage = createStorage();
    const firstBrowser = createWindow({ userAgent: 'iPhone' });
    const first = createHostedStore(firstBrowser, { storage });
    const second = createHostedStore(createWindow({ userAgent: 'iPhone' }), { storage });
    second.dismissGuidance();
    const event = new Event('storage');
    event.key = PWA_INSTALL_PREFERENCES_KEY;
    firstBrowser.dispatchEvent(event);
    assert.equal(first.getSnapshot().hasAddedToHomeScreen, true);
    assert.equal(shouldShowPwaInstall(first.getSnapshot()), false);
  });

  it('does not let an iOS guidance preference suppress an eligible native browser offer', () => {
    const storage = createStorage();
    createHostedStore(createWindow({ userAgent: 'iPhone' }), { storage }).dismissGuidance();
    const browser = createWindow();
    const native = createHostedStore(browser, { storage });
    const event = installEvent();
    browser.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(native.getSnapshot().canPrompt, true);
    assert.equal(shouldShowPwaInstall(native.getSnapshot()), true);
  });
});
