// tests/graphRAG.test.mjs
// Tests for GraphRAG (Graph-Enhanced Retrieval-Augmented Generation)
// Run with: npm test -- tests/graphRAG.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  retrievePassages,
  formatPassagesForPrompt,
  buildRetrievalSummary,
  isGraphRAGEnabled,
  getKnowledgeBaseInfo
} from '../functions/lib/graphRAG.js';
import {
  getPassagesForPattern,
  getKnowledgeBaseStats
} from '../functions/lib/knowledgeBase.js';

describe('GraphRAG Knowledge Base', () => {
  test('getKnowledgeBaseStats returns correct counts', () => {
    const stats = getKnowledgeBaseStats();

    assert.ok(stats.triads > 0, 'Should have triad passages');
    assert.ok(stats.foolsJourneyStages > 0, 'Should have Fool\'s Journey passages');
    assert.ok(stats.dyads > 0, 'Should have dyad passages');
    assert.ok(stats.suitProgressions > 0, 'Should have suit progression passages');
    assert.ok(stats.totalPassages > 0, 'Should have total passages');

    // Verify reasonable coverage
    assert.ok(stats.triads >= 5, 'Should have at least 5 major triads');
    assert.strictEqual(stats.foolsJourneyStages, 3, 'Should have 3 Fool\'s Journey stages');
    assert.ok(stats.dyads >= 6, 'Should have at least 6 dyads');
  });

  test('getPassagesForPattern: triad retrieval', () => {
    const entry = getPassagesForPattern('triad', 'death-temperance-star');

    assert.ok(entry, 'Should retrieve Death-Temperance-Star triad');
    assert.strictEqual(entry.title, 'The Healing Arc');
    assert.strictEqual(entry.theme, 'Ending → Integration → Renewal');
    assert.ok(Array.isArray(entry.passages), 'Should have passages array');
    assert.ok(entry.passages.length > 0, 'Should have at least one passage');
    assert.ok(entry.passages[0].text, 'Passage should have text');
    assert.ok(entry.passages[0].source, 'Passage should have source');
    assert.ok(Array.isArray(entry.passages[0].tags), 'Passage should have tags');
  });

  test('getPassagesForPattern: Fool\'s Journey retrieval', () => {
    const entry = getPassagesForPattern('fools-journey', 'integration');

    assert.ok(entry, 'Should retrieve integration stage');
    assert.ok(entry.title.includes('Integration'));
    assert.strictEqual(entry.stage, 'initiation');
    assert.strictEqual(entry.theme, 'Shadow Work & Transformation');
    assert.ok(entry.passages.length > 0);
  });

  test('getPassagesForPattern: dyad retrieval', () => {
    const entry = getPassagesForPattern('dyad', '13-17');

    assert.ok(entry, 'Should retrieve Death + Star dyad');
    assert.deepStrictEqual(entry.cards, [13, 17]);
    assert.deepStrictEqual(entry.names, ['Death', 'The Star']);
    assert.ok(entry.theme.includes('hope') || entry.theme.includes('transformation'));
    assert.ok(entry.passages.length > 0);
  });

  test('getPassagesForPattern: suit progression retrieval', () => {
    const entry = getPassagesForPattern('suit-progression', 'Wands:beginning');

    assert.ok(entry, 'Should retrieve Wands beginning progression');
    assert.ok(entry.title.includes('Wands'));
    assert.ok(entry.passages.length > 0);
  });

  test('getPassagesForPattern: returns null for unknown pattern', () => {
    const entry = getPassagesForPattern('triad', 'nonexistent-triad-id');
    assert.strictEqual(entry, null);
  });
});

