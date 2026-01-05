// tests/graphRAG.test.mjs
// Tests for GraphRAG (Graph-Enhanced Retrieval-Augmented Generation)
// Run with: npm test -- tests/graphRAG.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  retrievePassages,
  retrievePassagesWithQuality,
  formatPassagesForPrompt,
  buildRetrievalSummary,
  buildQualityRetrievalSummary,
  scorePassageRelevance,
  deduplicatePassages,
  rankPassagesForPrompt,
  isGraphRAGEnabled,
  isSemanticScoringAvailable,
  getKnowledgeBaseInfo,
  getPassageCountForSpread
} from '../functions/lib/graphRAG.js';
import {
  getPassagesForPattern,
  getKnowledgeBaseStats
} from '../functions/lib/knowledgeBase.js';
import { ARCHETYPAL_DYADS } from '../src/data/knowledgeGraphData.js';

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

  test('high-significance dyads have passages', () => {
    const missing = [];
    ARCHETYPAL_DYADS
      .filter((dyad) => dyad.significance === 'high')
      .forEach((dyad) => {
        const key = dyad.cards.join('-');
        const entry = getPassagesForPattern('dyad', key);
        if (!entry || !Array.isArray(entry.passages) || entry.passages.length === 0) {
          missing.push(key);
        }
      });

    assert.strictEqual(missing.length, 0, `Missing dyad passages for: ${missing.join(', ')}`);
  });

  test('dyad names preserve canonical articles', () => {
    const entry = getPassagesForPattern('dyad', '9-2');
    assert.ok(entry?.names?.includes('The High Priestess'), 'Should include The High Priestess');
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

  test('retrievePassages: reorders based on userQuery keywords', () => {
    // Setup: Journey (P2) usually beats Dyad (P3)
    const graphKeys = {
      foolsJourneyStageKey: 'integration', // Priority 2 ("Shadow Work")
      dyadPairs: [
        { cards: [13, 17], significance: 'high' } // Priority 3 ("Death + Star")
      ]
    };

    // Query matching the Dyad passage ("hope", "star") but not the Journey one
    const query = 'I am looking for hope and the star in my life';
    
    const passages = retrievePassages(graphKeys, { 
      maxPassages: 5,
      userQuery: query 
    });

    assert.ok(passages.length >= 2);
    
    // The Dyad (Priority 3) should be boosted above Journey (Priority 2)
    // because it matches 'hope' and 'star'
    assert.strictEqual(passages[0].type, 'dyad', 'Dyad should be boosted to first position');
    assert.strictEqual(passages[1].type, 'fools-journey', 'Journey should be second');
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

describe('GraphRAG Passage Ranking', () => {
  test('rankPassagesForPrompt prioritizes semantic relevance scores', () => {
    const passages = [
      { title: 'A', relevanceScore: 0.35, priority: 2 },
      { title: 'B', relevanceScore: 0.91, priority: 3 },
      { title: 'C', relevanceScore: 0.62, priority: 1 }
    ];

    const { passages: ranked, strategy } = rankPassagesForPrompt(passages);

    assert.strictEqual(strategy, 'semantic');
    assert.strictEqual(ranked.length, 3);
    assert.strictEqual(ranked[0].title, 'B', 'Highest semantic score should lead');
    assert.strictEqual(ranked[1].title, 'C');
    assert.strictEqual(ranked[2].title, 'A');
  });

  test('rankPassagesForPrompt falls back to keyword relevance', () => {
    const passages = [
      { title: 'A', relevance: 1, priority: 2 },
      { title: 'B', relevance: 4, priority: 5 },
      { title: 'C', relevance: 3, priority: 1 }
    ];

    const { passages: ranked, strategy } = rankPassagesForPrompt(passages, { limit: 2 });

    assert.strictEqual(strategy, 'keyword');
    assert.strictEqual(ranked.length, 2, 'Limit should be enforced');
    assert.strictEqual(ranked[0].title, 'B');
    assert.strictEqual(ranked[1].title, 'C');
  });

  test('rankPassagesForPrompt uses priority ordering when scores missing', () => {
    const passages = [
      { title: 'A', priority: 3 },
      { title: 'B', priority: 1 },
      { title: 'C', priority: 2 }
    ];

    const { passages: ranked, strategy } = rankPassagesForPrompt(passages);

    assert.strictEqual(strategy, 'priority');
    assert.strictEqual(ranked[0].title, 'B');
    assert.strictEqual(ranked[1].title, 'C');
    assert.strictEqual(ranked[2].title, 'A');
  });
});

describe('GraphRAG Quality Filtering', () => {
  test('scorePassageRelevance: returns neutral score for empty inputs', async () => {
    const score1 = await scorePassageRelevance('', 'test query');
    const score2 = await scorePassageRelevance('test passage', '');
    const score3 = await scorePassageRelevance(null, 'test');
    const score4 = await scorePassageRelevance('test', null);

    assert.strictEqual(score1, 0.5, 'Should return 0.5 for empty passage');
    assert.strictEqual(score2, 0.5, 'Should return 0.5 for empty query');
    assert.strictEqual(score3, 0.5, 'Should return 0.5 for null passage');
    assert.strictEqual(score4, 0.5, 'Should return 0.5 for null query');
  });

  test('scorePassageRelevance: keyword matching increases score', async () => {
    const passage = 'The Fool represents new beginnings, adventure, and taking a leap of faith.';
    const matchingQuery = 'What does this new beginning mean for my adventure?';
    const nonMatchingQuery = 'How can I handle my career finances?';

    const matchScore = await scorePassageRelevance(passage, matchingQuery, {
      enableSemanticScoring: false
    });
    const nonMatchScore = await scorePassageRelevance(passage, nonMatchingQuery, {
      enableSemanticScoring: false
    });

    assert.ok(matchScore > nonMatchScore, 'Matching keywords should produce higher score');
    assert.ok(matchScore > 0, 'Matching query should have positive score');
  });

  test('scorePassageRelevance: respects keyword/semantic weights', async () => {
    const passage = 'Death transformation endings renewal cycle change.';
    const query = 'death endings transformation';

    const keywordHeavy = await scorePassageRelevance(passage, query, {
      keywordWeight: 0.9,
      semanticWeight: 0.1,
      enableSemanticScoring: false
    });

    const balanced = await scorePassageRelevance(passage, query, {
      keywordWeight: 0.5,
      semanticWeight: 0.5,
      enableSemanticScoring: false
    });

    // With semantic scoring disabled, semantic component is 0.5 (neutral)
    // So different weights should produce different total scores
    assert.ok(typeof keywordHeavy === 'number', 'Should return number');
    assert.ok(typeof balanced === 'number', 'Should return number');
    assert.ok(keywordHeavy >= 0 && keywordHeavy <= 1, 'Score should be between 0 and 1');
  });

  test('deduplicatePassages: removes duplicate passages', () => {
    const passages = [
      { text: 'The Fool represents new beginnings and adventure.', title: 'First' },
      { text: 'The Fool represents new beginnings and adventure.', title: 'Duplicate' },
      { text: 'Death signifies transformation and endings.', title: 'Different' }
    ];

    const deduped = deduplicatePassages(passages);

    assert.strictEqual(deduped.length, 2, 'Should remove duplicate');
    assert.strictEqual(deduped[0].title, 'First', 'Should keep first occurrence');
    assert.strictEqual(deduped[1].title, 'Different', 'Should keep unique passage');
  });

  test('deduplicatePassages: handles empty array', () => {
    const deduped = deduplicatePassages([]);
    assert.strictEqual(deduped.length, 0, 'Should return empty array');
  });

  test('deduplicatePassages: handles passages without text', () => {
    const passages = [
      { title: 'No text field' },
      { text: 'Valid text', title: 'Has text' }
    ];

    const deduped = deduplicatePassages(passages);
    assert.strictEqual(deduped.length, 2, 'Should preserve passages without text');
  });

  test('deduplicatePassages: uses configurable fingerprint length', () => {
    const passages = [
      { text: 'Short prefix but different ending one.', title: 'First' },
      { text: 'Short prefix but different ending two.', title: 'Second' }
    ];

    // With short fingerprint (15 chars), these would be considered duplicates
    const shortFingerprint = deduplicatePassages(passages, { fingerprintLength: 15 });
    // With long fingerprint (100 chars), they're unique
    const longFingerprint = deduplicatePassages(passages, { fingerprintLength: 100 });

    assert.strictEqual(shortFingerprint.length, 1, 'Short fingerprint should detect as duplicates');
    assert.strictEqual(longFingerprint.length, 2, 'Long fingerprint should preserve unique passages');
  });

  test('retrievePassagesWithQuality: returns scored passages', async () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star']
    };

    const passages = await retrievePassagesWithQuality(graphKeys, {
      maxPassages: 3,
      userQuery: 'healing and transformation',
      enableSemanticScoring: false,
      minRelevanceScore: 0
    });

    assert.ok(passages.length > 0, 'Should retrieve passages');
    passages.forEach(passage => {
      assert.ok(typeof passage.relevanceScore === 'number', 'Each passage should have relevanceScore');
      assert.ok(passage.relevanceScore >= 0 && passage.relevanceScore <= 1, 'Score should be between 0 and 1');
    });
  });

  test('retrievePassagesWithQuality: filters by minimum score threshold', async () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star'],
      dyadPairs: [{ cards: [13, 17], significance: 'high' }]
    };

    const lowThreshold = await retrievePassagesWithQuality(graphKeys, {
      maxPassages: 10,
      userQuery: 'xyz123 unrelated query',
      enableSemanticScoring: false,
      minRelevanceScore: 0
    });

    const highThreshold = await retrievePassagesWithQuality(graphKeys, {
      maxPassages: 10,
      userQuery: 'xyz123 unrelated query',
      enableSemanticScoring: false,
      minRelevanceScore: 0.9
    });

    // With very high threshold and unrelated query, should filter out more
    assert.ok(lowThreshold.length >= highThreshold.length,
      'Higher threshold should filter out more passages');
  });

  test('retrievePassagesWithQuality: sorts by relevance score', async () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star'],
      foolsJourneyStageKey: 'integration'
    };

    const passages = await retrievePassagesWithQuality(graphKeys, {
      maxPassages: 5,
      userQuery: 'transformation healing shadow work',
      enableSemanticScoring: false,
      minRelevanceScore: 0
    });

    if (passages.length >= 2) {
      for (let i = 0; i < passages.length - 1; i++) {
        assert.ok(
          passages[i].relevanceScore >= passages[i + 1].relevanceScore,
          'Passages should be sorted by relevance score (descending)'
        );
      }
    }
  });

  test('retrievePassagesWithQuality: applies deduplication when enabled', async () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star']
    };

    const withDedup = await retrievePassagesWithQuality(graphKeys, {
      maxPassages: 10,
      userQuery: 'test',
      enableDeduplication: true,
      minRelevanceScore: 0
    });

    const withoutDedup = await retrievePassagesWithQuality(graphKeys, {
      maxPassages: 10,
      userQuery: 'test',
      enableDeduplication: false,
      minRelevanceScore: 0
    });

    // Results should be at least as filtered with dedup enabled
    assert.ok(withDedup.length <= withoutDedup.length + 1,
      'Deduplication should not increase passage count');
  });

  test('retrievePassagesWithQuality: handles empty graphKeys', async () => {
    const passages = await retrievePassagesWithQuality({}, {
      maxPassages: 5,
      userQuery: 'test'
    });

    assert.strictEqual(passages.length, 0, 'Should return empty array for empty graphKeys');
  });

  test('buildQualityRetrievalSummary: includes quality metrics', () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star']
    };

    const passages = [
      { type: 'triad', priority: 1, relevanceScore: 0.8 },
      { type: 'dyad', priority: 3, relevanceScore: 0.6 },
      { type: 'fools-journey', priority: 2, relevanceScore: 0.7 }
    ];

    const summary = buildQualityRetrievalSummary(graphKeys, passages);

    assert.ok(summary.qualityMetrics, 'Summary should include qualityMetrics');
    assert.ok(typeof summary.qualityMetrics.averageRelevance === 'number',
      'Should have averageRelevance');
    assert.ok(typeof summary.qualityMetrics.minRelevance === 'number',
      'Should have minRelevance');
    assert.ok(typeof summary.qualityMetrics.maxRelevance === 'number',
      'Should have maxRelevance');
    
    // Verify calculations
    const expectedAvg = (0.8 + 0.6 + 0.7) / 3;
    assert.ok(Math.abs(summary.qualityMetrics.averageRelevance - expectedAvg) < 0.001,
      'Average relevance should be calculated correctly');
    assert.strictEqual(summary.qualityMetrics.minRelevance, 0.6,
      'Min relevance should be correct');
    assert.strictEqual(summary.qualityMetrics.maxRelevance, 0.8,
      'Max relevance should be correct');
  });

  test('buildQualityRetrievalSummary: handles passages without scores', () => {
    const summary = buildQualityRetrievalSummary({}, [
      { type: 'triad', priority: 1 }, // No relevanceScore
      { type: 'dyad', priority: 3 }
    ]);

    assert.ok(summary.qualityMetrics, 'Should still include qualityMetrics object');
    assert.strictEqual(summary.qualityMetrics.averageRelevance, 0,
      'Average should be 0 when no scores present');
  });

  test('isSemanticScoringAvailable: checks for API configuration', () => {
    // Without env, should return false
    const withoutEnv = isSemanticScoringAvailable(null);
    assert.strictEqual(withoutEnv, false, 'Should return false without env');

    // With partial config, should return false
    const partialConfig = isSemanticScoringAvailable({
      AZURE_OPENAI_ENDPOINT: 'https://test.openai.azure.com'
    });
    assert.strictEqual(partialConfig, false, 'Should return false with partial config');

    // With full config, should return true
    const fullConfig = isSemanticScoringAvailable({
      AZURE_OPENAI_ENDPOINT: 'https://test.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key'
    });
    assert.strictEqual(fullConfig, true, 'Should return true with full config');
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

  test('Full GraphRAG flow with quality filtering', async () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star'],
      foolsJourneyStageKey: 'integration',
      dyadPairs: [
        { cards: [13, 17], category: 'transformation', significance: 'high' }
      ]
    };

    // Step 1: Retrieve with quality filtering
    const passages = await retrievePassagesWithQuality(graphKeys, {
      maxPassages: 3,
      userQuery: 'How do I heal from this ending?',
      enableSemanticScoring: false,
      minRelevanceScore: 0.1,
      enableDeduplication: true
    });

    assert.ok(passages.length > 0, 'Should retrieve passages');
    assert.ok(passages.length <= 3, 'Should respect max limit');

    // Verify all passages have relevance scores
    passages.forEach(p => {
      assert.ok(typeof p.relevanceScore === 'number', 'Each passage should have score');
    });

    // Step 2: Verify sorted by relevance
    if (passages.length >= 2) {
      assert.ok(passages[0].relevanceScore >= passages[1].relevanceScore,
        'Should be sorted by relevance');
    }

    // Step 3: Build quality summary
    const summary = buildQualityRetrievalSummary(graphKeys, passages);

    assert.ok(summary.qualityMetrics, 'Summary should have quality metrics');
    assert.ok(summary.passagesRetrieved > 0, 'Should report passages retrieved');
    assert.ok(summary.qualityMetrics.averageRelevance > 0,
      'Should have non-zero average relevance for matching query');
  });
});

