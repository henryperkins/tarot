import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNarrativeMetrics } from '../functions/lib/readingQuality.js';
import { buildUserPrompt } from '../functions/lib/narrative/prompts/userPrompt.js';
import { analyzeSpreadThemes, getDrawnCardTallies } from '../functions/lib/spreadAnalysis.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrativeBuilder.js';

const cards = ['Five of Cups', 'Six of Cups', 'Eight of Cups', 'The Moon'].map((card, index) => ({
  card, position: `Position ${index + 1}`, orientation: 'Upright'
}));

for (const phrase of [
  'Four Cups cards point toward emotion.',
  'Four of the ten cards are Cups.',
  '**4** of your 10 cards are **Cups**.',
  'The spread contains four Cups cards.',
  'Even if you move gently, four Cups cards still dominate this spread.',
  'Cups appear four times in this spread.'
]) {
  test(`detects an incorrect suit count in: ${phrase}`, () => {
    assert.deepEqual(buildNarrativeMetrics(phrase, cards).suitCountMismatches,
      [{ suit: 'Cups', claimed: 4, actual: 3 }]);
  });
}

for (const phrase of [
  'Three Cups cards point toward emotion.',
  'Three of the four cards are Cups.',
  'The Four of Cups invites reflection.',
  'Water leads with four cards, including The Moon.',
  'There are not four Cups cards; there are three.',
  "There aren't four Cups cards here.",
  'You do not have four Cups cards; there are three.',
  'Four Cups cards are not present; there are three.',
  'At least two Cups cards are present.',
  'No more than four Cups cards appear here.',
  'Would four Cups cards change the emphasis?',
  'Drawing four Cups cards would emphasize emotion.',
  'If four Cups cards appeared, the emphasis could differ.',
  'Imagine drawing four Cups cards.',
  'The Three of Cups card speaks of community.'
]) {
  test(`does not confuse card ranks, elements, or hypothetical counts: ${phrase}`, () => {
    assert.deepEqual(buildNarrativeMetrics(phrase, cards).suitCountMismatches, []);
  });
}

test('checks deck suit aliases against canonical identities', () => {
  const drawn = [
    { card: 'Prudence (Eight of Disks)', canonicalName: 'Eight of Pentacles' },
    { card: 'Completion (Four of Wands)', canonicalName: 'Four of Wands' }
  ];
  assert.deepEqual(buildNarrativeMetrics('Two Disks cards ground this spread.', drawn, 'thoth-a1').suitCountMismatches,
    [{ suit: 'Pentacles', claimed: 2, actual: 1 }]);
  assert.deepEqual(buildNarrativeMetrics('One Coins card and one Batons card appear.', drawn, 'marseille-classic').suitCountMismatches, []);
});

test('a negated count does not hide a later incorrect assertion', () => {
  assert.deepEqual(buildNarrativeMetrics('There are not four Cups cards elsewhere. Four Cups cards appear here.', cards).suitCountMismatches,
    [{ suit: 'Cups', claimed: 4, actual: 3 }]);
});

test('a count of an explicitly named drawn pair is not a total for the whole spread', () => {
  const text = 'Five of Cups and Six of Cups connect acceptance with enjoyment. These two Cups cards can be considered together.';
  assert.deepEqual(buildNarrativeMetrics(text, cards).suitCountMismatches, []);
});

test('a named Thoth pair does not contradict a correctly stated total', () => {
  const text = 'Water is strongest: three Cups cards plus The Moon.\n\nAhead, Six of Cups, Pleasure, offers simple enjoyment. Next to Disappointment reversed, these two Cups cards show emotional attention that can turn either way.';
  assert.deepEqual(buildNarrativeMetrics(text, cards, 'thoth-a1').suitCountMismatches, []);
});

