const SERVER_SNAPSHOT = Object.freeze({
  canPrompt: false,
  isIOS: false,
  isInstalled: false,
  isPrompting: false,
  error: null
});

const INSTALL_ERROR = 'Installation could not start. You can add Tableu from your browser menu.';

/** Keep browser eligibility for the app lifetime, independent of route mounts. */
export function createPwaInstallStore(windowLike) {
  const navigator = windowLike?.navigator;
  const userAgent = navigator?.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && navigator?.maxTouchPoints > 1);
  const subscribers = new Set();
  const consumedEvents = new WeakSet();
  let mediaQuery;
  try {
    mediaQuery = windowLike?.matchMedia?.('(display-mode: standalone)');
  } catch {
    // Optional browser APIs must not prevent the application from starting.
  }
  let appInstalled = false;
  let initialized = false;
  let deferredPrompt = null;
  let requestVersion = 0;
  let snapshot = Object.freeze({
    ...SERVER_SNAPSHOT,
    isIOS,
    isInstalled: Boolean(mediaQuery?.matches || navigator?.standalone)
  });

  function update(patch = {}) {
    const next = {
      ...snapshot,
      ...patch
    };
    next.canPrompt = Boolean(deferredPrompt && !next.isInstalled && !next.isIOS && !next.isPrompting);
    if (Object.keys(next).every(key => next[key] === snapshot[key])) return;
    snapshot = Object.freeze(next);
    for (const subscriber of subscribers) subscriber();
  }

  function updateInstalledState() {
    const isInstalled = Boolean(appInstalled || mediaQuery?.matches || navigator?.standalone);
    if (isInstalled) {
      deferredPrompt = null;
      requestVersion += 1;
      update({ isInstalled, isPrompting: false, error: null });
    } else {
      update({ isInstalled });
    }
  }

  function handleBeforeInstallPrompt(event) {
    updateInstalledState();
    if (snapshot.isInstalled || isIOS || typeof event.prompt !== 'function' || consumedEvents.has(event)) return;
    event.preventDefault();
    deferredPrompt = event;
    update({ error: null });
  }

  function initialize() {
    if (initialized || !windowLike?.addEventListener) return;
    initialized = true;
    windowLike.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    windowLike.addEventListener('appinstalled', () => {
      appInstalled = true;
      updateInstalledState();
    });
    if (typeof mediaQuery?.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateInstalledState);
    } else if (typeof mediaQuery?.addListener === 'function') {
      mediaQuery.addListener(updateInstalledState);
    }
    updateInstalledState();
  }

  async function requestInstall() {
    if (!deferredPrompt || snapshot.isInstalled || snapshot.isPrompting || isIOS) return null;
    const event = deferredPrompt;
    const version = ++requestVersion;
    deferredPrompt = null;
    consumedEvents.add(event);
    update({ isPrompting: true, error: null });
    try {
      const userChoice = Promise.resolve(event.userChoice);
      // Handle a rejected choice even when prompt() throws synchronously.
      userChoice.catch(() => {});
      // This call runs before the first await to retain the click's activation.
      const promptResult = event.prompt();
      const [result, choice] = await Promise.all([promptResult, userChoice]);
      if (version === requestVersion) update({ isPrompting: false });
      return choice ?? result ?? null;
    } catch {
      if (version === requestVersion) update({ isPrompting: false, error: INSTALL_ERROR });
      return null;
    }
  }

  return {
    initialize,
    subscribe(subscriber) {
      subscribers.add(subscriber);
      initialize();
      return () => subscribers.delete(subscriber);
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    requestInstall
  };
}

export const pwaInstallStore = createPwaInstallStore(typeof window === 'undefined' ? undefined : window);

/** Register before React renders so early browser events are retained. */
export function initializePwaInstall() {
  pwaInstallStore.initialize();
}
