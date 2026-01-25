function stripCountSuffix(value) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function getSignalDetail(suggestion, type) {
  if (!suggestion?.signalsUsed?.length) return '';
  const match = suggestion.signalsUsed.find((signal) => signal?.type === type);
  return typeof match?.detail === 'string' ? match.detail : '';
}

function pickDriftQuery(detail) {
  if (!detail) return '';
  const lines = detail
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const preferredLine = lines.find((line) => line.startsWith('Drift:'))
    || lines.find((line) => line.startsWith('Most read:'))
    || lines.find((line) => line.startsWith('Expected focus:'))
    || lines[0];
  if (!preferredLine) return '';
  const value = preferredLine.split(':').slice(1).join(':').trim();
  return stripCountSuffix(value);
}

export function getCoachSuggestionSearchQuery(suggestion) {
  if (!suggestion) return '';
  const source = suggestion.source;

  if (source === 'badge') {
    return stripCountSuffix(getSignalDetail(suggestion, 'badge'));
  }
  if (source === 'topCard') {
    return stripCountSuffix(getSignalDetail(suggestion, 'topCard'));
  }
  if (source === 'context') {
    return stripCountSuffix(getSignalDetail(suggestion, 'context'));
  }
  if (source === 'theme') {
    return (getSignalDetail(suggestion, 'theme') || suggestion.theme || '').trim();
  }
  if (source === 'drift') {
    return pickDriftQuery(getSignalDetail(suggestion, 'drift'));
  }
  if (source === 'embeddings' || source === 'nextSteps' || source === 'extractedSteps') {
    return (suggestion.theme || suggestion.relatedSteps?.[0] || '').trim();
  }

  return '';
}