for (const text of [
  'These two Cups cards point toward emotion.',
  'Five of Cups and Six of Cups connect. These two Cups cards are the only Cups cards in the spread.',
  'Five of Cups and Six of Cups connect. These two Cups cards represent the total for the whole spread.',
  'Five of Cups and Six of Cups connect. These two Cups cards account for every card of that suit here.',
  'Five of Cups and Six of Cups connect. These two Cups cards exhaust the Cups presence here.',
  'Five of Cups and Six of Cups connect. These two Cups cards form the entirety of the Cups presence here.',
  'Five of Cups and Six of Cups connect. These two Cups cards anchor the reading. They are the only Cups cards here.',
  'Five of Cups and Six of Cups connect. These two Cups cards anchor the reading; they are the entire Cups contingent.',
  'The only Cups cards in this spread are Five of Cups and Six of Cups. These two Cups cards anchor the reading.',
  'The whole Cups group is Five of Cups and Six of Cups. These two Cups cards describe the spread.',
  "Five of Cups and Six of Cups are present. These two Cups cards make up the spread's full Cups contingent.",
  'The Cups cards drawn here are Five of Cups and Six of Cups. These two Cups cards anchor the reading.',
  'Five of Cups, Six of Cups and Eight of Cups connect. These two Cups cards point toward emotion.',
  'Five of Cups and Seven of Cups connect. These two Cups cards point toward emotion.',
  'Five of Cups and Six of Cups connect. These four Cups cards point toward emotion.',
  'Five of Cups and Six of Cups connect. Two of these four cards are Cups.'
]) {
  test(`retains mismatches for total, unverified or inconsistent subset claims: ${text}`, () => {
    const claimed = text.includes('These four') ? 4 : 2;
    assert.deepEqual(buildNarrativeMetrics(text, cards).suitCountMismatches,
      [{ suit: 'Cups', claimed, actual: 3 }]);
  });
}

test('a valid subset count cannot hide a later incorrect whole-spread total', () => {
  const text = 'Five of Cups and Six of Cups connect. These two Cups cards offer a useful comparison. The spread contains two Cups cards.';
  assert.deepEqual(buildNarrativeMetrics(text, cards).suitCountMismatches,
    [{ suit: 'Cups', claimed: 2, actual: 3 }]);
});

test('prompt derives suit counts from supplied cards separately from elemental totals', () => {
  const prompt = buildUserPrompt('general', cards, 'What supports focus?', '', {
    suitCounts: { Cups: 99 }, elementCounts: { Water: 4 },
    elementalBalance: 'Water leads (4/4).'
  }, null, 'general', null, 'rws-1909');
  assert.match(prompt, /Minor Arcana suit counts[^\n]*Cups=3/);
  assert.match(prompt, /Major Arcana[^\n]*do not belong to a suit/);
  assert.match(prompt, /Do not substitute element totals for suit counts/);
});

// 2026-10-31 F3b standard run: a Celtic Cross reading spoke of "the two reversed
// cards" though three were reversed, and called Eight of Pentacles "the only
// Earth card" though the application maps The Hermit to Earth. The prompt
// exposed only "Fire 5/10", so every aggregate had to be counted by the model.
const CELTIC_DEEP_SHIFT = [
  ['The Hermit', 9, 'Upright'], ['Five of Wands', null, 'Reversed'], ['Death', 13, 'Upright'],
  ['Temperance', 14, 'Upright'], ['The Emperor', 4, 'Upright'], ['The Moon', 18, 'Reversed'],
  ['Strength', 8, 'Upright'], ['Eight of Pentacles', null, 'Upright'], ['Nine of Swords', null, 'Reversed'],
  ['The Sun', 19, 'Upright']
].map(([card, number, orientation], index) => ({ card, number, orientation, position: `Position ${index + 1}` }));

