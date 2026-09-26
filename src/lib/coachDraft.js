/**
 * Unfinished Guided Intention Coach sessions.
 *
 * The coach unmounts whenever it closes, so a swipe, Escape, or backdrop tap
 * used to discard every choice the user had made. The last unfinished session
 * is kept here and restored on the next open; applying a question clears it.
 *
 * Drafts live in memory only: a reload starts fresh, and nothing about the
 * user's intention is written to storage without an explicit save.
 */

export const COACH_DRAFT_TTL_MS = 30 * 60 * 1000;

const SESSION_FIELDS = [
  'step',
  'topic',
  'timeframe',
  'depth',
  'customFocus',
  'useCreative',
  'remixCount',
  'autoQuestionEnabled',
  'prefillSource'
];

const drafts = new Map();

/**
 * An untouched session is not a draft: saving it would pin the opening state
 * (a journal recommendation, last-used settings) over whatever the next open
 * would have shown.
 */
export function isUnchangedCoachSession(session, opening) {
  if (!session || !opening) return false;
  if (SESSION_FIELDS.some(field => session[field] !== opening[field])) return false;
  // In automatic mode the question text is generated, not written by the user.
  return Boolean(session.autoQuestionEnabled) || session.questionText === opening.questionText;
}

function draftKey(userId) {
  return userId ? `user:${userId}` : 'anon';
}

export function saveCoachDraft(userId, draft, now = Date.now()) {
  if (!draft || typeof draft !== 'object') return;
  drafts.set(draftKey(userId), { ...draft, savedAt: now });
}

export function loadCoachDraft(userId, now = Date.now()) {
  const key = draftKey(userId);
  const draft = drafts.get(key);
  if (!draft) return null;
  if (now - draft.savedAt > COACH_DRAFT_TTL_MS) {
    drafts.delete(key);
    return null;
  }
  const { savedAt: _savedAt, ...rest } = draft;
  return rest;
}

export function clearCoachDraft(userId) {
  drafts.delete(draftKey(userId));
}
