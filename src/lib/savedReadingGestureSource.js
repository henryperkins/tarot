import { createGestureSource } from './narrativeGestureSource.js';

// This is local presentation identity, never proof of server ownership.
function contextIdentity(entry) {
  return JSON.stringify({ id: entry?.id, deckId: entry?.deckId,
    question: entry?.question ?? entry?.userQuestion ?? '',
    reflections: entry?.reflections ?? entry?.reflectionsText ?? null,
    cards: (Array.isArray(entry?.cards) ? entry.cards : []).map(card => ({
      name: card?.name, canonicalName: card?.canonicalName, card: card?.card,
      position: card?.position, orientation: card?.orientation, isReversed: card?.isReversed,
      userReflection: card?.userReflection, reflection: card?.reflection
    })) });
}

/** Hydrate saved prose without manufacturing model-result ownership. A saved
 * document is immutable for inspection: even an appended edit clears its holds.
 * `restored` is the public, validated projection from hydrateEntryVisuals. */
export function reconcileSavedGestureSource({ previous, entry, restored, fallbackRunId }) {
  const raw = typeof entry?.personalReading === 'string' ? entry.personalReading : '';
  const context = contextIdentity(entry);
  const sameOwner = previous?.savedSource?.fallbackRunId === fallbackRunId;
  const changed = sameOwner && (previous.raw !== raw || previous.savedSource.context !== context);
  const bindingKey = restored?.binding ? JSON.stringify(restored.binding) : null;
  const retired = sameOwner ? [...previous.savedSource.retiredBindings] : [];
  if (changed && previous.savedSource.bindingKey && !retired.includes(previous.savedSource.bindingKey)) {
    retired.push(previous.savedSource.bindingKey);
  }
  // Validate again at the presentation boundary, including the independent ID
  // and exact raw prefix. A mismatched ledger cannot select an artwork edition.
  const cached = createGestureSource({ runId: restored?.readingResultId, raw, status: 'complete',
    sourceRevision: restored?.binding?.sourceRevision, visualBinding: restored?.binding,
    cueLedger: restored?.snapshot });
  const acceptsCached = cached.visualBinding && (!restored?.snapshot || cached.cueLedger)
    && !retired.includes(bindingKey);
  const source = acceptsCached ? cached : createGestureSource({ runId: fallbackRunId, raw,
    status: 'complete', sourceRevision: sameOwner ? previous.sourceRevision + (changed ? 1 : 0) : 0 });
  const next = { ...source, savedSource: { fallbackRunId, context, retiredBindings: retired,
    bindingKey: bindingKey || (sameOwner ? previous.savedSource.bindingKey : null) } };
  return sameOwner && JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
}
