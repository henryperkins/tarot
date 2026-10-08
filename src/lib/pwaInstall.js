import { safeStorage } from './safeStorage.js';

export const PWA_INSTALL_PREFERENCES_KEY = 'tableu-pwa-install-preferences';
export const PWA_GUIDANCE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const EMPTY_GUIDANCE_PREFERENCES = Object.freeze({ hasAddedToHomeScreen: false, snoozedUntil: 0 });
const SERVER_SNAPSHOT = Object.freeze({
  canPrompt: false,
  isIOS: false,
  isInstalled: false,
  isPrompting: false,
  error: null,
  isSnoozed: false,
  hasAddedToHomeScreen: false,
  snoozedUntil: 0
});

const INSTALL_ERROR = 'Installation could not start. You can add Tableu from your browser menu.';

export function shouldShowPwaInstall({ isInstalled, isIOS, canPrompt, isPrompting, isSnoozed, hasAddedToHomeScreen }) {
  return !isInstalled && (isIOS ? !isSnoozed && !hasAddedToHomeScreen : Boolean(canPrompt || isPrompting));
}

/** Keep browser eligibility for the app lifetime, independent of route mounts. */
export function createPwaInstallStore(windowLike, { storage = safeStorage, now = Date.now } = {}) {
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
  let hostCount = 0;
  let expiryTimer = null;
  let sessionGuidanceChoice = null;
  let storedGuidancePreferences = readGuidancePreferences() || EMPTY_GUIDANCE_PREFERENCES;
  let snapshot = Object.freeze({
    ...SERVER_SNAPSHOT,
    isIOS,
    isInstalled: Boolean(mediaQuery?.matches || navigator?.standalone),
    ...guidanceSnapshot()
  });

  function readGuidancePreferences() {
    try {
      if (!storage?.getItem || storage.isAvailable === false) return null;
      const raw = storage.getItem(PWA_INSTALL_PREFERENCES_KEY);
      if (!raw) return EMPTY_GUIDANCE_PREFERENCES;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1) return EMPTY_GUIDANCE_PREFERENCES;
      return {
        hasAddedToHomeScreen: parsed.hasAddedToHomeScreen === true,
        snoozedUntil: Number.isSafeInteger(parsed.snoozedUntil) && parsed.snoozedUntil > 0 ? parsed.snoozedUntil : 0
      };
    } catch {
      // Storage can be denied, or an old/corrupt record may not be readable.
      return null;
    }
  }

  function effectiveGuidancePreferences() {
    if (!sessionGuidanceChoice) return storedGuidancePreferences;
    return {
      hasAddedToHomeScreen: sessionGuidanceChoice.hasAddedToHomeScreen || storedGuidancePreferences.hasAddedToHomeScreen,
      snoozedUntil: Math.max(sessionGuidanceChoice.snoozedUntil, storedGuidancePreferences.snoozedUntil)
    };
  }

  function guidanceSnapshot() {
    const preferences = effectiveGuidancePreferences();
    return { ...preferences, isSnoozed: preferences.snoozedUntil > now() };
  }

  function scheduleGuidanceExpiry() {
    if (expiryTimer !== null) windowLike?.clearTimeout?.(expiryTimer);
    expiryTimer = null;
    const remaining = snapshot.snoozedUntil - now();
    if (!isIOS || snapshot.hasAddedToHomeScreen || remaining <= 0 || !windowLike?.setTimeout) return;
    expiryTimer = windowLike.setTimeout(refreshGuidancePreferences, Math.min(remaining, 2147483647));
  }

  function refreshGuidancePreferences() {
    const persisted = readGuidancePreferences();
    if (persisted) storedGuidancePreferences = persisted;
    update(guidanceSnapshot());
    scheduleGuidanceExpiry();
  }

  function writeGuidancePreferences(preferences) {
    const serialized = JSON.stringify({ version: 1, ...preferences });
    let persisted = false;
    try {
      if (storage?.setItem && storage?.getItem && storage.isAvailable !== false) {
        storage.setItem(PWA_INSTALL_PREFERENCES_KEY, serialized);
        // The shared storage wrapper absorbs privacy/quota errors. A successful
        // write must be read back exactly before claiming the choice is saved.
        persisted = storage.getItem(PWA_INSTALL_PREFERENCES_KEY) === serialized;
      }
    } catch {
      // Always honor the choice for this session, including denied storage.
    }
    storedGuidancePreferences = preferences;
    sessionGuidanceChoice = persisted ? null : preferences;
    return { persisted };
  }

  function saveGuidancePreferences(preferences) {
    const result = writeGuidancePreferences(preferences);
    update(guidanceSnapshot());
    scheduleGuidanceExpiry();
    return result;
  }

  function snoozeGuidance() {
    if (!isIOS) return { persisted: false };
    return saveGuidancePreferences({
      ...effectiveGuidancePreferences(),
      snoozedUntil: now() + PWA_GUIDANCE_SNOOZE_MS
    });
  }

  function dismissGuidance() {
    if (!isIOS) return { persisted: false };
    return saveGuidancePreferences({ hasAddedToHomeScreen: true, snoozedUntil: 0 });
  }

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
      if (!effectiveGuidancePreferences().hasAddedToHomeScreen) {
        writeGuidancePreferences({ hasAddedToHomeScreen: true, snoozedUntil: 0 });
      }
      update({ isInstalled, isPrompting: false, error: null, ...guidanceSnapshot() });
    } else {
      update({ isInstalled });
    }
  }

  function handleBeforeInstallPrompt(event) {
    updateInstalledState();
    if (hostCount === 0 || snapshot.isInstalled || isIOS || typeof event.prompt !== 'function' || consumedEvents.has(event)) return;
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
    windowLike.addEventListener('focus', refreshGuidancePreferences);
    windowLike.addEventListener('pageshow', refreshGuidancePreferences);
    windowLike.addEventListener('storage', event => {
      if (event.key === null || event.key === PWA_INSTALL_PREFERENCES_KEY) refreshGuidancePreferences();
    });
    if (typeof mediaQuery?.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateInstalledState);
    } else if (typeof mediaQuery?.addListener === 'function') {
      mediaQuery.addListener(updateInstalledState);
    }
    updateInstalledState();
    scheduleGuidanceExpiry();
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
    registerHost() {
      hostCount += 1;
      initialize();
      let registered = true;
      return () => {
        if (!registered) return;
        registered = false;
        hostCount -= 1;
      };
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      initialize();
      refreshGuidancePreferences();
      return () => subscribers.delete(subscriber);
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    requestInstall,
    snoozeGuidance,
    dismissGuidance
  };
}

export const pwaInstallStore = createPwaInstallStore(typeof window === 'undefined' ? undefined : window);

/** Observe state before React renders; unhosted offers remain with the browser. */
export function initializePwaInstall() {
  pwaInstallStore.initialize();
}