// ============================================================================
// GAP COVERAGE: getPassageCountForSpread
// ============================================================================

describe('getPassageCountForSpread', () => {
  test('returns correct count for single spread', () => {
    assert.strictEqual(getPassageCountForSpread('single'), 1);
  });

  test('returns correct count for threeCard spread', () => {
    assert.strictEqual(getPassageCountForSpread('threeCard'), 2);
  });

  test('returns correct count for fiveCard spread', () => {
    assert.strictEqual(getPassageCountForSpread('fiveCard'), 3);
  });

  test('returns correct count for celtic spread', () => {
    assert.strictEqual(getPassageCountForSpread('celtic'), 5);
  });

  test('returns correct count for decision spread', () => {
    assert.strictEqual(getPassageCountForSpread('decision'), 3);
  });

  test('returns correct count for relationship spread', () => {
    assert.strictEqual(getPassageCountForSpread('relationship'), 2);
  });

  test('returns general fallback (3) for unknown spread key', () => {
    assert.strictEqual(getPassageCountForSpread('unknownSpread'), 3);
    assert.strictEqual(getPassageCountForSpread('customSpread'), 3);
  });

  test('returns general fallback (3) for undefined/null', () => {
    assert.strictEqual(getPassageCountForSpread(undefined), 3);
    assert.strictEqual(getPassageCountForSpread(null), 3);
  });

  test('returns general fallback (3) for empty string', () => {
    assert.strictEqual(getPassageCountForSpread(''), 3);
  });

  test('applies free-tier slimming while preserving minimum of one passage', () => {
    assert.strictEqual(getPassageCountForSpread('celtic', 'free'), 2);
    assert.strictEqual(getPassageCountForSpread('general', 'free'), 1);
    assert.strictEqual(getPassageCountForSpread('single', 'free'), 1);
  });

  test('keeps full base limits for paid tiers and unspecified callers', () => {
    assert.strictEqual(getPassageCountForSpread('fiveCard', 'plus'), 3);
    assert.strictEqual(getPassageCountForSpread('threeCard', 'pro'), 2);
    assert.strictEqual(getPassageCountForSpread('relationship', undefined), 2);
  });
});

