import { useSyncExternalStore } from 'react';
import { pwaInstallStore } from '../lib/pwaInstall';

export function usePwaInstall() {
  const snapshot = useSyncExternalStore(
    pwaInstallStore.subscribe,
    pwaInstallStore.getSnapshot,
    pwaInstallStore.getServerSnapshot
  );
  return {
    ...snapshot,
    requestInstall: pwaInstallStore.requestInstall,
    snoozeGuidance: pwaInstallStore.snoozeGuidance,
    dismissGuidance: pwaInstallStore.dismissGuidance
  };
}
