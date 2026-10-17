const PREFIX = 'app-result:';

export function appJournalResultKey(resultId) {
  return typeof resultId === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(resultId)
    ? `${PREFIX}${resultId}` : null;
}

export function appJournalResultId(key) {
  return typeof key === 'string' && key.startsWith(PREFIX) ? key.slice(PREFIX.length) : null;
}

export function sameJournalReading(left, right) {
  if (left?.readingResultId || right?.readingResultId) {
    return Boolean(left?.readingResultId && left.readingResultId === right?.readingResultId);
  }
  return Boolean(left?.sessionSeed && left.sessionSeed === right?.sessionSeed);
}
