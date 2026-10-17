import { compilePassageAnnotations } from '../../shared/contracts/generatedPassageAnnotations.js';
import { validatePassageAssociationsPayload } from '../../shared/contracts/readingPassageAssociations.js';
import { getVectorGestureDetails } from '../data/cardGestureArtwork.js';
import { resolveDynamicPassages } from './narrativePassageAligner.js';
import { boundVisualCueLedger } from './narrativeGestureSource.js';

/** A generated document is bound to its exact text and artwork, never to a title. */
export function resolveNarrativePassages({ source, cards = [], artworkEdition } = {}) {
  // A live job will replace these locally derived IDs with accepted ledger
  // IDs. Keep fallback phrases inspectable while it works, but let only the
  // ledger introduce them automatically so late metadata cannot repeat a turn.
  const waitingForVisuals = source?.kind !== 'hydrate' && ['pending', 'running'].includes(source?.visualJobStatus);
  const fallback = () => {
    const resolved = resolveDynamicPassages({ source, cards, artworkEdition });
    return waitingForVisuals ? { ...resolved, associations: resolved.associations.map(cue => ({ ...cue, automatic: false })) } : resolved;
  };
  if (!source?.runId || typeof source.raw !== 'string') return fallback();
  const edition = artworkEdition || cards[0]?.artworkEdition;
  const complete = ['complete', 'completed'].includes(source.status);
  const options = { cards, artworkEdition: edition,
    getSupportedDetails: (name, artwork) => artwork === 'rws-immanuelle-vector' ? getVectorGestureDetails(name) : [],
    userQuestion: source.question || source.userQuestion || '', reflections: source.reflectionsText || source.reflections || '' };
  const ledger = boundVisualCueLedger(source.cueLedger, source);
  let compiled;
  let checked;
  if (ledger && ledger.binding.artworkEdition === edition) {
    // The application ledger already validated cross-batch dependencies. Check
    // its exact analyzed prefix and current display context again at rendering.
    compiled = { errors: [] };
    checked = validatePassageAssociationsPayload({ artworkEdition: edition, expectedRaw: ledger.raw,
      associations: ledger.cues, introductions: ledger.introductions },
    { ...options, rawText: ledger.raw, sourceComplete: true });
  } else {
    const document = source.semanticDocument;
    if (!document || document.artworkEdition !== edition || typeof document.raw !== 'string' || !document.raw.startsWith(source.raw)
      || (complete && document.raw !== source.raw)) return fallback();
    compiled = compilePassageAnnotations(document, options);
    if (!compiled.payload?.associations.length) return fallback();
    checked = validatePassageAssociationsPayload(compiled.payload, { ...options, rawText: source.raw, sourceComplete: complete });
  }
  if (!checked.payload) return fallback();
  // Missing model annotations must not remove another drawn card from the
  // shelf. Only identity is supplemented; no unsubstantiated return is added.
  const introduced = new Set(checked.introductions.map(intro => intro.spreadIndex));
  const missing = cards.some((card, index) => !introduced.has(card.index ?? index)) ? fallback() : null;
  const identityFallback = (missing?.associations || []).filter(cue =>
    cue.targets.every(target => !target.detailIds.length) && cue.targets.some(target => !introduced.has(target.spreadIndex))
    && !checked.associations.some(semantic => cue.passage.start < semantic.passage.end && cue.passage.end > semantic.passage.start));
  const accepted = !ledger && waitingForVisuals
    ? checked.associations.map(cue => ({ ...cue, automatic: false })) : checked.associations;
  return {
    associations: [...accepted, ...identityFallback].sort((a, b) => a.passage.start - b.passage.start)
      .map(cue => ({ ...cue, targets: cue.targets.map(target => ({ ...target, occurrenceId: `${source.runId}:${target.spreadIndex}` })) })),
    introductions: [...checked.introductions, ...(missing?.introductions || []).filter(intro => !introduced.has(intro.spreadIndex))]
      .sort((a, b) => a.start - b.start).map(intro => ({ ...intro, occurrenceId: `${source.runId}:${intro.spreadIndex}` })),
    invalid: [...compiled.errors, ...checked.errors],
    mode: ledger ? 'ledger' : 'generated',
    ...(ledger ? { binding: ledger.binding, ledgerRevision: ledger.ledgerRevision } : {})
  };
}

/** Measure the rendered quote, excluding the interactive wrapper's padding. */
export { measureNarrativePassage } from './narrativeReadingDom.js';
