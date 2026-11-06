import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildPersonalizedSuggestions,
  dedupeSuggestions,
  describeSuggestionSources,
  rotateSuggestionWindow
} from '../src/lib/coachSuggestions.js';
import { selectCoachStatsSource } from '../src/lib/journalInsights.js';

describe('Coach suggestion provenance', () => {
  it('attributes a focus-area-only list to focus areas', () => {
    const suggestions = buildPersonalizedSuggestions(null, [], ['career', 'love', 'healing']);

    assert.equal(suggestions.length, 3);
    assert.ok(suggestions.every(suggestion => suggestion.source === 'focus'));
    assert.equal(describeSuggestionSources(suggestions), 'Based on your focus areas.');
  });

  it('names journal trends when a frequent card supplies the list', () => {
    const suggestions = buildPersonalizedSuggestions({
      frequentCards: [{ name: 'The Fool', count: 2 }]
    });

    assert.equal(suggestions[0].source, 'journal');
    assert.equal(describeSuggestionSources(suggestions), 'Based on your journal trends.');
  });

  it('does not re-offer the last coach question as a suggestion', () => {
    const lastQuestion = 'Which pace supports me today?';
    const suggestions = buildPersonalizedSuggestions(
      { frequentCards: [{ name: 'The Fool', count: 2 }] },
      [{ id: 'recent', question: lastQuestion }]
    );

    assert.ok(suggestions.every(suggestion => suggestion.source !== 'history'));
    assert.ok(suggestions.every(suggestion => suggestion.question !== lastQuestion));
    assert.equal(describeSuggestionSources(suggestions), 'Based on your journal trends.');
  });

  it('drops a candidate whose question was already asked through the coach', () => {
    const suggestions = buildPersonalizedSuggestions(
      { frequentCards: [{ name: 'The Fool', count: 2 }] },
      [{ id: 'recent', question: 'What is The Fool inviting me to embody next?' }]
    );

    assert.equal(suggestions.length, 0);
  });

  it('keeps focus areas in the pool when journal signals exist', () => {
    const suggestions = buildPersonalizedSuggestions(
      { frequentCards: [{ name: 'The Fool', count: 2 }] },
      [],
      ['career']
    );

    assert.deepEqual(suggestions.map(suggestion => suggestion.source), ['journal', 'focus']);
    assert.equal(
      describeSuggestionSources(suggestions),
      'Based on your journal trends and focus areas.'
    );
  });

  it('varies the question angle with the rotation offset', () => {
    const stats = { frequentCards: [{ name: 'The Fool', count: 2 }] };
    const first = buildPersonalizedSuggestions(stats, [], [], { angleOffset: 0 });
    const second = buildPersonalizedSuggestions(stats, [], [], { angleOffset: 1 });

    assert.notEqual(first[0].question, second[0].question);
    assert.match(second[0].question, /The Fool/);
  });

  it('falls back to neutral copy when no source is known', () => {
    assert.equal(
      describeSuggestionSources([{ id: 'unknown' }]),
      'A few starting points for this reading.'
    );
    assert.equal(describeSuggestionSources([]), 'A few starting points for this reading.');
  });
});

describe('dedupeSuggestions', () => {
  it('keeps the first of duplicate questions and focus pairings', () => {
    const result = dedupeSuggestions([
      { id: 'a', question: 'What next?' },
      { id: 'b', question: '  what next? ' },
      { id: 'c', customFocus: 'my work', topic: 'career' },
      { id: 'd', customFocus: 'My Work', topic: 'career' },
      { id: 'e', question: 'Something else?' }
    ]);

    assert.deepEqual(result.map(item => item.id), ['a', 'c', 'e']);
  });
});

describe('rotateSuggestionWindow', () => {
  it('wraps around the pool and never returns an empty window', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];

    assert.deepEqual(rotateSuggestionWindow(pool, 0), ['a', 'b', 'c']);
    assert.deepEqual(rotateSuggestionWindow(pool, 3), ['d', 'e', 'a']);
    assert.deepEqual(rotateSuggestionWindow(pool, 9), ['e', 'a', 'b']);
    assert.deepEqual(rotateSuggestionWindow([], 3), []);
    assert.deepEqual(rotateSuggestionWindow(['only'], 5), ['only']);
  });
});

describe('selectCoachStatsSource', () => {
  const snapshot = (updatedAt, meta = {}) => ({ stats: { totalReadings: 4 }, meta, updatedAt });
  const insights = updatedAt => ({ stats: { totalReadings: 9 }, updatedAt });

  it('prefers the fresher insights cache over an older Journey snapshot', () => {
    const chosen = selectCoachStatsSource(snapshot(100), insights(200));

    assert.equal(chosen.source, 'insights');
    assert.equal(chosen.stats.totalReadings, 9);
    assert.equal(chosen.meta.entryCount, 9);
  });

  it('prefers a fresher snapshot and keeps its meta', () => {
    const chosen = selectCoachStatsSource(snapshot(300, { filterLabel: 'Entire journal' }), insights(200));

    assert.equal(chosen.source, 'snapshot');
    assert.equal(chosen.meta.filterLabel, 'Entire journal');
  });

  it('never uses a filtered Journey snapshot', () => {
    const chosen = selectCoachStatsSource(snapshot(300, { filtersActive: true }), insights(200));

    assert.equal(chosen.source, 'insights');
  });

  it('returns null when only a filtered snapshot exists', () => {
    assert.equal(selectCoachStatsSource(snapshot(300, { filtersActive: true }), null), null);
    assert.equal(selectCoachStatsSource(null, null), null);
  });
});