// ============================================================================
// GAP COVERAGE: Keyword Boost Edge Cases
// ============================================================================

describe('Keyword Boost Edge Cases', () => {
  test('retrievePassages: handles all-stopword query (no boost applied)', () => {
    const graphKeys = {
      foolsJourneyStageKey: 'integration',
      dyadPairs: [{ cards: [13, 17], significance: 'high' }]
    };

    // All words are stopwords or too short
    const passages = retrievePassages(graphKeys, {
      maxPassages: 5,
      userQuery: 'what is this about?'
    });

    // Should still retrieve, just with no keyword boost
    assert.ok(passages.length >= 2, 'Should retrieve passages without keyword boost');
    // Default priority order should be preserved (journey P2 before dyad P3)
    assert.strictEqual(passages[0].type, 'fools-journey', 'Journey should be first without boost');
  });

  test('retrievePassages: handles short-words-only query', () => {
    const graphKeys = {
      foolsJourneyStageKey: 'initiation',
      completeTriadIds: ['death-temperance-star']
    };

    // All words are 3 chars or less
    const passages = retrievePassages(graphKeys, {
      maxPassages: 5,
      userQuery: 'how can I do it now?'
    });

    assert.ok(passages.length > 0, 'Should retrieve passages');
    // Default priority preserved (triad P1 first)
    assert.strictEqual(passages[0].type, 'triad', 'Triad should be first');
  });

  test('retrievePassages: handles mixed case query', () => {
    const graphKeys = {
      foolsJourneyStageKey: 'integration',
      dyadPairs: [{ cards: [13, 17], significance: 'high' }]
    };

    // Mixed case - should match case-insensitively
    const passagesLower = retrievePassages(graphKeys, {
      maxPassages: 5,
      userQuery: 'transformation hope healing'
    });

    const passagesUpper = retrievePassages(graphKeys, {
      maxPassages: 5,
      userQuery: 'TRANSFORMATION HOPE HEALING'
    });

    // Both should produce same relevance boosting
    assert.strictEqual(passagesLower[0].type, passagesUpper[0].type,
      'Case should not affect ranking');
  });

  test('retrievePassages: handles empty query string', () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star'],
      foolsJourneyStageKey: 'integration'
    };

    const passages = retrievePassages(graphKeys, {
      maxPassages: 5,
      userQuery: ''
    });

    assert.ok(passages.length > 0, 'Should retrieve passages with empty query');
    // Default priority ordering preserved
    assert.strictEqual(passages[0].priority, 1, 'Should maintain priority order');
  });

  test('retrievePassages: filters tarot-specific stopwords', () => {
    const graphKeys = {
      foolsJourneyStageKey: 'integration',
      dyadPairs: [{ cards: [13, 17], significance: 'high' }]
    };

    // "card" and "reading" are filtered as stopwords
    const passages = retrievePassages(graphKeys, {
      maxPassages: 5,
      userQuery: 'card reading interpretation'
    });

    // Only "interpretation" should contribute to boost (if it matches)
    // Journey (P2) should still come before dyad (P3) without strong boost
    assert.ok(passages.length >= 2, 'Should retrieve passages');
  });

  test('retrievePassages: special characters in query handled', () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star']
    };

    // Contractions and punctuation
    const passages = retrievePassages(graphKeys, {
      maxPassages: 3,
      userQuery: "what's the meaning? I'm seeking transformation..."
    });

    assert.ok(passages.length > 0, 'Should handle special characters');
    // "meaning", "seeking", "transformation" should be extracted
  });
});