test('prompt supplies reversal and element tallies, with Major associations, from the drawn cards', () => {
  const prompt = buildUserPrompt('general', CELTIC_DEEP_SHIFT, 'How can I stay centered?', '', {},
    null, 'general', null, 'rws-1909');
  const lines = prompt.split('\n').filter(row => row.startsWith('- Drawn-card tallies'));
  assert.equal(lines.length, 1);
  const [line] = lines;
  assert.match(line, /3\/10 reversed \(Five of Wands, The Moon, Nine of Swords\)/);
  assert.match(line, /Fire 5 \(Five of Wands, Temperance, The Emperor, Strength, The Sun\)/);
  assert.match(line, /Water 2 \(Death, The Moon\)/);
  assert.match(line, /Air 1 \(Nine of Swords\)/);
  assert.match(line, /Earth 2 \(The Hermit, Eight of Pentacles\)/);
  assert.match(line, /only\/both\/all/);
  // Suit counts stay separate from elemental tallies.
  assert.match(prompt, /Minor Arcana suit counts[^\n]*Pentacles=1/);
});

test('tallies report zero reversals and absent elements instead of omitting them', () => {
  const waterCards = cards.map(card => card.card === 'The Moon' ? { ...card, number: 18 } : card);
  const prompt = buildUserPrompt('general', waterCards, 'What supports focus?', '', {}, null, 'general', null, 'rws-1909');
  const line = prompt.split('\n').find(row => row.startsWith('- Drawn-card tallies')) || '';
  assert.match(line, /0\/4 reversed[.;]/);
  assert.match(line, /Fire 0[;.]/);
  assert.match(line, /Water 4 \(Five of Cups, Six of Cups, Eight of Cups, The Moon\)/);
  assert.doesNotMatch(line, /no mapped element/);
});

test('a card without a mapped element is named rather than silently dropped from the totals', () => {
  const prompt = buildUserPrompt('general', cards, 'What supports focus?', '', {}, null, 'general', null, 'rws-1909');
  const line = prompt.split('\n').find(row => row.startsWith('- Drawn-card tallies')) || '';
  assert.match(line, /Water 3 \(Five of Cups, Six of Cups, Eight of Cups\)/);
  assert.match(line, /no mapped element 1 \(The Moon\)/);
});

test('a single card has no aggregate tally line', () => {
  const prompt = buildUserPrompt('single', [cards[0]], 'What supports focus?', '', {}, null, 'general', null, 'rws-1909');
  assert.doesNotMatch(prompt, /Drawn-card tallies/);
});

test('tallies use the same element and orientation rules as the spread themes', async () => {
  const themes = await analyzeSpreadThemes(CELTIC_DEEP_SHIFT);
  const tallies = getDrawnCardTallies(CELTIC_DEEP_SHIFT);
  assert.deepEqual(Object.fromEntries(Object.entries(tallies.elements).map(([element, names]) => [element, names.length])),
    themes.elementCounts);
  assert.equal(tallies.reversed.length, themes.reversalCount);
  assert.equal(tallies.total, 10);
});

test('budget fitting drops the tally line before any earlier fitting step', () => {
  const args = { spreadInfo: { key: 'celtic', name: 'Celtic Cross' }, cardsInfo: CELTIC_DEEP_SHIFT.map((card, index) => ({ ...card, meaning: `Theme ${index + 1}.` })),
    themes: {}, userQuestion: 'How can I stay centered?', deckStyle: 'rws-1909' };
  const roomy = buildEnhancedClaudePrompt({ ...args, promptBudgetEnv: { GRAPHRAG_ENABLED: 'false', ENABLE_PROMPT_SLIMMING: 'true', PROMPT_BUDGET_CLAUDE: '100000' } });
  assert.deepEqual(roomy.promptMeta.slimmingSteps, []);
  assert.match(roomy.userPrompt, /Drawn-card tallies/);
  const total = roomy.promptMeta.estimatedTokens.total;
  const tight = buildEnhancedClaudePrompt({ ...args, promptBudgetEnv: { GRAPHRAG_ENABLED: 'false', ENABLE_PROMPT_SLIMMING: 'true', PROMPT_BUDGET_CLAUDE: String(total - 5) } });
  assert.equal(tight.promptMeta.slimmingSteps[0], 'drop-drawn-card-tallies');
  assert.doesNotMatch(tight.userPrompt, /Drawn-card tallies/);
  assert.equal(tight.userPrompt, roomy.userPrompt.split('\n').filter(line => !line.startsWith('- Drawn-card tallies')).join('\n'));
});
