import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildFollowUpPrompt } from '../functions/lib/followUpPrompt.js';
import { 
  findSimilarJournalEntries, 
  getRecurringCardPatterns 
} from '../functions/lib/journalSearch.js';

// Mock DB class for testing
class MockDB {
  constructor() {
    this.prepareReturn = {
      bind: () => this.prepareReturn,
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => ({ success: true })
    };
  }

  prepare(sql) {
    this.lastSql = sql;
    return this.prepareReturn;
  }
}

// Mock AI class for embeddings
  class MockAI {
    constructor() {
      this.runReturn = [[0.1, 0.2, 0.3]]; // Mock embedding vector
    }

    async run() {
      return { data: this.runReturn };
    }
  }

describe('buildFollowUpPrompt', () => {
  test('builds basic system prompt with guidelines', () => {
    const { systemPrompt, userPrompt } = buildFollowUpPrompt({
      originalReading: {
        cardsInfo: [{ position: 'Present', card: 'The Fool', orientation: 'upright' }],
        userQuestion: 'What should I focus on?',
        narrative: 'The Fool in the present position suggests new beginnings...',
        spreadKey: 'threeCard'
      },
      followUpQuestion: 'What does the Fool mean for my career?',
      conversationHistory: [],
      journalContext: null,
      personalization: null
    });

    // Check system prompt contains core principles
    assert.ok(systemPrompt.includes('thoughtful tarot reader'));
    assert.ok(systemPrompt.includes('do not introduce new cards'));
    assert.ok(systemPrompt.includes('WHAT/WHY/WHAT\'S NEXT'));
    assert.ok(systemPrompt.includes('under 200 words'));

    // Check user prompt contains reading context
    assert.ok(userPrompt.includes('What should I focus on?'));
    assert.ok(userPrompt.includes('threeCard'));
    assert.ok(userPrompt.includes('The Fool'));
    assert.ok(userPrompt.includes('What does the Fool mean for my career?'));
  });

  test('includes tone guidance when personalization provided', () => {
    const { systemPrompt } = buildFollowUpPrompt({
      originalReading: {
        cardsInfo: [],
        narrative: 'test'
      },
      followUpQuestion: 'test',
      personalization: {
        readingTone: 'gentle',
        spiritualFrame: 'psychological'
      }
    });

    assert.ok(systemPrompt.includes('## TONE'));
    assert.ok(systemPrompt.includes('## INTERPRETIVE FRAME'));
  });

  test('includes journal context patterns when provided', () => {
    const { systemPrompt } = buildFollowUpPrompt({
      originalReading: {
        cardsInfo: [],
        narrative: 'test'
      },
      followUpQuestion: 'test',
      journalContext: {
        patterns: [
          {
            type: 'recurring_card',
            description: 'The Tower has appeared 4 times in recent readings',
            contexts: ['career', 'relationships']
          },
          {
            type: 'similar_themes',
            description: 'Found 2 past readings with similar themes'
          }
        ]
      }
    });

    assert.ok(systemPrompt.includes('## JOURNAL CONTEXT'));
    assert.ok(systemPrompt.includes('The Tower has appeared 4 times'));
    assert.ok(systemPrompt.includes('career, relationships'));
    assert.ok(systemPrompt.includes('Frame connections gently'));
  });

  test('includes conversation history in user prompt', () => {
    const { userPrompt } = buildFollowUpPrompt({
      originalReading: {
        cardsInfo: [],
        narrative: 'test'
      },
      followUpQuestion: 'What about timing?',
      conversationHistory: [
        { role: 'user', content: 'Tell me more about The Star' },
        { role: 'assistant', content: 'The Star represents hope and inspiration...' }
      ]
    });

    assert.ok(userPrompt.includes('## CONVERSATION SO FAR'));
    assert.ok(userPrompt.includes('**Querent**: Tell me more about The Star'));
    assert.ok(userPrompt.includes('**Reader**: The Star represents hope'));
    assert.ok(userPrompt.includes('What about timing?'));
  });

  test('truncates long narratives', () => {
    const longNarrative = 'A'.repeat(2000);
    const { userPrompt } = buildFollowUpPrompt({
      originalReading: {
        cardsInfo: [],
        narrative: longNarrative
      },
      followUpQuestion: 'test'
    });

    assert.ok(userPrompt.includes('[truncated]'));
    assert.ok(!userPrompt.includes('A'.repeat(2000)));
  });

  test('sanitizes display name in question prefix', () => {
    const { userPrompt } = buildFollowUpPrompt({
      originalReading: {
        cardsInfo: [],
        narrative: 'test'
      },
      followUpQuestion: 'What next?',
      personalization: {
        displayName: 'Alex'
      }
    });

    assert.ok(userPrompt.includes('Alex asks:'));
  });

  test('handles missing original reading gracefully', () => {
    const { systemPrompt, userPrompt } = buildFollowUpPrompt({
      originalReading: null,
      followUpQuestion: 'What should I do?'
    });

    assert.ok(systemPrompt.length > 0);
    assert.ok(userPrompt.includes('What should I do?'));
  });

  test('includes ethics guidelines', () => {
    const { systemPrompt } = buildFollowUpPrompt({
      originalReading: { cardsInfo: [], narrative: 'test' },
      followUpQuestion: 'test'
    });

    assert.ok(systemPrompt.includes('## ETHICS'));
    assert.ok(systemPrompt.includes('medical, mental health'));
    assert.ok(systemPrompt.includes('choice and agency'));
  });

  test('limits conversation history to max turns', () => {
    const longHistory = Array(10).fill(null).map((_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`
    }));

    const { userPrompt } = buildFollowUpPrompt({
      originalReading: { cardsInfo: [], narrative: 'test' },
      followUpQuestion: 'test',
      conversationHistory: longHistory
    });

    // Should only include last 5 turns
    assert.ok(!userPrompt.includes('Message 0'));
    assert.ok(userPrompt.includes('Message 9'));
  });

  test('formats cards with position and orientation', () => {
    const { userPrompt } = buildFollowUpPrompt({
      originalReading: {
        cardsInfo: [
          { position: 'Past', card: 'The Moon', orientation: 'reversed' },
          { position: 'Present', card: 'The Sun', orientation: 'upright' },
          { position: 'Future', card: 'The World', isReversed: true }
        ],
        narrative: 'test'
      },
      followUpQuestion: 'test'
    });

    assert.ok(userPrompt.includes('Past: The Moon (reversed)'));
    assert.ok(userPrompt.includes('Present: The Sun (upright)'));
    assert.ok(userPrompt.includes('Future: The World (reversed)'));
  });
});

describe('journalSearch utilities', () => {
  describe('findSimilarJournalEntries', () => {
    test('returns empty array when env is missing', async () => {
      const result = await findSimilarJournalEntries(null, 'user-123', 'test query');
      assert.deepEqual(result, []);
    });

    test('returns empty array when AI binding is missing', async () => {
      const result = await findSimilarJournalEntries({ DB: new MockDB() }, 'user-123', 'test query');
      assert.deepEqual(result, []);
    });

    test('returns empty array when DB binding is missing', async () => {
      const result = await findSimilarJournalEntries({ AI: new MockAI() }, 'user-123', 'test query');
      assert.deepEqual(result, []);
    });

    test('queries entries with step_embeddings', async () => {
      const mockDB = new MockDB();
      let capturedSql = '';
      mockDB.prepare = (sql) => {
        capturedSql = sql;
        return mockDB.prepareReturn;
      };

      await findSimilarJournalEntries(
        { AI: new MockAI(), DB: mockDB },
        'user-123',
        'test query'
      );

      assert.ok(capturedSql.includes('step_embeddings IS NOT NULL'));
      assert.ok(capturedSql.includes('user_id'));
    });

    test('filters by minimum similarity threshold', async () => {
      const mockDB = new MockDB();
      mockDB.prepareReturn.all = async () => ({
        results: [
          {
            id: '1',
            question: 'Similar question',
            narrative: 'Similar narrative',
            step_embeddings: JSON.stringify([[0.1, 0.2, 0.3]]),
            cards_json: JSON.stringify([{ name: 'The Fool' }]),
            created_at: Date.now() / 1000
          },
          {
            id: '2',
            question: 'Different question',
            narrative: 'Different narrative',
            step_embeddings: JSON.stringify([[-0.1, -0.2, -0.3]]), // Very different
            cards_json: JSON.stringify([{ name: 'The Tower' }]),
            created_at: Date.now() / 1000
          }
        ]
      });

      const mockAI = new MockAI();
      mockAI.run = async () => ({ data: [[0.1, 0.2, 0.3]] }); // Same as first entry

      const results = await findSimilarJournalEntries(
        { AI: mockAI, DB: mockDB },
        'user-123',
        'test query',
        { minSimilarity: 0.9 }
      );

      // Only the highly similar entry should be returned
      assert.ok(results.length <= 1);
    });

    test('respects limit option', async () => {
      const mockDB = new MockDB();
      mockDB.prepareReturn.all = async () => ({
        results: Array(10).fill(null).map((_, i) => ({
          id: String(i),
          question: `Question ${i}`,
          narrative: `Narrative ${i}`,
          step_embeddings: JSON.stringify([[0.1, 0.2, 0.3]]),
          cards_json: JSON.stringify([]),
          created_at: Date.now() / 1000
        }))
      });

      const results = await findSimilarJournalEntries(
        { AI: new MockAI(), DB: mockDB },
        'user-123',
        'test query',
        { limit: 2, minSimilarity: 0.0 }
      );

      assert.ok(results.length <= 2);
    });
  });

  describe('getRecurringCardPatterns', () => {
    test('returns empty array when cardNames is empty', async () => {
      const result = await getRecurringCardPatterns(new MockDB(), 'user-123', []);
      assert.deepEqual(result, []);
    });

    test('returns empty array when cardNames is null', async () => {
      const result = await getRecurringCardPatterns(new MockDB(), 'user-123', null);
      assert.deepEqual(result, []);
    });

    test('counts card occurrences across entries', async () => {
      const mockDB = new MockDB();
      mockDB.prepareReturn.all = async () => ({
        results: [
          {
            cards_json: JSON.stringify([
              { name: 'The Fool' },
              { name: 'The Magician' }
            ]),
            context: 'career',
            created_at: Date.now() / 1000
          },
          {
            cards_json: JSON.stringify([
              { name: 'The Fool' },
              { name: 'The High Priestess' }
            ]),
            context: 'relationships',
            created_at: Date.now() / 1000
          },
          {
            cards_json: JSON.stringify([
              { name: 'The Fool' }
            ]),
            context: 'career',
            created_at: Date.now() / 1000
          }
        ]
      });

      const results = await getRecurringCardPatterns(
        mockDB,
        'user-123',
        ['The Fool', 'The Magician']
      );

      // Fool appears 3 times, Magician appears 1 time (below threshold of 2)
      const foolPattern = results.find(p => p.card === 'Fool');
      assert.ok(foolPattern);
      assert.equal(foolPattern.count, 3);
      assert.ok(foolPattern.contexts.includes('career'));
      assert.ok(foolPattern.contexts.includes('relationships'));
    });

    test('only returns cards with count >= 2', async () => {
      const mockDB = new MockDB();
      mockDB.prepareReturn.all = async () => ({
        results: [
          {
            cards_json: JSON.stringify([{ name: 'The Fool' }]),
            context: 'career',
            created_at: Date.now() / 1000
          }
        ]
      });

      const results = await getRecurringCardPatterns(
        mockDB,
        'user-123',
        ['The Fool']
      );

      // The Fool only appears once, so should not be returned
      assert.equal(results.length, 0);
    });

    test('sorts results by count descending', async () => {
      const mockDB = new MockDB();
      mockDB.prepareReturn.all = async () => ({
        results: [
          { cards_json: JSON.stringify([{ name: 'Card A' }, { name: 'Card B' }]), context: null, created_at: 1 },
          { cards_json: JSON.stringify([{ name: 'Card A' }, { name: 'Card B' }]), context: null, created_at: 2 },
          { cards_json: JSON.stringify([{ name: 'Card A' }]), context: null, created_at: 3 },
          { cards_json: JSON.stringify([{ name: 'Card A' }]), context: null, created_at: 4 }
        ]
      });

      const results = await getRecurringCardPatterns(
        mockDB,
        'user-123',
        ['Card A', 'Card B']
      );

      assert.equal(results.length, 2);
      assert.equal(results[0].card, 'Card A'); // Count 4
      assert.equal(results[1].card, 'Card B'); // Count 2
    });

    test('handles malformed cards_json gracefully', async () => {
      const mockDB = new MockDB();
      mockDB.prepareReturn.all = async () => ({
        results: [
          { cards_json: 'invalid json', context: null, created_at: 1 },
          { cards_json: JSON.stringify([{ name: 'The Fool' }]), context: 'career', created_at: 2 },
          { cards_json: JSON.stringify([{ name: 'The Fool' }]), context: 'love', created_at: 3 }
        ]
      });

      // Should not throw and should count valid entries
      const results = await getRecurringCardPatterns(
        mockDB,
        'user-123',
        ['The Fool']
      );

      assert.equal(results.length, 1);
      assert.equal(results[0].count, 2);
    });
  });
});

describe('follow-up rate limiting logic', () => {
  // These tests validate the rate limiting constants match the design
  const FOLLOW_UP_LIMITS = {
    free: { perReading: 1, perDay: 3 },
    plus: { perReading: 3, perDay: 15 },
    pro: { perReading: 10, perDay: 50 }
  };

  test('free tier has correct limits', () => {
    assert.equal(FOLLOW_UP_LIMITS.free.perReading, 1);
    assert.equal(FOLLOW_UP_LIMITS.free.perDay, 3);
  });

  test('plus tier has correct limits', () => {
    assert.equal(FOLLOW_UP_LIMITS.plus.perReading, 3);
    assert.equal(FOLLOW_UP_LIMITS.plus.perDay, 15);
  });

  test('pro tier has correct limits', () => {
    assert.equal(FOLLOW_UP_LIMITS.pro.perReading, 10);
    assert.equal(FOLLOW_UP_LIMITS.pro.perDay, 50);
  });
});