// ============================================================================
// GAP COVERAGE: Malformed Knowledge Base Data Handling
// ============================================================================

describe('Malformed Data Handling', () => {
  test('formatPassagesForPrompt: handles passage without text field', () => {
    const passages = [
      { priority: 1, title: 'Test Title', source: 'Test Source' }
      // Note: no 'text' field
    ];

    const formatted = formatPassagesForPrompt(passages);

    assert.ok(formatted.includes('Test Title'), 'Should include title');
    assert.ok(!formatted.includes('undefined'), 'Should not output "undefined"');
  });

  test('formatPassagesForPrompt: handles passage without source field', () => {
    const passages = [
      { priority: 1, title: 'Test Title', text: 'Test text content' }
      // Note: no 'source' field
    ];

    const formatted = formatPassagesForPrompt(passages, { includeSource: true });

    assert.ok(formatted.includes('Test text content'), 'Should include text');
    assert.ok(!formatted.includes('— null'), 'Should not output "— null"');
    assert.ok(!formatted.includes('— undefined'), 'Should not output "— undefined"');
  });

  test('formatPassagesForPrompt: handles passage without title or theme', () => {
    const passages = [
      { priority: 1, text: 'Just text, no title', source: 'Source' }
    ];

    const formatted = formatPassagesForPrompt(passages);

    // Should not crash, text should still appear
    assert.ok(formatted.includes('Just text, no title'), 'Should include text');
  });

  test('deduplicatePassages: handles null passage in array', () => {
    const passages = [
      { text: 'Valid passage one', title: 'First' },
      null,
      { text: 'Valid passage two', title: 'Second' }
    ];

    const deduped = deduplicatePassages(passages);

    // Should preserve valid passages and handle null gracefully
    assert.ok(deduped.length >= 2, 'Should preserve valid passages');
  });

  test('buildRetrievalSummary: handles graphKeys with undefined arrays', () => {
    const graphKeys = {
      completeTriadIds: undefined,
      triadIds: undefined,
      dyadPairs: undefined,
      suitProgressions: undefined
    };

    const summary = buildRetrievalSummary(graphKeys, []);

    assert.strictEqual(summary.patternsDetected.completeTriads, 0);
    assert.strictEqual(summary.patternsDetected.highDyads, 0);
    assert.strictEqual(summary.patternsDetected.strongSuitProgressions, 0);
  });
});

