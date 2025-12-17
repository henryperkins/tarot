import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildJournalCsv,
  buildEntryMarkdown,
  buildJournalMarkdown,
  extractGentleNextSteps,
  buildNextStepsIntentionQuestion,
  computeNextStepsCoachSuggestion,
  computeCoachSuggestionWithEmbeddings,
} from '../src/lib/journalInsights.js';

describe('journal CSV export', () => {
  it('includes all reading details per entry', () => {
    const entry = {
      ts: Date.parse('2024-09-01T12:00:00Z'),
      spread: 'Three-Card Story',
      spreadKey: 'threeCard',
      question: 'How can I navigate this career transition this month?',
      cards: [
        { position: 'Past', name: 'Two of Wands', orientation: 'Upright' },
        { position: 'Present', name: 'Three of Cups', orientation: 'Reversed' },
        { position: 'Future', name: 'Six of Swords', orientation: 'Upright' }
      ],
      context: 'career',
      provider: 'local-composer',
      deckId: 'rws-1909',
      sessionSeed: 'seed123',
      reflections: { notes: 'Felt accurate' },
      themes: { suitFocus: 'Cups & Swords', reversalFramework: 'blocked' },
      personalReading: 'Sample narrative'
    };

    const csv = buildJournalCsv([entry]);
    const lines = csv.trim().split('\n');
    assert.equal(lines.length, 2, 'CSV should include header and one row');

    const headers = lines[0].split(',');
    assert.deepEqual(headers, [
      'Timestamp',
      'Spread',
      'Spread Key',
      'Question',
      'Cards',
      'Context',
      'Provider',
      'Deck',
      'Session Seed',
      'Reflections',
      'Themes',
      'Narrative'
    ]);

    const row = lines[1];
    assert.match(row, /Three-Card Story/);
    assert.match(row, /threeCard/);
    assert.match(row, /career transition/);
    assert.match(row, /Past: Two of Wands/);
    assert.match(row, /local-composer/);
    assert.match(row, /rws-1909/);
    assert.match(row, /seed123/);
    assert.match(row, /"{""notes"":""Felt accurate""}"/);
    assert.match(row, /"{""suitFocus"":""Cups & Swords"",""reversalFramework"":""blocked""}"/);
    assert.match(row, /Sample narrative/);
  });
});

