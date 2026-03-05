import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildAzureGPT5Prompts,
  composeReadingEnhanced,
  generateWithClaudeOpus45,
  runNarrativeBackend
} from '../functions/lib/narrativeBackends.js';
import { applyGraphRAGAlerts } from '../functions/lib/graphRAGAlerts.js';
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

async function withMockedFetch(mockFetch, fn) {
  const originalFetch = global.fetch;
  global.fetch = mockFetch;
  try {
    return await fn();
  } finally {
    global.fetch = originalFetch;
  }
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

  it('suppresses GraphRAG omission alerts when debug passages are visibly appended', async () => {
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
          retrievalSummary: {}
        }
      },
      context: 'general'
    };

    await composeReadingEnhanced(payload, {
      LOCAL_COMPOSER_APPEND_GRAPHRAG_DEBUG: 'true'
    });

    const alerts = applyGraphRAGAlerts(payload, 'req-graph-debug', 'local-composer');
    assert.equal(payload.promptMeta.graphRAG.includedInPrompt, false);
    assert.equal(payload.promptMeta.graphRAG.injectedIntoPrompt, false);
    assert.equal(payload.promptMeta.graphRAG.debugVisibleInOutput, true);
    assert.ok(!alerts.some((alert) => alert.includes('omitted')), 'debug-visible passages should not emit omission alerts');
  });

  it('preserves sourceUsage metadata for local-composer fallback', async () => {
    const cardsInfo = [
      major('The Star', 17, 'One-Card Insight', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const payload = {
      spreadInfo: { name: 'One-Card Insight', key: 'single' },
      cardsInfo,
      userQuestion: 'How do I rebuild trust in my direction?',
      reflectionsText: 'I feel split between caution and hope.',
      visionInsights: [
        {
          label: 'upload-1',
          predictedCard: 'The Star',
          confidence: 0.91
        }
      ],
      personalization: {
        focusAreas: ['career']
      },
      analysis: {
        themes,
        spreadAnalysis: null,
        spreadKey: 'single',
        graphRAGPayload: {
          passages: [{ title: 'Hope', text: 'Hope emerges in disciplined steps.' }],
          initialPassageCount: 1,
          retrievalSummary: {}
        },
        ephemerisContext: {
          available: true
        },
        ephemerisForecast: {
          available: false
        }
      },
      context: 'career'
    };

    const result = await composeReadingEnhanced(payload);
    const sourceUsage = payload.promptMeta?.sourceUsage;

    assert.ok(sourceUsage, 'local-composer should emit sourceUsage metadata');
    assert.equal(result.promptMeta?.sourceUsage?.spreadCards?.used, true);
    assert.equal(sourceUsage.vision.requested, true);
    assert.equal(sourceUsage.vision.used, false);
    assert.equal(sourceUsage.userContext.used, true);
    assert.equal(sourceUsage.userContext.questionProvided, true);
    assert.equal(sourceUsage.userContext.reflectionsProvided, true);
    assert.equal(sourceUsage.userContext.focusAreasProvided, true);
    assert.equal(sourceUsage.graphRAG.requested, true);
    assert.equal(sourceUsage.graphRAG.used, false);
    assert.equal(sourceUsage.ephemeris.used, true);
    assert.equal(sourceUsage.forecast.used, false);
    assert.equal(sourceUsage.forecast.skippedReason, 'unavailable');
  });

  it('sanitizes custom-spread reflections in local-composer output', async () => {
    const cardsInfo = [
      major('The Fool', 0, 'Card 1', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const payload = {
      spreadInfo: { name: 'Custom Reflection Spread', key: 'customSpread' },
      cardsInfo,
      userQuestion: 'What should I notice first?',
      reflectionsText: 'I keep revisiting [this support thread](https://example.com/help) and [this support thread](https://example.com/help).',
      analysis: {
        themes,
        spreadAnalysis: null,
        spreadKey: 'customSpread'
      },
      context: 'general'
    };

    const result = await composeReadingEnhanced(payload);

    assert.ok(result.reading.includes('### Your Reflections'));
    assert.ok(!result.reading.includes('[this support thread]('), 'reflection markdown links should be stripped');
    assert.ok(!result.reading.includes('**Your Reflections**\n\nI keep revisiting [this support thread]'), 'raw reflections should not be echoed verbatim');
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

describe('Claude backend + dispatch coverage', () => {
  it('generates via Claude with redacted prompt logging and promptMeta propagation', async () => {
    const cardsInfo = [
      major('The Fool', 0, 'Past — influences that led here', 'Upright'),
      major('The Magician', 1, 'Present — where you stand now', 'Upright'),
      major('The High Priestess', 2, 'Future — trajectory if nothing shifts', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const spreadAnalysis = analyzeThreeCard(cardsInfo);
    const payload = {
      spreadInfo: { name: 'Three-Card Story (Past · Present · Future)', key: 'threeCard' },
      cardsInfo,
      userQuestion: 'How do I reconnect with Alex?',
      reflectionsText: 'I keep thinking about Alex and Jamie.',
      analysis: {
        themes,
        spreadAnalysis,
        spreadKey: 'threeCard'
      },
      context: 'general',
      contextInputText: '',
      visionInsights: [],
      personalization: {
        displayName: 'Sam'
      }
    };
    const env = {
      AZURE_ANTHROPIC_ENDPOINT: 'https://example.services.ai.azure.com/anthropic',
      AZURE_ANTHROPIC_API_KEY: 'test-key',
      AZURE_ANTHROPIC_MODEL: 'claude-opus-4-5',
      LOG_LLM_PROMPTS: 'true',
      NODE_ENV: 'development'
    };

    const logs = [];
    let capturedRequest = null;
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      logs.push(args.map((value) => String(value)).join(' '));
    };

    try {
      const result = await withMockedFetch(async (url, options) => {
        capturedRequest = { url, options };
        return new Response(JSON.stringify({
          id: 'claude-response-1',
          model: 'claude-opus-4-5',
          usage: { input_tokens: 12, output_tokens: 34 },
          content: [{ text: 'Claude reading text.' }]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }, async () => generateWithClaudeOpus45(env, payload, 'req-claude'));

      assert.equal(result.reading, 'Claude reading text.');
      assert.ok(result.prompts.system.length > 0, 'Claude backend should return captured system prompt');
      assert.ok(result.prompts.user.length > 0, 'Claude backend should return captured user prompt');
      assert.ok(payload.promptMeta, 'Claude backend should propagate promptMeta onto the payload');
      assert.equal(payload.promptMeta.spreadKey, 'threeCard');
      assert.ok(payload.promptMeta.sourceUsage, 'Claude backend should propagate sourceUsage metadata');

      const requestBody = JSON.parse(capturedRequest.options.body);
      assert.equal(capturedRequest.url, 'https://example.services.ai.azure.com/anthropic/v1/messages');
      assert.equal(capturedRequest.options.headers['x-api-key'], 'test-key');
      assert.equal(requestBody.model, 'claude-opus-4-5');
      assert.equal(requestBody.system, result.prompts.system);
      assert.equal(requestBody.messages[0].content, result.prompts.user);

      const joinedLogs = logs.join('\n');
      assert.ok(joinedLogs.includes('[NAME]'), 'Claude prompt logs should contain redaction tokens');
      assert.ok(!joinedLogs.includes('Alex'), 'Claude prompt logs should redact third-party names');
      assert.ok(!joinedLogs.includes('Jamie'), 'Claude prompt logs should redact derived name hints');
    } finally {
      console.log = originalConsoleLog;
    }
  });

  it('throws on empty Claude responses', async () => {
    const cardsInfo = [
      major('The Fool', 0, 'One-Card Insight', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const payload = {
      spreadInfo: { name: 'One-Card Insight', key: 'single' },
      cardsInfo,
      userQuestion: 'What should I notice?',
      reflectionsText: '',
      analysis: {
        themes,
        spreadAnalysis: null,
        spreadKey: 'single'
      },
      context: 'general'
    };
    const env = {
      AZURE_ANTHROPIC_ENDPOINT: 'https://example.services.ai.azure.com/anthropic',
      AZURE_ANTHROPIC_API_KEY: 'test-key'
    };

    await withMockedFetch(async () => new Response(JSON.stringify({
      id: 'claude-response-2',
      content: [{ text: '' }]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }), async () => {
      await assert.rejects(
        generateWithClaudeOpus45(env, payload, 'req-empty-claude'),
        /Empty response from Azure Claude Opus 4\.5/
      );
    });
  });

  it('dispatches azure-gpt5, claude-opus45, local-composer, and unknown ids deterministically', async () => {
    const cardsInfo = [
      major('The Fool', 0, 'One-Card Insight', 'Upright')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo);
    const basePayload = {
      spreadInfo: { name: 'One-Card Insight', key: 'single' },
      cardsInfo,
      userQuestion: 'What should I notice?',
      reflectionsText: '',
      analysis: {
        themes,
        spreadAnalysis: null,
        spreadKey: 'single'
      },
      context: 'general'
    };

    await withMockedFetch(async (url) => {
      if (url.includes('/anthropic/')) {
        return new Response(JSON.stringify({
          id: 'claude-dispatch',
          content: [{ text: 'Claude dispatch reading.' }],
          usage: { input_tokens: 10, output_tokens: 20 }
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        id: 'azure-dispatch',
        model: 'gpt-5-test',
        output: [
          {
            type: 'message',
            content: [
              { type: 'output_text', text: 'Azure dispatch reading.' }
            ]
          }
        ],
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }, async () => {
      const azureResult = await runNarrativeBackend('azure-gpt5', {
        AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com',
        AZURE_OPENAI_API_KEY: 'azure-key',
        AZURE_OPENAI_GPT5_MODEL: 'gpt-5-test'
      }, structuredClone(basePayload), 'req-azure-dispatch');
      assert.equal(azureResult.reading, 'Azure dispatch reading.');
      assert.ok(azureResult.promptMeta, 'Azure dispatch should return promptMeta');

      const claudeResult = await runNarrativeBackend('claude-opus45', {
        AZURE_ANTHROPIC_ENDPOINT: 'https://example.services.ai.azure.com/anthropic',
        AZURE_ANTHROPIC_API_KEY: 'claude-key'
      }, structuredClone(basePayload), 'req-claude-dispatch');
      assert.equal(claudeResult.reading, 'Claude dispatch reading.');

      const localResult = await runNarrativeBackend('local-composer', {}, structuredClone(basePayload), 'req-local-dispatch');
      assert.ok(localResult.reading.includes('One-Card Insight'));

      const fallbackResult = await runNarrativeBackend('unknown-backend', {}, structuredClone(basePayload), 'req-fallback-dispatch');
      assert.ok(fallbackResult.reading.includes('One-Card Insight'), 'unknown backends should currently fall back to local-composer');
    });
  });
});
