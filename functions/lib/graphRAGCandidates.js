import { getPassagesForPattern } from './knowledgeBase.js';
import { projectPassageForDeck } from './graphRAGProjection.js';

const CONTEXT_ALIASES = {
  grief: ['grief', 'loss', 'mourning', 'bereavement'],
  relationship: ['relationship', 'relationships', 'romantic', 'romance', 'love', 'partnership', 'marriage', 'dating'],
  career: ['career', 'work', 'job', 'professional', 'business', 'leadership'],
  health: ['health', 'healing', 'wellbeing', 'wellness', 'therapy', 'recovery', 'self-care'],
  spiritual: ['spiritual', 'spirit', 'soul', 'intuition', 'mystic', 'divine', 'ritual', 'meditation'],
  transition: ['transition', 'change', 'shift', 'crossroads', 'ending', 'beginning', 'threshold'],
  shadow: ['shadow', 'trauma', 'addiction', 'compulsion', 'habit', 'inner child', 'subconscious']
};

export function passageContextMatch(passage, questionContext = '') {
  const context = typeof questionContext === 'string' ? questionContext.trim().toLowerCase() : '';
  const candidates = CONTEXT_ALIASES[context] || Object.values(CONTEXT_ALIASES).find((values) => values.includes(context)) || [context];
  const passageContext = passage.context || 'general';
  return candidates.includes(passageContext) ? 2 : passageContext === 'general' ? 1 : 0;
}

export function isValidPassageLimit(limit) {
  return Number.isInteger(limit) && limit > 0;
}

function withStats(passages, stats) {
  Object.defineProperty(passages, 'retrievalStats', { value: stats });
  return passages;
}

/** Enumerate all variants once; this is the single dispatch for pattern families. */
export function collectPassageCandidates(graphKeys, { deckStyle = 'rws-1909', includeMetadata = false } = {}) {
  const candidates = [];
  const stats = { candidatesDiscovered: 0, candidatesProjected: 0, projectionRejected: 0 };
  if (!graphKeys || typeof graphKeys !== 'object') return withStats(candidates, stats);
  const identities = new Set();
  const add = (type, patternId, priority, extra = {}, metadata = {}, entry = getPassagesForPattern(type, patternId)) => {
    for (const passage of entry?.passages || []) {
      const identity = JSON.stringify([type, String(patternId), passage.context || 'general']);
      if (identities.has(identity)) continue;
      identities.add(identity);
      stats.candidatesDiscovered += 1;
      const projected = projectPassageForDeck({
        ...passage, type, patternId: String(patternId), priority,
        title: entry.title, theme: entry.theme, ...extra,
        ...(includeMetadata ? { metadata } : {})
      }, deckStyle);
      if (!projected) { stats.projectionRejected += 1; continue; }
      candidates.push(projected);
    }
  };
  const complete = new Set(Array.isArray(graphKeys.completeTriadIds) ? graphKeys.completeTriadIds : []);
  for (const id of complete) add('triad', id, 1, {}, { triadId: id, isComplete: true });
  const single = Number.isInteger(graphKeys.singleMajorNumber) && graphKeys.totalMajors === 1;
  if (single) add('major-arcana', graphKeys.singleMajorNumber, 2, { cardNumber: graphKeys.singleMajorNumber, cardName: graphKeys.singleMajorName || getPassagesForPattern('major-arcana', graphKeys.singleMajorNumber)?.title }, { cardNumber: graphKeys.singleMajorNumber });
  if (graphKeys.foolsJourneyStageKey) {
    const entry = getPassagesForPattern('fools-journey', graphKeys.foolsJourneyStageKey);
    add('fools-journey', graphKeys.foolsJourneyStageKey, single ? 3 : 2, { stage: entry?.stage }, { stageKey: graphKeys.foolsJourneyStageKey }, entry);
  }
  for (const dyad of Array.isArray(graphKeys.dyadPairs) ? graphKeys.dyadPairs : []) {
    const priority = { high: 3, 'medium-high': 4, medium: 5 }[dyad?.significance];
    if (!priority || !Array.isArray(dyad.cards)) continue;
    const keys = [dyad.cards.join('-'), [...dyad.cards].reverse().join('-'), [...dyad.cards].sort((a, b) => a - b).join('-')];
    const key = keys.find((id) => getPassagesForPattern('dyad', id));
    const entry = key && getPassagesForPattern('dyad', key);
    if (!entry) continue;
    const names = new Map((entry.cards || []).map((number, index) => [number, entry.names?.[index]]));
    add('dyad', key, priority, { cardNumbers: [...dyad.cards], cardNames: dyad.cards.map((number) => names.get(number)).filter(Boolean) }, { cards: dyad.cards, category: dyad.category }, entry);
  }
  for (const progression of Array.isArray(graphKeys.suitProgressions) ? graphKeys.suitProgressions : []) {
    const priority = { 'strong-progression': 4, 'emerging-progression': 5 }[progression?.significance];
    if (!priority) continue;
    add('suit-progression', `${progression.suit}:${progression.stage}`, priority, { suit: progression.suit, stage: progression.stage }, { suit: progression.suit, stage: progression.stage });
  }
  for (const lineage of Array.isArray(graphKeys.courtLineages) ? graphKeys.courtLineages : []) {
    add('court-lineage', `${lineage.suit}:${lineage.significance}`, 5, { suit: lineage.suit, significance: lineage.significance }, { suit: lineage.suit, significance: lineage.significance });
  }
  for (const [type, keys] of [['thoth-suit', graphKeys.thothSuits], ['marseille-numerology', graphKeys.marseilleRanks]]) {
    for (const id of Array.isArray(keys) ? keys : []) add(type, id, 3);
  }
  for (const id of Array.isArray(graphKeys.triadIds) ? graphKeys.triadIds : []) {
    if (complete.has(id)) continue;
    const partial = (Array.isArray(graphKeys.partialTriads) ? graphKeys.partialTriads : []).find((entry) => entry?.id === id);
    add('triad', id, 6, {
      isPartialPattern: true,
      ...(Array.isArray(partial?.matchedCards) && Array.isArray(partial?.missingCards) ? { matchedCards: [...partial.matchedCards], missingCards: [...partial.missingCards] } : {})
    }, { triadId: id, isComplete: false });
  }
  stats.candidatesProjected = candidates.length;
  return withStats(candidates, stats);
}