describe('journal Markdown export', () => {
  const sampleEntry = {
    ts: Date.parse('2024-09-01T12:00:00Z'),
    spread: 'Three-Card Story',
    spreadKey: 'threeCard',
    question: 'How can I navigate this career transition?',
    cards: [
      { position: 'Past', name: 'Two of Wands', orientation: 'Upright' },
      { position: 'Present', name: 'Three of Cups', orientation: 'Reversed' },
      { position: 'Future', name: 'Six of Swords', orientation: 'Upright' }
    ],
    context: 'career',
    deckId: 'rws-1909',
    themes: {
      suitFocus: 'Mixed suits emphasize balance',
      elementalBalance: 'Fire and Water in tension'
    },
    reflections: {
      Past: 'This resonated with my planning phase',
      Present: 'Celebration feels blocked'
    },
    personalReading: 'The cards suggest a journey from planning to transition.'
  };

  it('includes YAML frontmatter by default', () => {
    const md = buildEntryMarkdown(sampleEntry);
    assert.match(md, /^---\n/);
    assert.match(md, /date: 2024-09-01/);
    assert.match(md, /spread: "Three-Card Story"/);
    assert.match(md, /spread_key: threeCard/);
    assert.match(md, /context: career/);
    assert.match(md, /cards: \["Two of Wands", "Three of Cups", "Six of Swords"\]/);
    assert.match(md, /tags: \[tarot, reading\]/);
    assert.match(md, /deck: rws-1909/);
    assert.match(md, /\n---\n/);
  });

  it('can omit frontmatter with option', () => {
    const md = buildEntryMarkdown(sampleEntry, { frontmatter: false });
    assert.doesNotMatch(md, /^---\n/);
  });

  it('includes title with spread and date', () => {
    const md = buildEntryMarkdown(sampleEntry);
    assert.match(md, /# Three-Card Story/);
    assert.match(md, /September 1, 2024/);
  });

  it('includes context badge', () => {
    const md = buildEntryMarkdown(sampleEntry);
    assert.match(md, /\*\*Context:\*\* Career/);
  });

  it('includes question as blockquote', () => {
    const md = buildEntryMarkdown(sampleEntry);
    assert.match(md, /## Question/);
    assert.match(md, /> How can I navigate this career transition\?/);
  });

  it('lists cards with positions and reversal markers', () => {
    const md = buildEntryMarkdown(sampleEntry);
    assert.match(md, /## Cards Drawn/);
    assert.match(md, /- \*\*Past:\*\* Two of Wands/);
    assert.match(md, /- \*\*Present:\*\* Three of Cups ↺/);
    assert.match(md, /- \*\*Future:\*\* Six of Swords/);
  });

  it('includes key themes when present', () => {
    const md = buildEntryMarkdown(sampleEntry);
    assert.match(md, /## Key Themes/);
    assert.match(md, /- Mixed suits emphasize balance/);
    assert.match(md, /- Fire and Water in tension/);
  });

  it('can omit themes with option', () => {
    const md = buildEntryMarkdown(sampleEntry, { includeThemes: false });
    assert.doesNotMatch(md, /## Key Themes/);
  });

  it('includes reading narrative', () => {
    const md = buildEntryMarkdown(sampleEntry);
    assert.match(md, /## Reading/);
    assert.match(md, /The cards suggest a journey from planning to transition\./);
  });

  it('can omit narrative with option', () => {
    const md = buildEntryMarkdown(sampleEntry, { includeNarrative: false });
    assert.doesNotMatch(md, /## Reading/);
  });

  it('includes reflections section', () => {
    const md = buildEntryMarkdown(sampleEntry);
    assert.match(md, /## My Reflections/);
    assert.match(md, /\*\*Past:\*\* This resonated with my planning phase/);
    assert.match(md, /\*\*Present:\*\* Celebration feels blocked/);
  });

  it('can omit reflections with option', () => {
    const md = buildEntryMarkdown(sampleEntry, { includeReflections: false });
    assert.doesNotMatch(md, /## My Reflections/);
  });

  it('buildJournalMarkdown combines multiple entries', () => {
    const entry2 = {
      ...sampleEntry,
      ts: Date.parse('2024-09-02T12:00:00Z'),
      spread: 'One-Card Insight'
    };
    const md = buildJournalMarkdown([sampleEntry, entry2]);

    // Should contain both entries separated by ---
    assert.match(md, /# One-Card Insight/);
    assert.match(md, /# Three-Card Story/);
    assert.match(md, /\n---\n\n/);
  });

  it('buildJournalMarkdown sorts entries by timestamp (newest first)', () => {
    const older = { ...sampleEntry, ts: Date.parse('2024-08-01T12:00:00Z'), spread: 'Older Entry' };
    const newer = { ...sampleEntry, ts: Date.parse('2024-09-15T12:00:00Z'), spread: 'Newer Entry' };

    const md = buildJournalMarkdown([older, newer]);
    const newerIndex = md.indexOf('# Newer Entry');
    const olderIndex = md.indexOf('# Older Entry');

    assert.ok(newerIndex < olderIndex, 'Newer entry should appear first');
  });

  it('returns empty string for empty entries array', () => {
    assert.equal(buildJournalMarkdown([]), '');
    assert.equal(buildEntryMarkdown(null), '');
  });
});

describe('Gentle Next Steps extraction', () => {
  it('extracts list items under the Gentle Next Steps section', () => {
    const narrative = [
      '### Opening',
      'A short opening.',
      '',
      '### Gentle Next Steps',
      '- Set a boundary around your time and energy.',
      '- Practice saying no once this week.',
      '',
      '### Closing',
      'A short closing.'
    ].join('\n');

    const steps = extractGentleNextSteps(narrative);
    assert.deepEqual(steps, [
      'Set a boundary around your time and energy.',
      'Practice saying no once this week.',
    ]);
  });

  it('extracts numbered items when present', () => {
    const narrative = [
      '## Gentle Next Steps',
      '1. Rest more.',
      '2. Journal about your fear.',
      '',
      '## Closing',
      'Done.'
    ].join('\n');

    const steps = extractGentleNextSteps(narrative);
    assert.deepEqual(steps, ['Rest more.', 'Journal about your fear.']);
  });
});

describe('Next steps suggestion', () => {
  it('builds an intention question from a next step', () => {
    const question = buildNextStepsIntentionQuestion('Set a boundary around your time.');
    assert.equal(question, 'What would be a gentle next step for me around setting a boundary around my time?');
  });

  it('creates a coach suggestion from the latest next steps', () => {
    const entries = [
      {
        ts: Date.parse('2024-09-03T12:00:00Z'),
        personalReading: [
          '### Opening',
          '...',
          '### Gentle Next Steps',
          '- Set a boundary around your time.',
          '- Rest more.',
          '### Closing',
          '...'
        ].join('\n'),
      },
      {
        ts: Date.parse('2024-09-02T12:00:00Z'),
        personalReading: [
          '### Gentle Next Steps',
          '- Set a boundary at work.',
          '### Closing'
        ].join('\n'),
      },
      {
        ts: Date.parse('2024-09-01T12:00:00Z'),
        personalReading: [
          '### Gentle Next Steps',
          '- Rest more.',
          '### Closing'
        ].join('\n'),
      },
    ];

    const suggestion = computeNextStepsCoachSuggestion(entries, { maxEntries: 3 });
    assert.ok(suggestion);
    assert.equal(suggestion.source, 'nextSteps');
    assert.equal(suggestion.spread, 'threeCard');
    assert.ok(suggestion.question.endsWith('?'));
    assert.match(suggestion.question, /boundar/i);
    assert.doesNotMatch(suggestion.question.toLowerCase(), /\byour\b/);
  });

  it('returns null when no next steps are available', () => {
    const entries = [{ ts: Date.now(), personalReading: '### Opening\nNo steps.\n### Closing' }];
    assert.equal(computeNextStepsCoachSuggestion(entries), null);
  });
});

describe('Embedding-based coach suggestion', () => {
  // Create mock embeddings - simple 4-dimensional vectors for testing
  // Vectors with similar directions should cluster together
  const mockEmbedding1 = [1, 0, 0, 0];  // "boundary" theme
  const mockEmbedding2 = [0.9, 0.1, 0, 0];  // Similar to boundary
  const mockEmbedding3 = [0, 1, 0, 0];  // "rest" theme (orthogonal)
  const mockEmbedding4 = [0, 0.9, 0.1, 0];  // Similar to rest

  it('uses pre-computed embeddings to cluster semantically similar steps', () => {
    const entries = [
      {
        ts: Date.parse('2024-09-03T12:00:00Z'),
        personalReading: '### Gentle Next Steps\n- Set a boundary\n### Closing',
        extractedSteps: ['Set a boundary around my time', 'Practice saying no'],
        stepEmbeddings: [mockEmbedding1, mockEmbedding2],
      },
      {
        ts: Date.parse('2024-09-02T12:00:00Z'),
        personalReading: '### Gentle Next Steps\n- Rest more\n### Closing',
        extractedSteps: ['Rest more', 'Take breaks'],
        stepEmbeddings: [mockEmbedding3, mockEmbedding4],
      },
    ];

    const suggestion = computeCoachSuggestionWithEmbeddings(entries, { maxEntries: 5 });
    assert.ok(suggestion);
    assert.equal(suggestion.source, 'embeddings');
    assert.ok(suggestion.question.endsWith('?'));
    assert.ok(Array.isArray(suggestion.relatedSteps));
    assert.ok(suggestion.relatedSteps.length >= 1);
  });

  it('falls back to heuristic when no embedding data is available', () => {
    const entries = [
      {
        ts: Date.parse('2024-09-03T12:00:00Z'),
        personalReading: [
          '### Gentle Next Steps',
          '- Set a boundary around your time.',
          '### Closing',
        ].join('\n'),
        // No extractedSteps or stepEmbeddings
      },
    ];

    const suggestion = computeCoachSuggestionWithEmbeddings(entries, { maxEntries: 3 });
    // Should fall back to heuristic (source: 'nextSteps')
    assert.ok(suggestion);
    assert.equal(suggestion.source, 'nextSteps');
  });

  it('falls back to extractedSteps when embeddings are missing', () => {
    const entries = [
      {
        ts: Date.parse('2024-09-03T12:00:00Z'),
        personalReading: 'Narrative without a next steps section',
        extractedSteps: ['Set a boundary around my time', 'Practice saying no'],
        stepEmbeddings: null,
      },
    ];

    const suggestion = computeCoachSuggestionWithEmbeddings(entries, { maxEntries: 5 });
    assert.ok(suggestion);
    assert.equal(suggestion.source, 'extractedSteps');
    assert.ok(suggestion.question.endsWith('?'));
  });

  it('returns null when entries array is empty', () => {
    assert.equal(computeCoachSuggestionWithEmbeddings([]), null);
  });

  it('returns null when entries have no valid data', () => {
    const entries = [
      { ts: Date.now(), personalReading: 'No steps section here' },
    ];
    assert.equal(computeCoachSuggestionWithEmbeddings(entries), null);
  });

  it('clusters steps with high cosine similarity together', () => {
    // All embeddings are very similar (same direction)
    const similarEmbedding = [1, 0, 0, 0];
    const entries = [
      {
        ts: Date.parse('2024-09-03T12:00:00Z'),
        personalReading: '### Gentle Next Steps\n- Step 1\n### Closing',
        extractedSteps: ['Set a boundary', 'Protect your energy', 'Say no more often'],
        stepEmbeddings: [similarEmbedding, similarEmbedding, similarEmbedding],
      },
    ];

    const suggestion = computeCoachSuggestionWithEmbeddings(entries, { maxEntries: 5 });
    assert.ok(suggestion);
    // All steps should cluster together since they have identical embeddings
    assert.equal(suggestion.relatedSteps.length, 3);
    assert.equal(suggestion.clusterSize, 3);
  });
});
