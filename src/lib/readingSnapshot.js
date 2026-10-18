/**
 * The reading in progress, kept for this browser tab only.
 *
 * Phones reload a backgrounded tab, pull-to-refresh reloads the page, and
 * social sign-in leaves it. Each used to discard the drawn spread, the
 * person's reflections and an unsaved reading, keeping only the question
 * (questionDraft.js). The snapshot lives in sessionStorage, so it never syncs
 * and ends with the tab, and it follows the question draft's owner rules: a
 * guest snapshot carries into a sign-in; another account's snapshot is never
 * restored.
 *
 * A reading that was still being written is not stored here. Its cards,
 * question and reflections are, which lets ReadingContext reattach to the
 * server job it checkpointed under `tarot:reading-job`.
 */

import { GUEST_DRAFT_OWNER } from './questionDraft.js';
import { getKnownDeckStyleId, getSnapshotDeckStyleId } from './readingDeck.js';

export const READING_SNAPSHOT_STORAGE_KEY = 'tarot:reading-snapshot';
export const READING_SNAPSHOT_VERSION = 1;
export const READING_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Analysis payloads can be large; never let them crowd out the reading itself.
const MAX_SNAPSHOT_CHARS = 400_000;
const MAX_CARDS = 20;

function getSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    // Some privacy modes throw on access.
    return null;
  }
}

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isIndex = value => Number.isInteger(value) && value >= 0 && value < MAX_CARDS;

function toCards(reading) {
  if (!Array.isArray(reading) || reading.length === 0 || reading.length > MAX_CARDS) return null;
  if (!reading.every(card => isPlainObject(card) && typeof card.name === 'string' && card.name)) return null;
  return reading;
}

function toReflections(reflections) {
  if (!isPlainObject(reflections)) return {};
  return Object.fromEntries(Object.entries(reflections)
    .filter(([, text]) => typeof text === 'string' && text.length > 0));
}

/**
 * Builds the snapshot for the current reading, or null when there is nothing
 * worth restoring (no cards drawn yet).
 */
export function buildReadingSnapshot({
  owner,
  spreadKey,
  hasUserSelectedSpread = false,
  reading,
  drawIncludeMinors = null,
  drawDeckStyleId = null,
  isSpreadDealt = false,
  revealedCards,
  dealIndex = 0,
  hasConfirmedSpread = false,
  sessionSeed = null,
  ritual = {},
  question = '',
  reflections,
  narrative = null,
  analysis = null,
  now = Date.now()
}) {
  const cards = toCards(reading);
  if (!cards || typeof spreadKey !== 'string' || !spreadKey) return null;
  const revealed = [...(revealedCards || [])].filter(isIndex).filter(index => index < cards.length);
  const snapshot = {
    v: READING_SNAPSHOT_VERSION,
    savedAt: now,
    owner: typeof owner === 'string' && owner ? owner : GUEST_DRAFT_OWNER,
    spreadKey,
    hasUserSelectedSpread: Boolean(hasUserSelectedSpread),
    reading: cards,
    drawIncludeMinors: typeof drawIncludeMinors === 'boolean' ? drawIncludeMinors : null,
    drawDeckStyleId: getKnownDeckStyleId(drawDeckStyleId),
    isSpreadDealt: Boolean(isSpreadDealt),
    revealed,
    dealIndex: Number.isInteger(dealIndex) && dealIndex >= 0 ? dealIndex : 0,
    hasConfirmedSpread: Boolean(hasConfirmedSpread),
    sessionSeed: sessionSeed ?? null,
    ritual: {
      hasKnocked: Boolean(ritual.hasKnocked),
      knockCount: Number.isInteger(ritual.knockCount) ? Math.min(Math.max(ritual.knockCount, 0), 3) : 0,
      hasCut: Boolean(ritual.hasCut),
      cutIndex: Number.isInteger(ritual.cutIndex) ? ritual.cutIndex : null,
      knockTimes: Array.isArray(ritual.knockTimes)
        ? ritual.knockTimes.filter(time => Number.isFinite(time)).slice(-3)
        : []
    },
    question: typeof question === 'string' ? question : '',
    reflections: toReflections(reflections),
    narrative: narrative && typeof narrative.raw === 'string' && narrative.raw.trim()
      ? {
        raw: narrative.raw,
        provider: typeof narrative.provider === 'string' ? narrative.provider : null,
        requestId: typeof narrative.requestId === 'string' ? narrative.requestId : null
      }
      : null,
    analysis: isPlainObject(analysis) ? analysis : null
  };
  return snapshot;
}

/** Whether a snapshot may be shown to `owner`; a guest snapshot follows its person into a sign-in. */
export function snapshotBelongsTo(snapshot, owner) {
  if (!snapshot) return false;
  return snapshot.owner === owner || snapshot.owner === GUEST_DRAFT_OWNER;
}

function isValidSnapshot(snapshot, now) {
  if (!isPlainObject(snapshot) || snapshot.v !== READING_SNAPSHOT_VERSION) return false;
  if (!Number.isFinite(snapshot.savedAt) || now - snapshot.savedAt > READING_SNAPSHOT_MAX_AGE_MS || snapshot.savedAt - now > 60_000) return false;
  if (typeof snapshot.owner !== 'string' || typeof snapshot.spreadKey !== 'string' || !snapshot.spreadKey) return false;
  if (!toCards(snapshot.reading)) return false;
  if (!Array.isArray(snapshot.revealed) || !snapshot.revealed.every(isIndex)) return false;
  if (!isPlainObject(snapshot.ritual) || !isPlainObject(snapshot.reflections)) return false;
  if (snapshot.narrative !== null && (!isPlainObject(snapshot.narrative) || typeof snapshot.narrative.raw !== 'string')) return false;
  if (snapshot.analysis !== null && !isPlainObject(snapshot.analysis)) return false;
  return true;
}

/** Returns the stored snapshot, or null when missing, stale, malformed or (given an owner) not theirs. */
export function loadReadingSnapshot({ owner = null, storage = getSessionStorage(), now = Date.now() } = {}) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(READING_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (!isValidSnapshot(snapshot, now)) {
      storage.removeItem(READING_SNAPSHOT_STORAGE_KEY);
      return null;
    }
    if (owner && !snapshotBelongsTo(snapshot, owner)) return null;
    return { ...snapshot,
      drawIncludeMinors: typeof snapshot.drawIncludeMinors === 'boolean' ? snapshot.drawIncludeMinors : null,
      drawDeckStyleId: getSnapshotDeckStyleId(snapshot) };
  } catch {
    return null;
  }
}

export function saveReadingSnapshot(snapshot, { storage = getSessionStorage() } = {}) {
  if (!storage) return;
  try {
    if (!snapshot) {
      storage.removeItem(READING_SNAPSHOT_STORAGE_KEY);
      return;
    }
    let serialized = JSON.stringify(snapshot);
    if (serialized.length > MAX_SNAPSHOT_CHARS && snapshot.analysis) {
      serialized = JSON.stringify({ ...snapshot, analysis: null });
    }
    if (serialized.length > MAX_SNAPSHOT_CHARS) return;
    storage.setItem(READING_SNAPSHOT_STORAGE_KEY, serialized);
  } catch {
    // Storage full or blocked: the reading still works in memory.
  }
}

export function clearReadingSnapshot({ storage = getSessionStorage() } = {}) {
  if (!storage) return;
  try {
    storage.removeItem(READING_SNAPSHOT_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
