/**
 * The question someone is writing, kept for this browser tab only.
 *
 * A reload, or a phone discarding the backgrounded app, used to wipe the
 * question field. The text is kept in sessionStorage, so it never syncs and it
 * ends with the tab. It is cleared when a signed-in person signs out or the
 * account changes. This is the one exception to the in-memory rule in
 * coachDraft.js.
 */

export const QUESTION_DRAFT_STORAGE_KEY = 'tarot-question-draft';
export const GUEST_DRAFT_OWNER = 'guest';

function getSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    // Some privacy modes throw on access.
    return null;
  }
}

export function getQuestionDraftOwner(userId) {
  return userId ? `user:${userId}` : GUEST_DRAFT_OWNER;
}

/**
 * Returns the saved question for this owner, or ''. A draft written before
 * signing in belongs to the same person, so a guest draft is returned to
 * whoever is present.
 */
export function loadQuestionDraft(owner, storage = getSessionStorage()) {
  if (!storage) return '';
  try {
    const raw = storage.getItem(QUESTION_DRAFT_STORAGE_KEY);
    if (!raw) return '';
    const draft = JSON.parse(raw);
    if (!draft || typeof draft.text !== 'string') return '';
    if (draft.owner !== owner && draft.owner !== GUEST_DRAFT_OWNER) return '';
    return draft.text;
  } catch {
    return '';
  }
}

export function saveQuestionDraft(owner, text, storage = getSessionStorage()) {
  if (!storage) return;
  try {
    if (typeof text !== 'string' || !text.trim()) {
      storage.removeItem(QUESTION_DRAFT_STORAGE_KEY);
      return;
    }
    storage.setItem(QUESTION_DRAFT_STORAGE_KEY, JSON.stringify({ owner, text }));
  } catch {
    // Storage full or blocked: the question still works in memory.
  }
}

export function clearQuestionDraft(storage = getSessionStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(QUESTION_DRAFT_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
