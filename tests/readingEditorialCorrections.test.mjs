import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPassagesForPattern } from '../functions/lib/knowledgeBase.js';
import { projectPassageForDeck } from '../functions/lib/graphRAGProjection.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { formatPassagesForPrompt } from '../functions/lib/graphRAG.js';

test('native and meaning-only references retain useful concepts without inherited factual claims or directives', () => {
  const cases = [
    ['triad', 'tower-star-moon', 'career', /professional collapse|The Tower is job loss|Don’t panic/, /uncertain|unclear|unsettled/],
    ['triad', 'devil-tower-sun', 'relationship', /choose the clean ending|ends the pattern|joy returning/i, /boundar|choice|choose/],
    ['triad', 'wheel-justice-hangedman', 'legal', /accept what the system decides|release what you cannot influence/i, /fair process|options/],
    ['triad', 'wheel-justice-hangedman', 'healing', /stop arguing with reality|surrender that stops the fight/i, /support|perspective/],
    ['dyad', '7-21', 'career', /victory is approaching|celebrate the win|rewards finished work/i, /finish|complet|lesson/],
    ['dyad', '18-19', 'general', /what is hidden will come to light|clarity follows honest confusion/i, /evidence|possibility/],
    ['dyad', '15-16', 'shadow', /negotiation ends here|cooperate with the break/i, /support|options/]
  ];
  for (const [type, patternId, context, forbidden, useful] of cases) {
    const original = getPassagesForPattern(type, patternId).passages.find(row => row.context === context);
    for (const deck of ['rws-1909', 'thoth-a1', 'marseille-classic']) {
      const projected = projectPassageForDeck({ ...original, type, patternId }, deck);
      assert.doesNotMatch(projected.promptText, forbidden, `${patternId}/${context}/${deck}`);
      assert.match(projected.promptText, useful);
      assert.doesNotMatch(formatPassagesForPrompt([projected], { deckStyle: deck }), /Post-Crisis/);
    }
  }
});

test('capitalized and lowercase articles adapt with an explicit card name, while ordinary fortune stays prose', t => {
  const original = getPassagesForPattern('triad', 'wheel-justice-hangedman').passages[0];
  const saved = { text: original.text, archetypalText: original.archetypalText };
  t.after(() => Object.assign(original, saved));
  original.text = original.archetypalText = 'The Wheel offers perspective. Consider the Wheel and the Wheel of Fortune. Ordinary fortune and a turning wheel are metaphors.';
  const project = deck => projectPassageForDeck({ ...original, type: 'triad', patternId: 'wheel-justice-hangedman' }, deck).promptText;
  assert.equal(project('thoth-a1'), 'Fortune offers perspective. Consider Fortune and Fortune. Ordinary fortune and a turning wheel are metaphors.');
  assert.equal(project('marseille-classic'), 'La Roue de Fortune offers perspective. Consider La Roue de Fortune and La Roue de Fortune. Ordinary fortune and a turning wheel are metaphors.');
  assert.equal(project('rws-1909'), original.text);
});

test('two corrected Major pair themes reach final prompts without their contradictory directions', () => {
  for (const [numbers, useful, forbidden] of [
    [[15, 19], /Attachment considered alongside clarity and vitality\./, /sudden liberation/],
    [[10, 12], /Changing conditions inviting a different perspective\./, /Cycles demanding surrender/]
  ]) {
    for (const deckStyle of ['rws-1909', 'thoth-a1', 'marseille-classic']) {
      const cardsInfo = numbers.map((number, index) => ({ ...MAJOR_ARCANA.find(card => card.number === number),
        card: MAJOR_ARCANA.find(card => card.number === number).name, orientation: index ? 'Reversed' : 'Upright', position: index ? 'Option B' : 'Option A' }));
      const result = buildEnhancedClaudePrompt({ spreadInfo: { name: 'General Reading' }, cardsInfo, deckStyle,
        userQuestion: 'Help me reflect on these options.', promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' } });
      assert.match(result.userPrompt, useful);
      assert.doesNotMatch(result.userPrompt, forbidden);
      assert.doesNotMatch(result.userPrompt, /vitality\.\.|perspective\.\./);
      assert.match(result.userPrompt, /positions and orientations/);
      assert.match(result.userPrompt, /Reversed/);
    }
  }
});
