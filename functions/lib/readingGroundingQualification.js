/**
 * Bounded, fixture-owned assertions for offline qualification.
 * A passing result checks these expectations only; meaning and useful guidance still need review.
 */
import { classifyCardMentions, detectUndrawnCardAssertions } from './readingCardAssertions.js';
import { parseMemoryBlocks } from './userMemory.js';

function capturedText(capture) {
  if (typeof capture === 'string') return { systemPrompt: '', userPrompt: capture };
  return {
    systemPrompt: typeof capture?.systemPrompt === 'string' ? capture.systemPrompt : '',
    userPrompt: typeof capture?.userPrompt === 'string' ? capture.userPrompt : ''
  };
}

export function evaluateReadingGroundingFixture({ fixture, reading, promptCapture, sourceUsage } = {}) {
  if (!fixture || typeof fixture !== 'object') throw new TypeError('A grounding fixture is required.');
  const expectations = fixture.expectations || {};
  const { systemPrompt, userPrompt } = capturedText(promptCapture);
  const readingText = typeof reading === 'string' ? reading : '';
  const referenceText = [
    promptCapture?.highlightText, promptCapture?.referenceText,
    ...(userPrompt.match(/<reference\b[^>]*>[\s\S]*?<\/reference>/gi) || []),
    ...(userPrompt.match(/\*\*Archetypal Patterns\*\*[^]*?(?=\n\n|$)/g) || [])
  ].filter(value => typeof value === 'string').join('\n');
  const inputs = fixture.acceptedInputs || fixture;
  const cardsInfo = inputs.cardsInfo || (inputs.cards || []).map(card => ({
    card: card.wireName || card.name,
    canonicalName: card.canonicalName || card.name,
    canonicalKey: card.canonicalKey
  }));
  const violations = [];
  const add = (code, expectationId = null) => {
    if (!violations.some(row => row.code === code && (row.expectationId || null) === expectationId)) {
      violations.push({ code, ...(expectationId ? { expectationId } : {}) });
    }
  };
  if (detectUndrawnCardAssertions(readingText, cardsInfo, fixture.deckStyle).length > 0) add('undrawn_card_assertion');
  const absent = new Set(expectations.absentCards || fixture.expected?.absentCards || []);
  if (absent.size && classifyCardMentions(referenceText, { cardsInfo, deckStyle: fixture.deckStyle })
    .some(mention => absent.has(mention.canonical) && ['present', 'unclassified'].includes(mention.classification))) add('absent_card_reference');
  const contextBlocks = Array.from(userPrompt.matchAll(/<user_context\b[^>]*>[\s\S]*?<\/user_context>/g));
  for (const marker of expectations.untrustedMarkers || []) {
    if (typeof marker !== 'string' || !marker) { add('invalid_expectation'); continue; }
    let cursor = userPrompt.indexOf(marker);
    let outsideData = false;
    while (cursor >= 0) {
      if (!contextBlocks.some(block => cursor >= block.index && cursor + marker.length <= block.index + block[0].length)) outsideData = true;
      cursor = userPrompt.indexOf(marker, cursor + marker.length);
    }
    if (systemPrompt.includes(marker) || referenceText.includes(marker) || outsideData) add('untrusted_marker_authority');
  }

  for (const [kind, value] of [['reading', readingText], ['prompt', `${systemPrompt}\n${userPrompt}`], ['reference', referenceText]]) {
    for (const rule of expectations[kind]?.required || []) {
      const literal = typeof rule === 'string' ? rule : rule.literal;
      if (typeof literal !== 'string' || !literal) { add('invalid_expectation'); continue; }
      if (!value.toLowerCase().includes(literal.toLowerCase())) add(`${kind}_required_text_missing`, typeof rule === 'string' ? null : rule.id);
    }
    for (const rule of expectations[kind]?.forbidden || []) {
      if (typeof rule?.literal !== 'string' || !rule.literal) { add('invalid_expectation'); continue; }
      if (value.toLowerCase().includes(rule.literal.toLowerCase())) add(rule.reason || `${kind}_forbidden_text`, rule.id || null);
    }
  }
  if (promptCapture !== undefined && typeof sourceUsage?.memories?.memoriesUsedInPrompt === 'number'
    && sourceUsage.memories.memoriesUsedInPrompt !== parseMemoryBlocks(userPrompt).size) add('memory_retention_mismatch');
  return {
    passed: violations.length === 0,
    violations,
    requiresHumanReview: fixture.requiresHumanReview !== false
  };
}