const normalizeText = (text) => text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
const QUERY_STOP_WORDS = new Set(['what', 'when', 'where', 'which', 'this', 'that', 'have', 'from', 'with', 'about', 'card', 'reading']);
export function retrievalQueryTerms(query) {
  return [...new Set((query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((word) => word.length > 3 && !QUERY_STOP_WORDS.has(word)))];
}
export function scoreKeywordRelevance(text, query) {
  const terms = retrievalQueryTerms(query);
  if (!query.trim() || !terms.length) return 0.5;
  const words = new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
  return terms.length ? terms.filter((term) => words.has(term)).length / terms.length : 0;
}

function compareCandidates(a, b) {
  const priorityOnly = a._priorityOnly && b._priorityOnly;
  if (!priorityOnly && (a.relevanceScore ?? 0) !== (b.relevanceScore ?? 0)) return (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
  if ((a._contextMatch || 0) !== (b._contextMatch || 0)) return (b._contextMatch || 0) - (a._contextMatch || 0);
  if ((a.priority ?? Infinity) !== (b.priority ?? Infinity)) return (a.priority ?? Infinity) - (b.priority ?? Infinity);
  return a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0;
}

/** Pure final selection: variant choice, full-text dedup, threshold/floor, cap. */
export function selectPassageCandidates(scoredCandidates = [], { maxPassages = 5, minRelevanceScore = 0.3, enableDeduplication = true, qualityFilteringDisabled = false } = {}) {
  if (!isValidPassageLimit(maxPassages)) return [];
  const stats = { ...(scoredCandidates.retrievalStats || {}), variantsRemoved: 0, deduplicatedCandidates: 0, thresholdRejected: 0, finalSelectedCount: 0 };
  const variants = new Map();
  for (const candidate of [...scoredCandidates].filter((entry) => entry && typeof entry.candidateId === 'string' && typeof entry.patternKey === 'string' && typeof entry.promptText === 'string' && entry.promptText.trim()).sort(compareCandidates)) {
    if (variants.has(candidate.patternKey)) { stats.variantsRemoved++; continue; }
    variants.set(candidate.patternKey, candidate);
  }
  let eligible = [...variants.values()];
  if (enableDeduplication && !qualityFilteringDisabled) {
    const texts = new Set();
    eligible = eligible.filter((candidate) => {
      const key = normalizeText(candidate.promptText);
      if (texts.has(key)) { stats.deduplicatedCandidates++; return false; }
      texts.add(key); return true;
    });
  }
  stats.patternsRepresented = variants.size;
  let retained = qualityFilteringDisabled ? eligible : eligible.filter((candidate) => !Number.isFinite(candidate.relevanceScore) || candidate.relevanceScore >= minRelevanceScore);
  stats.thresholdRejected = eligible.length - retained.length;
  if (!retained.length && eligible.length) retained = [{ ...eligible[0], belowRelevanceThreshold: true }];
  if (qualityFilteringDisabled || retained.every((entry) => entry._priorityOnly)) {
    retained.sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity) || compareCandidates(a, b));
  }
  const selected = retained.slice(0, maxPassages);
  stats.finalSelectedCount = selected.length;
  return withStats(selected, stats);
}
