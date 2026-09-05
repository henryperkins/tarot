import { canonicalCardKey } from '../../shared/vision/cardNameMapping.js';
import { buildDeckAwarePatterns, detectHallucinatedCards } from './readingQuality.js';
import { AMBIGUOUS_CARD_NAMES, escapeRegex, hasExplicitCardContext } from './cardContextDetection.js';

/**
 * Project recognizer prose only at the prompt boundary. A valid signature proves
 * provenance, not that alternate-card explanations belong in this reading.
 * Keep the original insights/evidence intact for verification and diagnostics.
 */
export function createVisionPromptProjector(cardsInfo, deckStyle = 'rws-1909') {
  if (!Array.isArray(cardsInfo)) return (text) => typeof text === 'string' ? text : '';

  const drawnKeys = new Set(cardsInfo.map((card) => {
    const canonical = card?.canonicalKey || card?.canonicalName;
    return canonical ? canonical.toLowerCase() : canonicalCardKey(card?.card || card?.name, deckStyle);
  }).filter(Boolean));
  const patterns = buildDeckAwarePatterns(deckStyle);
  // Overlapping RWS/Thoth court labels must retain the same allowed-alias
  // behavior as output quality checks; never remap canonical metadata twice.
  const drawnAliases = new Set(patterns
    .filter(({ canonical }) => drawnKeys.has(canonical.toLowerCase()))
    .map(({ normalized }) => normalized));
  const undrawnPatterns = patterns.filter(({ canonical, normalized }) =>
    !drawnKeys.has(canonical.toLowerCase()) && !drawnAliases.has(normalized));

  const mentionsUndrawnCard = (sentence) => {
    if (detectHallucinatedCards(sentence, cardsInfo, deckStyle).length) return true;
    return undrawnPatterns.some(({ name, normalized, pattern, isEpithet }) => {
      if (!AMBIGUOUS_CARD_NAMES.has(normalized) && !isEpithet) return false;
      const match = pattern.exec(sentence);
      if (!match) return false;
      if (hasExplicitCardContext(sentence, name)) return true;
      // Match recognition/comparison language adjacent to the identity, rather
      // than treating an unrelated "unlike" anywhere in the sentence as proof.
      // This covers lower-case model output without deleting ordinary symbols.
      const titleCase = match[0] === name;
      const target = `(?:the\\s+)?${escapeRegex(name)}\\b`;
      const identification = new RegExp(`\\b(?:more likely than|recognized as|identified as|classified as|(?:alternate|alternative|candidate|prediction)(?:\\s+card)?\\s*[:=-]?)\\s*${target}`, 'i');
      if (identification.test(sentence)) return true;
      const comparison = new RegExp(`\\b(?:unlike|compared (?:with|to)|rather than|instead of|resembles?)\\s+${target}`, 'i');
      const standaloneTitle = /^the\s/i.test(name) && sentence.trim().replace(/[.!?]+$/, '') === name;
      return (comparison.test(sentence) && (titleCase || /^the\s/i.test(name))) || standaloneTitle;
    });
  };

  return (text) => {
    if (typeof text !== 'string' || !text.trim()) return '';
    // Remove the complete alternate-card sentence, including its symbols, while
    // retaining independent observations that follow it.
    return (text.match(/[^.!?\n]+(?:[.!?]+|(?=\n|$))/g) || [])
      .filter((sentence) => !mentionsUndrawnCard(sentence))
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .join(' ');
  };
}

export function projectVisionInsightForPrompt(entry, { cardsInfo, deckStyle = 'rws-1909' } = {}) {
  if (!entry || typeof entry !== 'object') return entry;
  const projectText = createVisionPromptProjector(cardsInfo, deckStyle);
  const projectList = (values) => Array.isArray(values) ? values.map(projectText).filter(Boolean) : [];
  const visualDetails = Array.isArray(entry.visualDetails)
    ? entry.visualDetails
    : (typeof entry.visualDetails === 'string' ? entry.visualDetails.split(/[\n;]+/) : []);
  return {
    ...entry,
    label: projectText(entry.label),
    basis: projectText(entry.basis),
    mergeSource: projectText(entry.mergeSource),
    reasoning: projectText(entry.reasoning),
    visualDetails: projectList(visualDetails),
    visualProfile: entry.visualProfile ? {
      ...entry.visualProfile,
      tone: projectList(entry.visualProfile.tone),
      emotion: projectList(entry.visualProfile.emotion)
    } : entry.visualProfile,
    symbolVerification: entry.symbolVerification ? {
      ...entry.symbolVerification,
      missingSymbols: projectList(entry.symbolVerification.missingSymbols)
    } : entry.symbolVerification
  };
}
