import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { truncateUserPromptSafely } from '../functions/lib/narrative/prompts/truncation.js';
import { estimateTokenCount } from '../functions/lib/narrative/prompts/budgeting.js';

const spreadCases = [
  { key: 'single', count: 1, standard: [300, 400], short: [150, 250] },
  { key: 'threeCard', count: 3, standard: [500, 700], short: [250, 400] },
  { key: 'relationship', count: 3, standard: [500, 700], short: [250, 400] },
  { key: 'fiveCard', count: 5, standard: [700, 900], short: [400, 550] },
  { key: 'decision', count: 5, standard: [700, 900], short: [400, 550] },
  { key: 'celtic', count: 10, standard: [1000, 1400], short: [600, 800] }
];
const cardNames = ['The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit'];

function buildPrompt({ spreadKey = 'single', depth = 'standard', tone = 'balanced', frame = 'mixed', focusAreas = [], variantOverrides = null } = {}) {
  const count = spreadCases.find((spread) => spread.key === spreadKey)?.count || 1;
  return buildEnhancedClaudePrompt({
    spreadInfo: { name: 'Preference fixture', key: spreadKey },
    cardsInfo: cardNames.slice(0, count).map((card, number) => ({
      card, number, position: `Position ${number + 1}`, orientation: 'Upright', meaning: 'Consider a thoughtful next step.'
    })),
    userQuestion: 'How can I prepare for my job interview?',
    reflectionsText: 'I want practical preparation and cannot change jobs yet.',
    context: 'career',
    personalization: { readingTone: tone, spiritualFrame: frame, preferredSpreadDepth: depth, focusAreas },
    promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' },
    variantOverrides
  });
}

function totalWordBands(prompt) {
  return [...prompt.matchAll(/~(\d+)[–-](\d+) words total/g)].map((match) => [Number(match[1]), Number(match[2])]);
}

describe('final narrative preference contract', () => {
  for (const depth of ['short', 'standard', 'deep']) {
    for (const tone of ['gentle', 'balanced', 'blunt']) {
      it(`${depth}/${tone} sends the same action count in both provider messages`, () => {
        const { systemPrompt, userPrompt } = buildPrompt({ depth, tone });
        const actions = [systemPrompt, userPrompt].map((prompt) => prompt.match(/^- .*\b(?:include|Offer) .*low-stakes[^\n]*/m)?.[0]);
        assert.ok(actions.every(Boolean), 'both messages must state an action contract');
        for (const action of actions) {
          assert.match(action, depth === 'short' ? /\bone\b.*next step\b/ : /2-4.*next steps/);
        }
        assert.equal(actions[0], actions[1], 'system and user action guidance must agree');
        if (depth === 'short') {
          assert.doesNotMatch(systemPrompt + userPrompt, /2-4 (?:actionable|specific)/);
          assert.doesNotMatch(systemPrompt, /120–160 words per card/);
        }
        assert.match(userPrompt, /Use invitational language/);
        assert.match(userPrompt, /choices or decisions shape outcomes/);
        assert.match(userPrompt, /CARD NAME CONTRACT/);
        assert.match(systemPrompt, /same language as the user's question/);
      });
    }
  }

  for (const spread of spreadCases) {
    for (const depth of ['short', 'standard', 'deep']) {
      it(`${spread.key}/${depth} gives one consistent total word band`, () => {
        const expected = depth === 'deep' ? [1500, 1900] : spread[depth];
        const { systemPrompt, userPrompt } = buildPrompt({ spreadKey: spread.key, depth });
        assert.deepEqual(totalWordBands(systemPrompt), [expected]);
        assert.deepEqual(totalWordBands(userPrompt), [expected]);
        assert.doesNotMatch(systemPrompt, /DEEP DIVE LENGTH:/, 'deep mode must replace the baseline band');
        if (depth === 'deep') assert.match(systemPrompt, /recap.*within the total word target/i);
      });
    }
  }

  it('scales the selected depth band once for an experiment in both messages', () => {
    const { systemPrompt, userPrompt } = buildPrompt({ depth: 'short', variantOverrides: { lengthModifier: 1.2 } });
    assert.deepEqual(totalWordBands(systemPrompt), [[180, 300]]);
    assert.deepEqual(totalWordBands(userPrompt), [[180, 300]]);
    assert.doesNotMatch(systemPrompt, /Target approximately 120%/, 'do not ask the model to apply the modifier a second time');
  });

  it('keeps blunt wording direct while preserving uncertainty and optional action', () => {
    const { systemPrompt } = buildPrompt({ tone: 'blunt' });
    const toneSection = systemPrompt.match(/## Reading Tone\n([^\n]+)/)?.[1] || '';
    assert.match(toneSection, /direct|clear/);
    assert.match(toneSection, /uncertainty/);
    assert.match(toneSection, /optional|invitational/);
    assert.doesNotMatch(toneSection, /without hedging|Skip softening phrases/);
  });

  it('allows the selected spiritual frame as symbolism without asserting unseen facts', () => {
    const { systemPrompt } = buildPrompt({ frame: 'spiritual' });
    const frameSection = systemPrompt.match(/## Interpretive Frame\n([^\n]+)/)?.[1] || '';
    assert.match(frameSection, /symbolic|metaphor/);
    assert.match(frameSection, /do not.*(?:fact|destiny|soul contract)/i);
    assert.doesNotMatch(systemPrompt, /Skip the mystical poetry|no "cosmic downloads" or "sacred portals"/);
  });

  it('keeps saved interests subordinate to the current question and reflections', () => {
    const { systemPrompt, userPrompt } = buildPrompt({ focusAreas: ['Love & relationships'] });
    const focusSection = userPrompt.match(/\*\*Focus Areas\*\*:\n([\s\S]*?)\n\n/)?.[1] || '';
    assert.match(focusSection, /Love & relationships/);
    assert.match(focusSection, /current question and (?:current )?reflections.*(?:priority|override|precedence)/i);
    assert.match(focusSection, /only when.*relevant/i);
    assert.doesNotMatch(userPrompt, /Keep the reading anchored in:|Return to these themes|question and focus areas as the throughline/);
    assert.doesNotMatch(systemPrompt, /tied to the question or focus areas/);
  });

  it('retains short action and current-context precedence when the instruction footer is budgeted', () => {
    const { userPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'One-Card Insight', key: 'single' },
      cardsInfo: [{ card: 'The Sun', number: 19, position: 'Theme', orientation: 'Upright', meaning: 'Clarity. '.repeat(75), userReflection: 'I value time with family. '.repeat(60) }],
      userQuestion: 'How do I prepare for my interview?',
      reflectionsText: 'I need concrete preparation. '.repeat(60),
      personalization: { preferredSpreadDepth: 'short', focusAreas: ['Love & relationships'] },
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
    });
    const result = truncateUserPromptSafely(userPrompt, 800, { spreadKey: 'single' });
    assert.equal(result.truncated, true);
    assert.ok(estimateTokenCount(result.text) <= 800);
    assert.match(result.text, /Offer one specific, low-stakes next step/);
    assert.match(result.text, /Use the current question and reflections as the throughline/);
    assert.match(result.text, /Do not introduce any card names beyond the provided spread/);
  });
});
