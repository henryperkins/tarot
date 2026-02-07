const COMMON_ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'mt',
  'no',
  'vs',
  'etc',
  'dept',
  'fig'
]);

export const STREAM_NARRATION_MIN_WORDS = 18;
export const STREAM_NARRATION_MIN_CHARS = 120;
export const STREAM_NARRATION_TARGET_CHARS = 220;
export const STREAM_NARRATION_MAX_CHARS = 300;

export const STREAM_AUTO_NARRATE_DEBOUNCE_MS = 700;
export const STREAM_AUTO_NARRATE_MIN_WORDS = 32;

export function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isNarrationPlaybackBusy(status) {
  return status === 'playing' || status === 'paused' || status === 'loading' || status === 'synthesizing';
}

function isLikelyAbbreviationAt(text, punctuationIndex) {
  if (!text || text[punctuationIndex] !== '.') return false;

  const tail = text.slice(Math.max(0, punctuationIndex - 20), punctuationIndex + 1);
  const tokenMatch = tail.match(/([A-Za-z]+)\.$/);
  const token = tokenMatch?.[1]?.toLowerCase() || '';
  if (token && COMMON_ABBREVIATIONS.has(token)) {
    return true;
  }

  if (/\b(?:e\.g|i\.e|a\.m|p\.m)\.$/i.test(tail)) {
    return true;
  }

  if (/\b(?:[A-Za-z]\.){2,}$/.test(tail)) {
    return true;
  }

  if (/\b[A-Z]\.$/.test(tail)) {
    return true;
  }

  return false;
}

export function findNarrationBreakIndex(text, maxIndex, { minChars = STREAM_NARRATION_MIN_CHARS } = {}) {
  if (!text || typeof text !== 'string') return 0;
  const safeMaxIndex = Number.isFinite(maxIndex)
    ? Math.max(1, Math.min(text.length, Math.floor(maxIndex)))
    : text.length;
  const slice = text.slice(0, safeMaxIndex);
  const safeMinChars = Math.max(0, Math.min(safeMaxIndex, minChars));

  let strongBreak = -1;
  const strongRegex = /([.!?]["')\]]?)(?=\s|$)/g;
  for (const match of slice.matchAll(strongRegex)) {
    const punctuationIndex = match.index ?? -1;
    if (punctuationIndex < 0) continue;
    if (slice[punctuationIndex] === '.' && isLikelyAbbreviationAt(slice, punctuationIndex)) {
      continue;
    }
    const endIndex = punctuationIndex + match[1].length;
    if (endIndex >= safeMinChars) {
      strongBreak = endIndex;
    }
  }
  if (strongBreak > 0) {
    return strongBreak;
  }

  let softBreak = -1;
  const softRegex = /([,;:]["')\]]?)(?=\s|$)/g;
  for (const match of slice.matchAll(softRegex)) {
    const punctuationIndex = match.index ?? -1;
    if (punctuationIndex < 0) continue;
    const endIndex = punctuationIndex + match[1].length;
    if (endIndex >= safeMinChars) {
      softBreak = endIndex;
    }
  }
  if (softBreak > 0) {
    return softBreak;
  }

  const newlineIndex = slice.lastIndexOf('\n');
  if (newlineIndex >= safeMinChars) {
    return newlineIndex + 1;
  }

  const whitespaceIndex = slice.lastIndexOf(' ');
  if (whitespaceIndex >= safeMinChars) {
    return whitespaceIndex;
  }

  return Math.min(text.length, safeMaxIndex);
}

export function shouldFlushNarrationBuffer({
  buffer,
  force = false,
  narrationStarted = false,
  minWords = STREAM_NARRATION_MIN_WORDS,
  minChars = STREAM_NARRATION_MIN_CHARS,
  targetChars = STREAM_NARRATION_TARGET_CHARS,
  maxChars = STREAM_NARRATION_MAX_CHARS
}) {
  if (!buffer || typeof buffer !== 'string') return false;
  if (!buffer.trim()) return false;

  const wordCount = countWords(buffer);
  if (!force && !narrationStarted && wordCount < minWords) {
    return false;
  }

  const atMin = buffer.length >= minChars;
  const atTarget = buffer.length >= targetChars;
  const atMax = buffer.length >= maxChars;
  const hasStrongPause = /[.!?]["')\]]?\s*$/.test(buffer);
  const hasSoftPause = /[,;:]["')\]]?\s*$/.test(buffer) || /\n\s*$/.test(buffer);

  if (force || atMax) return true;
  if (atTarget && (hasStrongPause || hasSoftPause)) return true;

  // Start first narration segment earlier when a natural sentence stop arrives.
  if (!narrationStarted && atMin && hasStrongPause) return true;

  return false;
}

export function shouldScheduleAutoNarration({
  voiceOn,
  autoNarrate,
  isReadingStreaming,
  isPersonalReadingError,
  autoNarrationTriggered,
  narrativeText,
  ttsProvider,
  ttsStatus,
  minWords = STREAM_AUTO_NARRATE_MIN_WORDS
}) {
  const hasNarrationText = typeof narrativeText === 'string' && narrativeText.trim().length > 0;
  if (!hasNarrationText) return false;

  if (!voiceOn || !autoNarrate || !isReadingStreaming || isPersonalReadingError || autoNarrationTriggered) {
    return false;
  }

  if (ttsProvider === 'azure') {
    return false;
  }

  if (isNarrationPlaybackBusy(ttsStatus)) {
    return false;
  }

  return countWords(narrativeText) >= minWords;
}
