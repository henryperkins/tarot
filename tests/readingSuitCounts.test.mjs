import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNarrativeMetrics } from '../functions/lib/readingQuality.js';
import { buildUserPrompt } from '../functions/lib/narrative/prompts/userPrompt.js';

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

test('prompt derives suit counts from supplied cards separately from elemental totals', () => {
  const prompt = buildUserPrompt('general', cards, 'What supports focus?', '', {
    suitCounts: { Cups: 99 }, elementCounts: { Water: 4 },
    elementalBalance: 'Water leads (4/4).'
  }, null, 'general', null, 'rws-1909');
  assert.match(prompt, /Minor Arcana suit counts[^\n]*Cups=3/);
  assert.match(prompt, /Major Arcana[^\n]*do not belong to a suit/);
  assert.match(prompt, /Do not substitute element totals for suit counts/);
});
