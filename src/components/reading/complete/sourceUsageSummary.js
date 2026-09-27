import { sanitizeSourceUsage, USER_INPUT_KEYS, USAGE_REASON_COPY } from '../../../../shared/readingSourceUsage.js';

export const USAGE_BADGE_CLASSES = {
  used: 'border-success bg-success-subtle text-success',
  partial: 'border-warning bg-warning-subtle text-warning',
  omitted: 'border-warning bg-warning-subtle text-warning',
  neutral: 'border-[color:var(--text-muted-high)] bg-surface-muted text-muted-high'
};

const INPUT_LABELS = {
  question: 'question', reflections: 'reflections', cardReflections: 'card notes',
  focusAreas: 'saved focus areas', displayName: 'name', experience: 'tarot experience',
  tone: 'tone', frame: 'interpretive approach', depth: 'reading depth'
};
const BADGE_TEXT = { used: 'Included', partial: 'Partly included', omitted: 'Not included', neutral: 'Not needed' };
const list = values => values.length < 2 ? (values[0] || '')
  : `${values.slice(0, -1).join(', ')}${values.length > 2 ? ',' : ''} and ${values.at(-1)}`;
const reasonCopy = reason => USAGE_REASON_COPY[reason] || USAGE_REASON_COPY.not_used;

function personalInputs(context) {
  if (!context) return [];
  return USER_INPUT_KEYS.flatMap(key => {
    const reason = context.skippedInputs?.[key];
    const fields = Object.entries(context.fields || {}).filter(([name]) => key === 'cardReflections' ? name.startsWith('card-') : name === key)
      .map(([, field]) => field).filter(field => field.originalLength > 0);
    const provided = context[`${key}Provided`] === true || context.providedInputs?.includes(key)
      || context.usedInputs?.includes(key) || Boolean(reason) || fields.length > 0;
    if (!provided) return [];
    // Older snapshots reported Standard depth and deduplicated notes as skipped.
    const represented = (key === 'depth' && reason === 'default_profile')
      || reason === 'deduped_against_card_reflection'
      || fields.some(field => field.representedByDuplicate && field.representedLength > 0);
    const used = fields.length > 0
      ? fields.some(field => field.includedLength > 0 || field.representedLength > 0)
      : context[`${key}Used`] === true || context.usedInputs?.includes(key) || represented;
    const shortened = fields.some(field => field.budgetTruncated || field.limitApplied);
    const omitted = fields.some(field => field.omitted && !field.representedByDuplicate);
    const attention = shortened || omitted || (!used && reason !== 'current_context_priority');
    return [{ key, label: INPUT_LABELS[key], used, shortened, attention, reason }];
  });
}

export function formatUsageSummary(rawUsage) {
  const sourceUsage = sanitizeSourceUsage(rawUsage);
  const rows = [];
  const included = [];
  if (sourceUsage?.spreadCards?.used) included.push('your cards');
  const addRow = (label, state, detail, group, summaryLabel) => {
    rows.push({ label, state, badgeText: BADGE_TEXT[state], detail, group });
    if (state === 'used' || state === 'partial') included.push(summaryLabel);
  };

  const inputs = personalInputs(sourceUsage?.userContext);
  for (const group of [
    { keys: ['question', 'reflections', 'cardReflections'], label: 'Your question & notes', summary: 'your question and notes' },
    { keys: ['focusAreas', 'displayName', 'experience', 'tone', 'frame', 'depth'], label: 'Your preferences', summary: 'reading preferences' }
  ]) {
    const members = inputs.filter(input => group.keys.includes(input.key));
    if (!members.length) continue;
    const used = members.filter(input => input.used);
    const attention = members.some(input => input.attention);
    const details = [];
    if (used.length) details.push(`Included: ${list(used.map(input => input.label))}.`);
    const shortened = members.filter(input => input.shortened && input.used);
    if (shortened.length) details.push(`Shortened: ${list(shortened.map(input => input.label))}.`);
    for (const input of members.filter(input => !input.used)) {
      details.push(`${input.label[0].toUpperCase()}${input.label.slice(1)}: ${reasonCopy(input.reason)}`);
    }
    // A subset of card notes may be missing while other notes survived.
    if (members.some(input => input.used && input.attention && !input.shortened)) details.push('Some notes could not be included.');
    const personalSummary = used.some(input => input.key === 'question')
      ? (used.length > 1 ? 'your question and notes' : 'your question')
      : 'your notes';
    addRow(group.label, attention ? (used.length ? 'partial' : 'omitted') : (used.length ? 'used' : 'neutral'), details.join(' '), 'you', group.keys.includes('question') ? personalSummary : group.summary);
  }

  const vision = sourceUsage?.vision;
  if (vision && (vision.requested || vision.used)) {
    const diagnosticsOnly = vision.diagnosticsIncluded && vision.cardCuesUsed === false && vision.evidencePacketsUsed === 0;
    const used = vision.used && !diagnosticsOnly;
    const omitted = vision.telemetryOnlyUploads || 0;
    const partial = used && omitted > 0;
    const detail = used
      ? `Visual details from your uploaded images.${partial ? ` ${omitted} image${omitted === 1 ? '' : 's'} could not be included.` : ''}`
      : reasonCopy(diagnosticsOnly ? 'no_usable_evidence' : vision.skippedReason);
    addRow('Uploaded images', partial ? 'partial' : used ? 'used' : 'omitted', detail, 'you', 'uploaded images');
  }

  const graph = sourceUsage?.graphRAG;
  if (graph?.used) {
    const count = graph.passagesUsedInPrompt || 0;
    const detail = graph.mode === 'summary' || count === 0
      ? 'Card patterns and their traditional meanings.'
      : `${count} reference passage${count === 1 ? '' : 's'} on the cards and their patterns.`;
    addRow('Traditional wisdom', 'used', detail, 'sources', 'traditional wisdom');
  }
  if (sourceUsage?.ephemeris?.used) addRow('Astrological context', 'used', 'Lunar and planetary positions at the time of the reading.', 'sources', 'astrological context');
  if (sourceUsage?.forecast?.used) addRow('Timing outlook', 'used', 'Upcoming lunar and planetary events.', 'sources', 'a timing outlook');

  const summaryParts = included.length > 3 ? [...included.slice(0, 2), `${included.length - 2} other sources`] : included;
  return {
    rows,
    summaryText: included.length ? `Prepared with ${list(summaryParts)}.` : 'Details about the inputs provided for this reading.',
    summary: {
      used: included.length,
      attention: rows.filter(row => row.state === 'partial' || row.state === 'omitted').length
    }
  };
}
