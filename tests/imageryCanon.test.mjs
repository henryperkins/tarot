import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrativeBuilder.js';
import { buildPositionCardText } from '../functions/lib/narrative/helpers.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

// Observations checked against the matching 1909 scans. The disputed time,
// identity and motion claims are deliberately not accepted as literal evidence.
const observations = [
  ['The Fool', /sun (?:shining )?behind/i, /sun ris(?:ing|es)|ris(?:ing|en) sun/i],
  ['The Empress', /seated figure/i, /reclining figure/i],
  ['The Chariot', /sphinxes.*seated/i, /sphinxes[^\n]*pulling/i],
  ['Death', /sun (?:on the horizon )?between towers/i, /sun ris(?:ing|es)|ris(?:ing|en) sun/i],
  ['Temperance', /radiant crown/i, /rising sun/i],
  ['The Tower', /dark sky.*pale clouds/i, /gr[ae]y sky|flaming debris/i],
  ['The Moon', /moon with face/i, /full moon/i],
  ['Three of Pentacles', /craftsman.*two figures.*plans/i, /noble|cathedral|architect and monk|stained glass/i],
  ['Nine of Swords', /person sits.*nine swords above/i, /bolts|bolting|etched on the wall/i],
  ['Eight of Pentacles', /craftsman.*a pentacle on a workbench/i, /pentacles along a workbench/i],
  ['Six of Swords', /ferryman.*two passengers/i, /cloaked figures/i],
  ['Queen of Cups', /seated figure.*covered cup/i, /held with devotion/i]
];
const catalogue = [...MAJOR_ARCANA, ...MINOR_ARCANA];
const cardInfo = (name, orientation) => {
  const data = catalogue.find(card => card.name === name);
  return { ...data, card: data.name, orientation, meaning: data[orientation.toLowerCase()], position: 'Theme / Guidance of the Moment' };
};

for (const [name, supported, unsupported] of observations) {
  for (const orientation of ['Upright', 'Reversed']) {
    test(`${name} ${orientation} reaches the final provider prompt with supported literal imagery`, () => {
      const card = cardInfo(name, orientation);
      const built = buildEnhancedClaudePrompt({ spreadInfo: { key: 'single', name: 'One-Card Insight' },
        cardsInfo: [card], themes: {}, deckStyle: 'rws-1909', userQuestion: 'What could I reflect on?',
        promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' } });
      assert.match(built.userPrompt, supported);
      assert.doesNotMatch(built.userPrompt, unsupported);
      assert.ok(built.userPrompt.includes(name));
      assert.ok(built.userPrompt.includes(orientation));
      assert.ok(built.userPrompt.toLowerCase().includes(card.meaning.toLowerCase()));
    });
  }
}

for (const name of ['Three of Pentacles', 'Nine of Swords', 'Eight of Pentacles', 'Six of Swords', 'Queen of Cups']) {
  test(`${name} uses the same supported scene in the local composer across roles`, () => {
    const [, supported, unsupported] = observations.find(row => row[0] === name);
    for (const position of ['Past — what lies behind', 'Present — where you stand now', 'External Influences — people & environment']) {
      const text = buildPositionCardText(cardInfo(name, 'Upright'), position, { deckStyle: 'rws-1909', includeSymbols: true });
      assert.match(text, supported);
      assert.doesNotMatch(text, unsupported);
    }
  });
}

test('corrected RWS scenes remain excluded from non-RWS provider prompts', () => {
  for (const deckStyle of ['thoth-a1', 'marseille-classic']) {
    const built = buildEnhancedClaudePrompt({ spreadInfo: { key: 'single', name: 'One-Card Insight' },
      cardsInfo: [cardInfo('The Tower', 'Upright')], themes: {}, deckStyle,
      userQuestion: 'What could I reflect on?', promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' } });
    assert.doesNotMatch(built.userPrompt, /RWS image|dark sky.*pale clouds|gray sky/);
  }
});