describe('GraphRAG Retrieval', () => {
  test('retrievePassages: complete triad (priority 1)', () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star']
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    assert.ok(passages.length > 0, 'Should retrieve passages');
    assert.strictEqual(passages[0].type, 'triad', 'First passage should be triad');
    assert.strictEqual(passages[0].patternId, 'death-temperance-star');
    assert.strictEqual(passages[0].priority, 1, 'Triads should have priority 1');
    assert.ok(passages[0].text, 'Should have text');
    assert.ok(passages[0].source, 'Should have source');
  });

  test('retrievePassages: Fool\'s Journey stage (priority 2)', () => {
    const graphKeys = {
      foolsJourneyStageKey: 'integration'
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    assert.ok(passages.length > 0);
    assert.strictEqual(passages[0].type, 'fools-journey');
    assert.strictEqual(passages[0].patternId, 'integration');
    assert.strictEqual(passages[0].priority, 2, 'Journey should have priority 2');
    assert.strictEqual(passages[0].stage, 'initiation');
  });

  test('retrievePassages: high-significance dyad (priority 3)', () => {
    const graphKeys = {
      dyadPairs: [
        { cards: [13, 17], category: 'transformation', significance: 'high' }
      ]
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    assert.ok(passages.length > 0);
    assert.strictEqual(passages[0].type, 'dyad');
    assert.strictEqual(passages[0].patternId, '13-17');
    assert.strictEqual(passages[0].priority, 3, 'High dyads should have priority 3');
    assert.deepStrictEqual(passages[0].cardNumbers, [13, 17]);
  });

  test('retrievePassages: filters out low-significance dyads', () => {
    const graphKeys = {
      dyadPairs: [
        { cards: [1, 2], category: 'test', significance: 'low' },
        { cards: [13, 17], category: 'transformation', significance: 'high' }
      ]
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    // Should only retrieve the high-significance dyad
    const dyadPassages = passages.filter(p => p.type === 'dyad');
    assert.strictEqual(dyadPassages.length, 1);
    assert.strictEqual(dyadPassages[0].patternId, '13-17');
  });

  test('retrievePassages: suit progression (priority 4)', () => {
    const graphKeys = {
      suitProgressions: [
        { suit: 'Wands', stage: 'beginning', significance: 'strong-progression' }
      ]
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    assert.ok(passages.length > 0);
    assert.strictEqual(passages[0].type, 'suit-progression');
    assert.strictEqual(passages[0].suit, 'Wands');
    assert.strictEqual(passages[0].stage, 'beginning');
    assert.strictEqual(passages[0].priority, 4, 'Suit progressions should have priority 4');
  });

  test('retrievePassages: priority ordering', () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star'],
      foolsJourneyStageKey: 'integration',
      dyadPairs: [{ cards: [13, 17], significance: 'high' }],
      suitProgressions: [{ suit: 'Wands', stage: 'beginning', significance: 'strong-progression' }]
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 10 });

    // Verify priority ordering: triads (1) < journey (2) < dyads (3) < suits (4)
    let lastPriority = 0;
    passages.forEach(passage => {
      assert.ok(passage.priority >= lastPriority, 'Priorities should be in ascending order');
      lastPriority = passage.priority;
    });

    // First passage should be triad (priority 1)
    assert.strictEqual(passages[0].priority, 1);
    assert.strictEqual(passages[0].type, 'triad');
  });

  test('retrievePassages: respects maxPassages limit', () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star', 'devil-tower-sun'],
      foolsJourneyStageKey: 'culmination',
      dyadPairs: [
        { cards: [13, 17], significance: 'high' },
        { cards: [16, 19], significance: 'high' }
      ]
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 2 });

    assert.strictEqual(passages.length, 2, 'Should limit to maxPassages');
    // Should get highest priority passages (triads)
    assert.strictEqual(passages[0].priority, 1);
    assert.strictEqual(passages[1].priority, 1);
  });

  test('retrievePassages: handles empty graphKeys gracefully', () => {
    const passages = retrievePassages({}, { maxPassages: 5 });
    assert.strictEqual(passages.length, 0, 'Should return empty array for empty graphKeys');
  });

  test('retrievePassages: handles null/undefined graphKeys', () => {
    assert.strictEqual(retrievePassages(null).length, 0);
    assert.strictEqual(retrievePassages(undefined).length, 0);
  });

  test('retrievePassages: includes metadata when requested', () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star']
    };

    const passages = retrievePassages(graphKeys, {
      maxPassages: 5,
      includeMetadata: true
    });

    assert.ok(passages[0].metadata, 'Should include metadata');
    assert.strictEqual(passages[0].metadata.triadId, 'death-temperance-star');
    assert.strictEqual(passages[0].metadata.isComplete, true);
  });
});

