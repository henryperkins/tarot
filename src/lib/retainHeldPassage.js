import { validatePassageAssociationsPayload } from '../../shared/contracts/readingPassageAssociations.js';
import { getVectorGestureDetails } from '../data/cardGestureArtwork.js';

/** Keep the artwork edition with a selected target so an edition change revokes it. */
export function withPassageArtwork(resolved, cards, artworkEdition) {
  return { ...resolved, associations: resolved.associations.map(cue => ({ ...cue,
    targets: cue.targets.map(target => ({ ...target, artworkEdition: cards.find((card, index) =>
      (card.index ?? index) === target.spreadIndex)?.artworkEdition || artworkEdition }))
  })) };
}

/**
 * A late semantic document may replace fallback IDs while the reader is holding
 * a phrase. Keep that exact, still-valid association in both state and prose
 * until release. Nothing is retained across a changed source or artwork.
 */
export function retainHeldPassage({ resolved, state, source, cards, artworkEdition }) {
  const current = state.current;
  if (state.held?.kind !== 'association' || current?.id !== state.held.id
    || source?.runId !== state.runId || source?.sourceRevision !== state.sourceRevision
    || typeof source.raw !== 'string' || !current.passage
    || source.raw.slice(current.passage.start, current.passage.end) !== current.passage.quote) return resolved;
  for (const target of current.targets) {
    const card = cards.find((item, index) => (item.index ?? index) === target.spreadIndex);
    const edition = card?.artworkEdition || artworkEdition;
    if (!card || !target.artworkEdition || target.artworkEdition !== edition
      || target.occurrenceId !== `${source.runId}:${target.spreadIndex}`) return resolved;
  }
  const checked = validatePassageAssociationsPayload({ artworkEdition, associations: [current] }, {
    rawText: source.raw, sourceComplete: false, cards, artworkEdition,
    getSupportedDetails: (name, edition) => edition === 'rws-immanuelle-vector' ? getVectorGestureDetails(name) : [],
    userQuestion: source.question || source.userQuestion || '', reflections: source.reflectionsText || source.reflections || ''
  });
  const validated = checked.associations[0];
  if (!validated || validated.targets.some((target, index) =>
    target.detailIds.join('|') !== current.targets[index].detailIds.join('|'))) return resolved;
  // Revalidate optional personal context without losing the underlying image.
  // Preserve object identity when unchanged so SOURCE reconciliation stays finite.
  const held = current.personalContext && !validated.personalContext
    ? (({ personalContext: _context, ...cue }) => cue)(current) : current;
  const collision = cue => cue.id === held.id
    || (cue.passage.start < held.passage.end && cue.passage.end > held.passage.start);
  if (resolved.associations.includes(held)) return resolved;
  return { ...resolved,
    associations: [...resolved.associations.filter(cue => !collision(cue)), held]
      .sort((a, b) => a.passage.start - b.passage.start)
  };
}
