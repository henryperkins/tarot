const JOURNEY_LABELS = Object.freeze({
  initiation: 'Initiation (0–7)',
  integration: 'Integration (8–14)',
  culmination: 'Culmination (15–21)'
});

/**
 * Summarize distinct, registry-backed projected candidates by patternKey.
 * Emits only fixed family labels and validated Fool's Journey stage labels.
 *
 * @param {Array<Object>} candidates
 * @returns {{ segments: string[], counts: Record<string, number>, foolsJourneyStage: string|null }}
 */
export function summarizeProjectedPatterns(candidates = []) {
  const safeCandidates = Array.isArray(candidates)
    ? candidates.filter((candidate) => candidate && typeof candidate === 'object' && typeof candidate.patternKey === 'string')
    : [];
  const patterns = [...new Map(safeCandidates.map((candidate) => [candidate.patternKey, candidate])).values()];

  const counts = {
    completeTriads: patterns.filter((p) => p.type === 'triad' && !p.isPartialPattern).length,
    partialTriads: patterns.filter((p) => p.type === 'triad' && p.isPartialPattern).length,
    highDyads: patterns.filter((p) => p.type === 'dyad' && p.priority === 3).length,
    mediumHighDyads: patterns.filter((p) => p.type === 'dyad' && p.priority === 4).length,
    mediumDyads: patterns.filter((p) => p.type === 'dyad' && p.priority === 5).length,
    courtLineages: patterns.filter((p) => p.type === 'court-lineage').length,
    strongSuitProgressions: patterns.filter((p) => p.type === 'suit-progression' && p.priority === 4).length,
    emergingSuitProgressions: patterns.filter((p) => p.type === 'suit-progression' && p.priority === 5).length,
    majorArcana: patterns.filter((p) => p.type === 'major-arcana').length,
    thothSuitPatterns: patterns.filter((p) => p.type === 'thoth-suit').length,
    marseilleNumerologyPatterns: patterns.filter((p) => p.type === 'marseille-numerology').length
  };

  const segments = [];
  const pushCount = (value, label) => {
    if (value > 0) {
      segments.push(`${value} ${label}`);
    }
  };

  pushCount(counts.completeTriads, 'complete triad(s)');
  pushCount(counts.partialTriads, 'partial triad(s)');
  pushCount(counts.highDyads, 'high-significance dyad(s)');
  pushCount(counts.mediumHighDyads, 'medium-high-significance dyad(s)');
  pushCount(counts.mediumDyads, 'medium-significance dyad(s)');
  pushCount(counts.courtLineages, 'court lineage(s)');
  pushCount(counts.strongSuitProgressions, 'strong suit progression(s)');
  pushCount(counts.emergingSuitProgressions, 'emerging suit progression(s)');
  pushCount(counts.majorArcana, 'Major Arcana archetype(s)');
  pushCount(counts.thothSuitPatterns, 'Thoth suit pattern(s)');
  pushCount(counts.marseilleNumerologyPatterns, 'Marseille numerology pattern(s)');

  const journey = patterns.find(
    (pattern) => pattern.type === 'fools-journey' && Object.hasOwn(JOURNEY_LABELS, pattern.patternId)
  );
  if (journey) {
    segments.push(`Fool's Journey Stage: ${JOURNEY_LABELS[journey.patternId]}`);
  }

  return {
    segments,
    counts,
    foolsJourneyStage: journey ? journey.patternId : null
  };
}