describe('GraphRAG Formatting', () => {
  test('formatPassagesForPrompt: formats passages as markdown', () => {
    const passages = [
      {
        priority: 1,
        type: 'triad',
        title: 'The Healing Arc',
        text: 'Death clears away what must die...',
        source: 'Rachel Pollack, Seventy-Eight Degrees of Wisdom'
      }
    ];

    const formatted = formatPassagesForPrompt(passages, {
      includeSource: true,
      markdown: true
    });

    assert.ok(formatted.includes('**Retrieved Wisdom from Tarot Tradition:**'));
    assert.ok(formatted.includes('**The Healing Arc**'));
    assert.ok(formatted.includes('"Death clears away what must die..."'));
    assert.ok(formatted.includes('— Rachel Pollack'));
  });

  test('formatPassagesForPrompt: plain text format', () => {
    const passages = [
      {
        priority: 1,
        type: 'triad',
        title: 'The Healing Arc',
        text: 'Death clears away...',
        source: 'Test Source'
      }
    ];

    const formatted = formatPassagesForPrompt(passages, {
      includeSource: true,
      markdown: false
    });

    assert.ok(formatted.includes('Retrieved Wisdom from Tarot Tradition:'));
    assert.ok(!formatted.includes('**'), 'Should not include markdown formatting');
    assert.ok(formatted.includes('(Source: Test Source)'));
  });

  test('formatPassagesForPrompt: omits source when requested', () => {
    const passages = [
      {
        priority: 1,
        type: 'triad',
        title: 'Test',
        text: 'Test text',
        source: 'Should not appear'
      }
    ];

    const formatted = formatPassagesForPrompt(passages, {
      includeSource: false,
      markdown: true
    });

    assert.ok(!formatted.includes('Should not appear'));
    assert.ok(!formatted.includes('—'));
  });

  test('formatPassagesForPrompt: handles empty array', () => {
    const formatted = formatPassagesForPrompt([]);
    assert.strictEqual(formatted, '', 'Should return empty string for empty array');
  });

  test('formatPassagesForPrompt: numbers passages correctly', () => {
    const passages = [
      { priority: 1, title: 'First', text: 'Text 1' },
      { priority: 2, title: 'Second', text: 'Text 2' },
      { priority: 3, title: 'Third', text: 'Text 3' }
    ];

    const formatted = formatPassagesForPrompt(passages);

    assert.ok(formatted.includes('1. **First**'));
    assert.ok(formatted.includes('2. **Second**'));
    assert.ok(formatted.includes('3. **Third**'));
  });
});

