export const NARRATIVE_FOCUS_TARGET_ID = 'personalized-narrative-title';

let narrativeFocusTarget = null;
const listeners = new Set();

export function getNarrativeFocusTarget() {
  return narrativeFocusTarget?.isConnected ? narrativeFocusTarget : null;
}

export function getServerNarrativeFocusTarget() {
  return null;
}

export function subscribeNarrativeFocusTarget(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// React 19 runs this stable ref's cleanup on unmount, including StrictMode's
// mount/cleanup cycle. A leaving scene must not clear a newer scene's target.
export function registerNarrativeFocusTarget(node) {
  narrativeFocusTarget = node;
  listeners.forEach((listener) => listener());
  return () => {
    if (narrativeFocusTarget !== node) return;
    narrativeFocusTarget = null;
    listeners.forEach((listener) => listener());
  };
}
