import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MIN_REPEAT_COUNT,
  filterRepeated,
  findLeaders,
  findSoleLeader,
  joinNames
} from '../src/lib/journal/leaders.js';
import { generateJourneyStory } from '../src/lib/journalInsights.js';

const cards = (...pairs) => pairs.map(([name, count]) => ({ name, count }));

describe('journal leaders', () => {
  it('names a card only after it repeats', () => {
    assert.equal(MIN_REPEAT_COUNT, 2);
    assert.deepEqual(findLeaders(cards(['The Star', 1], ['Strength', 1])), []);
    assert.equal(findSoleLeader(cards(['The Star', 1])), null);
    assert.deepEqual(findSoleLeader(cards(['Strength', 3], ['The Star', 1])), { name: 'Strength', count: 3 });
  });

  it('keeps a tie whole instead of picking one of the equal cards', () => {
    const tied = cards(['Five of Swords', 2], ['The High Priestess', 2], ['Knight of Cups', 1]);
    assert.deepEqual(findLeaders(tied).map((card) => card.name), ['Five of Swords', 'The High Priestess']);
    assert.equal(findSoleLeader(tied), null);
  });

  it('ignores missing input and unreadable counts', () => {
    assert.deepEqual(findLeaders(null), []);
    assert.deepEqual(findLeaders([]), []);
    assert.deepEqual(findLeaders([{ name: 'A', count: 'x' }, { name: 'B' }]), []);
  });

  it('lists only repeated cards, in order', () => {
    assert.deepEqual(
      filterRepeated(cards(['A', 3], ['B', 1], ['C', 2])).map((card) => card.name),
      ['A', 'C']
    );
    assert.deepEqual(filterRepeated(undefined), []);
  });

  it('joins names as prose', () => {
    assert.equal(joinNames([]), '');
    assert.equal(joinNames(['Self']), 'Self');
    assert.equal(joinNames(['Self', 'Career']), 'Self and Career');
    assert.equal(joinNames(['Self', 'Career', 'Love']), 'Self, Career and Love');
  });
});

describe('journey story accuracy', () => {
  const entries = [
    { ts: 3, context: 'self', cards: [{ name: 'Five of Swords' }, { name: 'The High Priestess' }] },
    { ts: 2, context: 'career', cards: [{ name: 'Five of Swords' }, { name: 'The High Priestess' }] },
    { ts: 1, context: 'love', cards: [{ name: 'Knight of Cups' }] },
  ];

  it('does not single out one of two tied cards or contexts', () => {
    const story = generateJourneyStory(entries, {
      precomputedStats: {
        totalReadings: 3,
        frequentCards: cards(['Five of Swords', 2], ['The High Priestess', 2], ['Knight of Cups', 1]),
        contextBreakdown: cards(['self', 1], ['career', 1], ['love', 1]),
        recentThemes: ['Mixed elemental energies'],
      },
    });
    assert.ok(story, 'three readings with a theme still have a story');
    assert.doesNotMatch(story, /particular significance/);
    assert.doesNotMatch(story, /centered on/);
  });

  it('names a card that leads alone', () => {
    const story = generateJourneyStory(entries, {
      precomputedStats: {
        totalReadings: 3,
        frequentCards: cards(['Five of Swords', 3], ['The High Priestess', 2]),
        contextBreakdown: cards(['self', 2], ['love', 1]),
        recentThemes: [],
      },
    });
    assert.match(story, /Five of Swords has appeared 3 times/);
    assert.match(story, /centered on self matters/);
  });
});
