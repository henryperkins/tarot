// Pattern web: saved triad ids and dyad Major Arcana numbers resolve to the
// drawn cards, in any of the three decks.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { majorArcanaNumber, resolvePatternWeb } from '../src/lib/journal/patternWeb.js';

test('dyads saved as Major Arcana numbers find their cards', () => {
  const cards = [
    { name: 'The Fool', position: 'Past', orientation: 'Reversed' },
    { name: 'The Magician', position: 'Present' },
    { name: 'Queen of Pentacles', position: 'Future' }
  ];
  const web = resolvePatternWeb(cards, { completeTriadIds: [], dyadPairs: [{ cards: [0, 1], category: 'empowerment' }] }, 'rws-1909');
  assert.deepEqual(web.triads, []);
  assert.equal(web.dyads.length, 1);
  assert.deepEqual(web.dyads[0].indices, [0, 1]);
  assert.equal(web.dyads[0].theme, 'Innocent potential meeting conscious skill');
  assert.equal(web.dyads[0].category, 'empowerment');
});

test('triads resolve through deck aliases', () => {
  const thoth = [
    { name: 'Fortune', position: 'Outcome' },
    { name: 'Lust', position: 'Present' },
    { name: 'The Hermit', position: 'Past' }
  ];
  const web = resolvePatternWeb(thoth, { completeTriadIds: ['strength-hermit-wheel'], dyadPairs: [] }, 'thoth-a1');
  assert.equal(web.triads.length, 1);
  assert.deepEqual(web.triads[0].indices, [1, 2, 0], 'indices follow the triad order: Strength, Hermit, Wheel');
  assert.equal(typeof web.triads[0].theme, 'string');

  const marseille = [{ name: 'Le Mat' }, { name: 'Le Bateleur' }];
  assert.deepEqual(resolvePatternWeb(marseille, { dyadPairs: [{ cards: [1, 0] }] }, 'marseille-classic').dyads[0].indices, [1, 0]);
});

test('a canonical name wins over the deck label', () => {
  assert.equal(majorArcanaNumber({ name: 'Lust', canonicalName: 'Strength' }), 8);
  assert.equal(majorArcanaNumber({ name: 'Ace of Cups' }), null);
  assert.equal(majorArcanaNumber({}), null);
});

test('relationships whose cards are not all in the reading are left out', () => {
  const cards = [{ name: 'Ace of Cups' }, { name: 'The Magician' }];
  const web = resolvePatternWeb(cards, {
    completeTriadIds: ['death-temperance-star', 'not-a-triad'],
    dyadPairs: [{ cards: [0, 1] }, { cards: ['x', 1] }, { cards: [1] }, null]
  }, 'rws-1909');
  assert.deepEqual(web, { triads: [], dyads: [] });
});

test('repeated keys are listed once and malformed input is ignored', () => {
  const cards = [{ name: 'Death' }, { name: 'The Star' }, { name: 'Temperance' }];
  const web = resolvePatternWeb(cards, {
    completeTriadIds: ['death-temperance-star', 'death-temperance-star'],
    dyadPairs: [{ cards: [13, 17] }, { cards: [17, 13] }]
  });
  assert.equal(web.triads.length, 1);
  assert.deepEqual(web.triads[0].indices, [0, 2, 1]);
  assert.equal(web.dyads.length, 1);
  assert.deepEqual(resolvePatternWeb(null, null), { triads: [], dyads: [] });
  assert.deepEqual(resolvePatternWeb(cards, { completeTriadIds: 'death-temperance-star' }), { triads: [], dyads: [] });
});
