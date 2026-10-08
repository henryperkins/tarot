import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPwaInstallStore } from '../src/lib/pwaInstall.js';

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
      canPrompt: false, isIOS: false, isInstalled: false, isPrompting: false, error: null
    });
    assert.equal(server.getSnapshot(), server.getSnapshot());
    assert.equal(server.getServerSnapshot(), server.getServerSnapshot());
    assert.equal(await server.requestInstall(), null);

    const browser = createWindow({ noMedia: true });
    const store = createPwaInstallStore(browser);
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
    const store = createPwaInstallStore(browser);
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

  it('does not cancel ineligible, manual-iOS or already-installed browser events', () => {
    for (const browser of [
      createWindow({ userAgent: 'iPhone' }),
      createWindow({ standalone: true }),
      createWindow()
    ]) {
      const store = createPwaInstallStore(browser);
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
      const store = createPwaInstallStore(browser);
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
    const store = createPwaInstallStore(browser);
    assert.equal(store.getSnapshot().isInstalled, true);
    assert.equal(store.getSnapshot().canPrompt, false);
  });

  it('invokes prompt during the click and consumes the event across duplicate requests', async () => {
    const browser = createWindow();
    const store = createPwaInstallStore(browser);
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
    const store = createPwaInstallStore(browser);
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
    const store = createPwaInstallStore(browser);
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
      const store = createPwaInstallStore(browser);
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
