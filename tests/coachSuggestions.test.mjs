import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildPersonalizedSuggestions, describeSuggestionSources } from '../src/lib/coachSuggestions.js';

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

  it('keeps the existing combined wording for journal and history', () => {
    const suggestions = buildPersonalizedSuggestions(
      { frequentCards: [{ name: 'The Fool', count: 2 }] },
      [{ id: 'recent', question: 'Which pace supports me today?' }]
    );

    assert.deepEqual(suggestions.map(suggestion => suggestion.source), ['journal', 'history']);
    assert.equal(
      describeSuggestionSources(suggestions),
      'Based on your journal trends and recent questions.'
    );
  });

  it('combines focus areas with a recent question without claiming journal trends', () => {
    const suggestions = buildPersonalizedSuggestions(
      null,
      [{ id: 'recent', question: 'Which pace supports me today?' }],
      ['career']
    );

    assert.deepEqual(suggestions.map(suggestion => suggestion.source), ['focus', 'history']);
    assert.equal(
      describeSuggestionSources(suggestions),
      'Based on your focus areas and recent questions.'
    );
  });

  it('falls back to neutral copy when no source is known', () => {
    assert.equal(
      describeSuggestionSources([{ id: 'unknown' }]),
      'A few starting points for this reading.'
    );
    assert.equal(describeSuggestionSources([]), 'A few starting points for this reading.');
  });
});
