import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildJournalCsv } from '../src/lib/journalInsights.js';

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