describe('GraphRAG Utilities', () => {
  test('buildRetrievalSummary: creates complete summary', () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star'],
      triadIds: ['death-temperance-star', 'hermit-hangedman-moon'],
      foolsJourneyStageKey: 'integration',
      dyadPairs: [
        { cards: [13, 17], significance: 'high' },
        { cards: [1, 2], significance: 'moderate' }
      ],
      suitProgressions: [
        { suit: 'Wands', significance: 'strong-progression' },
        { suit: 'Cups', significance: 'weak-signal' }
      ]
    };

    const passages = [
      { type: 'triad', priority: 1 },
      { type: 'fools-journey', priority: 2 },
      { type: 'dyad', priority: 3 }
    ];

    const summary = buildRetrievalSummary(graphKeys, passages);

    assert.strictEqual(summary.graphKeysProvided, true);
    assert.strictEqual(summary.patternsDetected.completeTriads, 1);
    assert.strictEqual(summary.patternsDetected.partialTriads, 1);
    assert.strictEqual(summary.patternsDetected.foolsJourneyStage, 'integration');
    assert.strictEqual(summary.patternsDetected.highDyads, 1);
    assert.strictEqual(summary.patternsDetected.strongSuitProgressions, 1);
    assert.strictEqual(summary.passagesRetrieved, 3);
    assert.strictEqual(summary.passagesByType.triad, 1);
    assert.strictEqual(summary.passagesByType['fools-journey'], 1);
    assert.strictEqual(summary.passagesByType.dyad, 1);
  });

  test('buildRetrievalSummary: handles empty inputs', () => {
    const summary = buildRetrievalSummary(null, []);

    assert.strictEqual(summary.graphKeysProvided, false);
    assert.strictEqual(summary.passagesRetrieved, 0);
  });

  test('isGraphRAGEnabled: returns boolean', () => {
    const enabled = isGraphRAGEnabled();
    assert.strictEqual(typeof enabled, 'boolean');
  });

  test('getKnowledgeBaseInfo: returns stats', () => {
    const info = getKnowledgeBaseInfo();
    assert.ok(info.triads > 0);
    assert.ok(info.totalPassages > 0);
  });
});

describe('GraphRAG Integration Test', () => {
  test('Full GraphRAG flow: Death-Temperance-Star spread', () => {
    // Simulate graphKeys from a Death-Temperance-Star spread
    const graphKeys = {
      completeTriadIds: ['death-temperance-star'],
      triadIds: ['death-temperance-star'],
      foolsJourneyStageKey: 'integration',
      foolsJourneyStage: 'initiation',
      dyadPairs: [
        { cards: [13, 17], category: 'transformation', significance: 'high' }
      ],
      suitProgressions: [],
      courtLineages: []
    };

    // Step 1: Retrieve passages
    const passages = retrievePassages(graphKeys, { maxPassages: 3 });

    assert.ok(passages.length > 0, 'Should retrieve passages');
    assert.ok(passages.length <= 3, 'Should respect max limit');

    // Step 2: Verify priority ordering
    assert.strictEqual(passages[0].type, 'triad', 'Highest priority should be triad');
    assert.strictEqual(passages[0].title, 'The Healing Arc');

    // Step 3: Format for prompt
    const formatted = formatPassagesForPrompt(passages);

    assert.ok(formatted.length > 0, 'Should produce formatted output');
    assert.ok(formatted.includes('Retrieved Wisdom'), 'Should include header');
    assert.ok(formatted.includes('Healing Arc'), 'Should include triad title');

    // Step 4: Build summary
    const summary = buildRetrievalSummary(graphKeys, passages);

    assert.strictEqual(summary.patternsDetected.completeTriads, 1);
    assert.ok(summary.passagesRetrieved >= 1);
  });

  test('Full GraphRAG flow: Mixed Major spread (Journey + Dyads)', () => {
    const graphKeys = {
      completeTriadIds: [],
      triadIds: [],
      foolsJourneyStageKey: 'culmination',
      foolsJourneyStage: 'return',
      dyadPairs: [
        { cards: [15, 16], category: 'challenge', significance: 'high' },
        { cards: [16, 19], category: 'transformation', significance: 'high' }
      ],
      suitProgressions: [],
      courtLineages: []
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    // Should retrieve Journey + dyads
    assert.ok(passages.length >= 2, 'Should retrieve multiple passage types');

    const journeyPassages = passages.filter(p => p.type === 'fools-journey');
    const dyadPassages = passages.filter(p => p.type === 'dyad');

    assert.ok(journeyPassages.length > 0, 'Should include Journey passages');
    assert.ok(dyadPassages.length > 0, 'Should include dyad passages');

    // Journey should come before dyads (priority 2 < priority 3)
    if (passages.length >= 2) {
      const firstJourney = passages.findIndex(p => p.type === 'fools-journey');
      const firstDyad = passages.findIndex(p => p.type === 'dyad');
      if (firstJourney !== -1 && firstDyad !== -1) {
        assert.ok(firstJourney < firstDyad, 'Journey should precede dyads');
      }
    }
  });
});
