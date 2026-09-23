import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSpreadThemes } from '../functions/lib/spreadAnalysis.js';
import { buildEnhancedClaudePrompt, buildDecisionReading } from '../functions/lib/narrativeBuilder.js';

// Mirrors the reviewed reading: a five-card decision spread with one card per
// suit plus one Major, and two reversed minors (ratio 0.4). Small-spread rules
// read that through the "delayed" lens.
const DECISION_CARDS = [
  { card: 'Two of Swords', name: 'Two of Swords', suit: 'Swords', rank: 'Two', rankValue: 2, position: 'Heart of the decision', orientation: 'Upright', meaning: 'A stalemate between two options.' },
  { card: 'Knight of Wands', name: 'Knight of Wands', suit: 'Wands', rank: 'Knight', rankValue: 12, position: 'Path A — energy & likely outcome', orientation: 'Reversed', meaning: 'Bold, restless momentum.' },
  { card: 'Six of Cups', name: 'Six of Cups', suit: 'Cups', rank: 'Six', rankValue: 6, position: 'Path B — energy & likely outcome', orientation: 'Upright', meaning: 'Familiar comfort and nostalgia.' },
  { card: 'Ace of Pentacles', name: 'Ace of Pentacles', suit: 'Pentacles', rank: 'Ace', rankValue: 1, position: 'What clarifies the best path', orientation: 'Reversed', meaning: 'A tangible new opportunity.' },
  { card: 'Strength', name: 'Strength', number: 8, position: 'What to remember about your free will', orientation: 'Upright', meaning: 'Steady courage and compassion.' }
];
const QUESTION = 'Should I take the new job offer or stay where I am?';

// Wording that promises the reversed energy will eventually show up.
const PROMISED_FULFILLMENT = new RegExp([
  /\bwill\s+(?:eventually\s+)?(?:manifest|arrive|come|return|happen|unfold)\b/.source,
  /\bwill\s+eventually\b/.source,
  /\b(?:is|are)\s+coming\b/.source,
  /\bmanifest\s+later\b/.source,
  /\bin\s+due\s+time\b/.source
].join('|'), 'i');
const NON_GUARANTEE = /\b(?:does not|doesn't|cannot|can't)\s+guarantee\b/i;

async function buildDelayedThemes() {
  const themes = await analyzeSpreadThemes(DECISION_CARDS, { userQuestion: QUESTION });
  assert.equal(themes.reversalFramework, 'delayed', 'Scenario precondition: two reversals in five cards');
  return themes;
}

describe('delayed reversal lens keeps outcomes conditional', () => {
  it('tells the model that waiting is not a promise of the outcome', async () => {
    const themes = await buildDelayedThemes();
    const { systemPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Decision / Two-Path', key: 'decision' },
      cardsInfo: DECISION_CARDS,
      userQuestion: QUESTION,
      reflectionsText: '',
      themes
    });
    const lens = systemPrompt.match(/REVERSAL FRAMEWORK\n([\s\S]*?)\n\n/)?.[1] || '';

    assert.match(lens, /Delayed Timing/, 'The delayed-timing lens itself is kept');
    assert.doesNotMatch(lens, PROMISED_FULFILLMENT);
    assert.match(lens, NON_GUARANTEE);
  });

  it('does not promise symptom relief under the shadow lens', async () => {
    const question = 'What am I afraid to admit about this job?';
    const themes = await analyzeSpreadThemes(DECISION_CARDS, { userQuestion: question });
    assert.equal(themes.reversalFramework, 'shadow', 'Scenario precondition: fear keyword selects shadow');
    const { systemPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Decision / Two-Path', key: 'decision' },
      cardsInfo: DECISION_CARDS,
      userQuestion: question,
      reflectionsText: '',
      themes
    });
    const lens = systemPrompt.match(/REVERSAL FRAMEWORK\n([\s\S]*?)\n\n/)?.[1] || '';

    assert.match(lens, /Shadow Integration/);
    assert.doesNotMatch(lens, /\b(?:anxiety|fear|grief|pain|depression)\s+(?:eases|lifts|fades|heals|resolves)\b/i);
  });

  it('keeps promised fulfillment out of the local fallback reading', async () => {
    const themes = await buildDelayedThemes();
    const reading = await buildDecisionReading({
      cardsInfo: DECISION_CARDS,
      userQuestion: QUESTION,
      reflectionsText: '',
      themes
    });

    assert.match(reading, /Delayed Timing/, 'The fallback reading surfaces the lens');
    assert.doesNotMatch(reading, PROMISED_FULFILLMENT);
  });
});
