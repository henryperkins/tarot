import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildAzureGPT5Prompts, composeReadingEnhanced } from '../functions/lib/narrativeBackends.js';
import {
  analyzeRelationship,
  analyzeSpreadThemes,
  analyzeThreeCard
} from '../functions/lib/spreadAnalysis.js';
import {
  buildElementalRemedies,
  computeRemedyRotationIndex
} from '../functions/lib/narrative/helpers.js';

function minor(name, suit, rank, rankValue, position, orientation = 'Upright', meaning = 'Embodied lesson in this area.') {
  return {
    card: name,
    name,
    suit,
    rank,
    rankValue,
    position,
    orientation,
    meaning
  };
}

function major(name, number, position, orientation = 'Upright', meaning = 'Meaningful transformation and growth.') {
  return {
    card: name,
    name,
    number,
    position,
    orientation,
    meaning
  };
}

describe('composeReadingEnhanced', () => {
  it('passes spreadInfo through spread dispatch so remedy rotation can vary by spread metadata', async () => {
    const cardsInfo = [
      minor('Ace of Wands', 'Wands', 'Ace', 1, 'You / your energy', 'Upright'),
      minor('Two of Wands', 'Wands', 'Two', 2, 'Them / their energy', 'Upright'),
      minor('Three of Wands', 'Wands', 'Three', 3, 'The connection / shared lesson', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const relationshipAnalysis = analyzeRelationship(cardsInfo);
    const userQuestion = 'What is the energy of this connection?';

    const spreadInfoA = { name: 'Relationship Snapshot Alpha', key: 'alpha' };
    const spreadInfoB = { name: 'Relationship Snapshot Gamma', key: 'gamma' };

    const idxA = computeRemedyRotationIndex({ cardsInfo, userQuestion, spreadInfo: spreadInfoA });
    const idxB = computeRemedyRotationIndex({ cardsInfo, userQuestion, spreadInfo: spreadInfoB });
    assert.notEqual(idxA % 4, idxB % 4, 'Test setup should use distinct remedy rotation buckets');

    const expectedRemediesA = buildElementalRemedies(themes.elementCounts, cardsInfo.length, 'general', { rotationIndex: idxA });
    const expectedRemediesB = buildElementalRemedies(themes.elementCounts, cardsInfo.length, 'general', { rotationIndex: idxB });
    assert.ok(expectedRemediesA && expectedRemediesB);

    const payloadA = {
      spreadInfo: spreadInfoA,
      cardsInfo,
      userQuestion,
      reflectionsText: '',
      analysis: {
        themes,
        spreadAnalysis: relationshipAnalysis,
        spreadKey: 'relationship'
      },
      context: 'general'
    };
    const payloadB = {
      spreadInfo: spreadInfoB,
      cardsInfo,
      userQuestion,
      reflectionsText: '',
      analysis: {
        themes,
        spreadAnalysis: relationshipAnalysis,
        spreadKey: 'relationship'
      },
      context: 'general'
    };

    const resultA = await composeReadingEnhanced(payloadA);
    const resultB = await composeReadingEnhanced(payloadB);

    assert.ok(resultA.reading.includes('To bring in underrepresented energies:'), 'Expected remedies in reading A');
    assert.ok(resultB.reading.includes('To bring in underrepresented energies:'), 'Expected remedies in reading B');
    assert.ok(resultA.reading.includes(expectedRemediesA.split('\n')[1]));
    assert.ok(resultB.reading.includes(expectedRemediesB.split('\n')[1]));
    assert.notEqual(resultA.reading, resultB.reading, 'Spread metadata should influence remedy rotation text');
  });

  it('records reasoning metadata via buildReadingWithReasoning integration', async () => {
    const cardsInfo = [
      major('The Fool', 0, 'Past — influences that led here', 'Upright'),
      major('The Magician', 1, 'Present — where you stand now', 'Upright'),
      major('The High Priestess', 2, 'Future — trajectory if nothing shifts', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const threeCardAnalysis = analyzeThreeCard(cardsInfo);

    const payload = {
      spreadInfo: { name: 'Three-Card Story (Past · Present · Future)', key: 'threeCard' },
      cardsInfo,
      userQuestion: 'How should I move forward?',
      reflectionsText: '',
      analysis: {
        themes,
        spreadAnalysis: threeCardAnalysis,
        spreadKey: 'threeCard'
      },
      context: 'general'
    };

    const result = await composeReadingEnhanced(payload);
    assert.ok(typeof result.reading === 'string' && result.reading.length > 0);
    assert.ok(payload.reasoningMeta, 'Reasoning metadata should be attached to payload');
    assert.ok(payload.reasoningMeta.questionIntent, 'Reasoning metadata should include question intent');
    assert.ok(payload.reasoningMeta.narrativeArc, 'Reasoning metadata should include narrative arc');
  });

  it('does not append GraphRAG passages to local composer output by default', async () => {
    const cardsInfo = [
      major('The Star', 17, 'One-Card Insight', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const payload = {
      spreadInfo: { name: 'One-Card Insight', key: 'single' },
      cardsInfo,
      userQuestion: 'What should I trust right now?',
      reflectionsText: '',
      analysis: {
        themes,
        spreadAnalysis: null,
        spreadKey: 'single',
        graphRAGPayload: {
          passages: [
            { title: 'Healing Arc', text: 'Renewal often follows surrender.', source: 'Test Source' }
          ],
          initialPassageCount: 1,
          retrievalSummary: {
            semanticScoringRequested: false,
            semanticScoringUsed: false
          }
        }
      },
      context: 'general'
    };

    const result = await composeReadingEnhanced(payload);
    assert.ok(!result.reading.includes('## Traditional Wisdom'));
    assert.equal(payload.promptMeta.graphRAG.includedInPrompt, false);
    assert.equal(payload.promptMeta.graphRAG.passagesUsedInPrompt, 0);
  });

  it('appends GraphRAG passages only when debug output is explicitly enabled', async () => {
    const cardsInfo = [
      major('The Star', 17, 'One-Card Insight', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const payload = {
      spreadInfo: { name: 'One-Card Insight', key: 'single' },
      cardsInfo,
      userQuestion: 'What should I trust right now?',
      reflectionsText: '',
      analysis: {
        themes,
        spreadAnalysis: null,
        spreadKey: 'single',
        graphRAGPayload: {
          passages: [
            { title: 'Healing Arc', text: 'Renewal often follows surrender.', source: 'Test Source' }
          ],
          initialPassageCount: 1,
          retrievalSummary: {
            semanticScoringRequested: false,
            semanticScoringUsed: false
          }
        }
      },
      context: 'general'
    };

    const result = await composeReadingEnhanced(payload, {
      LOCAL_COMPOSER_APPEND_GRAPHRAG_DEBUG: 'true'
    });
    assert.ok(result.reading.includes('## Traditional Wisdom'));
    assert.equal(payload.promptMeta.graphRAG.debugVisibleInOutput, true);
    assert.equal(payload.promptMeta.graphRAG.passagesUsedInPrompt, 1);
  });
});

describe('buildAzureGPT5Prompts', () => {
  it('passes derived redaction hints into prompt logging', async () => {
    const cardsInfo = [
      major('The Fool', 0, 'Past — influences that led here', 'Upright'),
      major('The Magician', 1, 'Present — where you stand now', 'Upright'),
      major('The High Priestess', 2, 'Future — trajectory if nothing shifts', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const spreadAnalysis = analyzeThreeCard(cardsInfo);

    const payload = {
      spreadInfo: { name: 'Three-Card Story (Past · Present · Future)', key: 'threeCard', deckStyle: 'rws-1909' },
      cardsInfo,
      userQuestion: 'How do I reconnect with Alex?',
      reflectionsText: 'Alex and I have been disconnected for months.',
      analysis: {
        themes,
        spreadAnalysis,
        spreadKey: 'threeCard'
      },
      context: 'general',
      contextInputText: '',
      visionInsights: [],
      personalization: {
        displayName: 'Sam',
        readingTone: 'balanced',
        spiritualFrame: 'mixed',
        tarotExperience: 'newbie',
        preferredSpreadDepth: 'standard',
        focusAreas: []
      }
    };

    const logs = [];
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      logs.push(args.map((value) => String(value)).join(' '));
    };

    try {
      buildAzureGPT5Prompts(
        { LOG_LLM_PROMPTS: 'true', NODE_ENV: 'development' },
        payload,
        'req-redaction'
      );
    } finally {
      console.log = originalConsoleLog;
    }

    const joined = logs.join('\n');
    assert.ok(joined.includes('[NAME]'), 'Expected prompt log redaction token');
    assert.ok(!joined.includes('Alex'), 'Expected third-party name to be redacted in prompt logs');
  });
});
