/**
 * The spread someone chose before drawing, kept for this browser tab only.
 *
 * A drawn reading already carries its spread (lib/readingSnapshot), and the
 * deck and the question being written survive a reload too. Before the draw,
 * a reload or a phone discarding the backgrounded tab used to fall back to the
 * default spread while everything around it looked unchanged, so a reader
 * could draw the wrong spread without noticing. Like the question draft
 * (lib/questionDraft), the choice lives in sessionStorage, never syncs and
 * ends with the tab. A spread name is not personal, so unlike the question it
 * is not tied to an account.
 */
import { SPREADS } from '../data/spreads.js';

export const SPREAD_DRAFT_STORAGE_KEY = 'tarot-spread-draft';

function getSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    // Some privacy modes throw on access.
    return null;
  }
}

/** Returns the spread chosen earlier in this tab, or null. */
export function loadSpreadDraft(storage = getSessionStorage()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SPREAD_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    const spreadKey = draft?.spreadKey;
    // A key from an older build (or a hand edit) that no longer names a spread
    // is ignored rather than mapped to a different spread.
    if (typeof spreadKey !== 'string' || !Object.hasOwn(SPREADS, spreadKey)) return null;
    return spreadKey;
  } catch {
    return null;
  }
}

export function saveSpreadDraft(spreadKey, storage = getSessionStorage()) {
  if (!storage) return;
  try {
    if (typeof spreadKey !== 'string' || !Object.hasOwn(SPREADS, spreadKey)) {
      storage.removeItem(SPREAD_DRAFT_STORAGE_KEY);
      return;
    }
    storage.setItem(SPREAD_DRAFT_STORAGE_KEY, JSON.stringify({ spreadKey }));
  } catch {
    // Storage full or blocked: the choice still works in memory.
  }
}

export function clearSpreadDraft(storage = getSessionStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(SPREAD_DRAFT_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