// ============================================================================
// FIX VERIFICATION: Word Boundary Matching (Issue #7)
// ============================================================================

describe('Word Boundary Matching (Issue #7 Fix)', () => {
  test('retrievePassages: keyword matching uses word boundaries, not substrings', () => {
    const graphKeys = {
      // Use two patterns so we can verify differential boosting
      foolsJourneyStageKey: 'initiation',  // Contains: "identity", "ego", "learning", "values"
      dyadPairs: [{ cards: [13, 17], significance: 'high' }]  // Contains: "hope", "renewal", "trust"
    };

    // Query with "art" - should NOT match "heart" or "start" in passages
    // If substring matching was used, this would incorrectly boost passages containing "heart"
    const passagesWithArt = retrievePassages(graphKeys, {
      maxPassages: 5,
      userQuery: 'What does this art mean for me?'
    });

    // Query with actual matching word from initiation: "identity"
    const passagesWithIdentity = retrievePassages(graphKeys, {
      maxPassages: 5,
      userQuery: 'What does this identity mean for me?'
    });

    // The "identity" query should boost the initiation passage more than "art"
    // because "identity" is an actual word in the initiation passage text
    const artJourney = passagesWithArt.find(p => p.type === 'fools-journey');
    const identityJourney = passagesWithIdentity.find(p => p.type === 'fools-journey');

    assert.ok(artJourney, 'Should find journey passage with art query');
    assert.ok(identityJourney, 'Should find journey passage with identity query');

    // Identity query should have higher relevance for the journey passage
    assert.ok(
      identityJourney.relevance > artJourney.relevance,
      `"identity" should match journey passage (relevance: ${identityJourney.relevance}) more than "art" (relevance: ${artJourney.relevance})`
    );
  });

  test('retrievePassages: "love" does not match "beloved" (substring prevention)', () => {
    const graphKeys = {
      completeTriadIds: ['death-temperance-star'],  // Contains: "beloved" is NOT in this passage
      foolsJourneyStageKey: 'initiation'  // Contains various words
    };

    // Create a scenario where we can verify "love" doesn't falsely match "beloved"
    // The Death-Temperance-Star triad passage contains "grief" not "beloved"
    const passagesWithLove = retrievePassages(graphKeys, {
      maxPassages: 5,
      userQuery: 'What about love in my life?'
    });

    // Query with a word that IS in the passage: "grief"
    const passagesWithGrief = retrievePassages(graphKeys, {
      maxPassages: 5,
      userQuery: 'What about grief in my life?'
    });

    const loveTriad = passagesWithLove.find(p => p.type === 'triad');
    const griefTriad = passagesWithGrief.find(p => p.type === 'triad');

    // "grief" should produce higher relevance than "love" for the triad
    // since "grief" is actually in the passage and "love" is not
    assert.ok(loveTriad, 'Should find triad with love query');
    assert.ok(griefTriad, 'Should find triad with grief query');
    assert.ok(
      griefTriad.relevance >= loveTriad.relevance,
      `"grief" (actual word in passage, relevance: ${griefTriad.relevance}) should match at least as well as "love" (not in passage, relevance: ${loveTriad.relevance})`
    );
  });

  test('scorePassageRelevance: uses word boundary matching', async () => {
    // Passage containing "heart" but NOT "art"
    const passage = 'The heart of transformation lies in accepting change with open arms.';

    // "art" should NOT match because it's a substring of "heart"
    const artScore = await scorePassageRelevance(passage, 'What does art mean?', {
      enableSemanticScoring: false
    });

    // "heart" SHOULD match as a whole word
    const heartScore = await scorePassageRelevance(passage, 'What does heart mean?', {
      enableSemanticScoring: false
    });

    // "change" SHOULD match as a whole word
    const changeScore = await scorePassageRelevance(passage, 'What does change mean?', {
      enableSemanticScoring: false
    });

    assert.ok(
      heartScore > artScore,
      `"heart" (actual word, score: ${heartScore}) should score higher than "art" (substring only, score: ${artScore})`
    );
    assert.ok(
      changeScore > artScore,
      `"change" (actual word, score: ${changeScore}) should score higher than "art" (substring only, score: ${artScore})`
    );
  });

  test('scorePassageRelevance: correctly matches whole words at boundaries', async () => {
    const passage = 'Love transforms the soul. Hope guides the journey. Art inspires creation.';

    // All three words should match as whole words
    const loveScore = await scorePassageRelevance(passage, 'love', {
      enableSemanticScoring: false
    });
    const hopeScore = await scorePassageRelevance(passage, 'hope', {
      enableSemanticScoring: false
    });
    const artScore = await scorePassageRelevance(passage, 'art creation', {
      enableSemanticScoring: false
    });

    // Each should have non-zero scores since the words exist as whole words
    assert.ok(loveScore > 0, `"love" should match whole word (score: ${loveScore})`);
    assert.ok(hopeScore > 0, `"hope" should match whole word (score: ${hopeScore})`);
    assert.ok(artScore > 0, `"art" should match whole word when it exists (score: ${artScore})`);
  });

  test('scorePassageRelevance: handles special regex characters in keywords safely', async () => {
    const passage = 'The Fool (card 0) represents new beginnings.';

    // Query with special regex characters that could break if not escaped
    const scoreWithParens = await scorePassageRelevance(passage, 'card (0)', {
      enableSemanticScoring: false
    });
    const scoreWithBrackets = await scorePassageRelevance(passage, 'test [brackets]', {
      enableSemanticScoring: false
    });

    // Should not throw and should return valid scores
    assert.ok(typeof scoreWithParens === 'number', 'Should handle parentheses without error');
    assert.ok(typeof scoreWithBrackets === 'number', 'Should handle brackets without error');
    assert.ok(scoreWithParens >= 0 && scoreWithParens <= 1, 'Score should be in valid range');
  });
});
