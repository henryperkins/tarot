// functions/__tests__/telemetry.test.js
// Tests for telemetry summaries, prompt budgeting, reversal formatting, and context diagnostics.

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { summarizeNarrativeEnhancements } from '../lib/readingTelemetry.js';
import { buildEnhancedClaudePrompt } from '../lib/narrative/prompts.js';
import { formatReversalLens, normalizeContext } from '../lib/narrative/helpers.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Restore env between tests to avoid cross-test coupling
  Object.keys(process.env).forEach((key) => {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  });
  Object.entries(ORIGINAL_ENV).forEach(([key, value]) => {
    process.env[key] = value;
  });
});

describe('semantic scoring prefetch expectations', () => {
  it('flags missing precomputed semantic payload and falls back to keyword GraphRAG', () => {
    process.env.GRAPHRAG_ENABLED = 'true';

    const { promptMeta, contextDiagnostics } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Three-Card Story (Past · Present · Future)' },
      cardsInfo: [
        { card: 'The Fool', position: 'Past', number: 0, orientation: 'Upright', meaning: 'Leap of faith.' },
        { card: 'The Magician', position: 'Present', number: 1, orientation: 'Upright', meaning: 'Manifesting resources and skill.' },
        { card: 'The High Priestess', position: 'Future', number: 2, orientation: 'Reversed', meaning: 'Inner knowing.' }
      ],
      userQuestion: 'How do I integrate this chapter?',
      reflectionsText: '',
      themes: {
        reversalCount: 0,
        reversalDescription: {
          name: 'Upright Focus',
          description: 'No reversals detected.',
          guidance: 'Refer to upright meanings unless a reversed card appears.'
        },
        knowledgeGraph: {
          graphKeys: { completeTriadIds: ['death-temperance-star'] }
        },
        suitCounts: {},
        elementCounts: {}
      },
      spreadAnalysis: null,
      context: 'self',
      visionInsights: [],
      deckStyle: 'rws-1909',
      enableSemanticScoring: true
    });

    assert.ok(promptMeta.graphRAG, 'graphRAG metadata should be present');
    assert.equal(promptMeta.graphRAG.semanticScoringRequested, true);
    assert.equal(promptMeta.graphRAG.semanticScoringUsed, false);
    assert.equal(promptMeta.graphRAG.semanticScoringFallback, true);
    assert.equal(promptMeta.graphRAG.reason, 'semantic-scoring-not-prefetched');
    assert.equal(promptMeta.graphRAG.includedInPrompt, true);
    assert.equal(promptMeta.graphRAG.parseStatus, 'complete');
    assert.equal(promptMeta.graphRAG.referenceBlockClosed, true);
    assert.ok(
      promptMeta.graphRAG.passagesProvided >= 1,
      'GraphRAG should fall back to keyword passages when semantic payload is missing'
    );
    assert.ok(
      Array.isArray(contextDiagnostics) &&
      contextDiagnostics.some((d) =>
        d.includes('Semantic scoring requested') && d.toLowerCase().includes('falling back to keyword retrieval')
      ),
      'Diagnostics should flag semantic scoring fallback to keyword retrieval'
    );
  });
});

describe('enhancement telemetry summary', () => {
  it('captures counts, names, and missing keys', () => {
    const sections = [
      {
        text: 'Opening section',
        metadata: { type: 'opening', name: 'Opening' },
        validation: {
          enhanced: true,
          enhancements: ['Added card identification'],
          missing: ['why'],
          present: { what: true }
        }
      },
      {
        text: 'Guidance body',
        metadata: { type: 'guidance' },
        validation: {
          enhanced: false,
          enhancements: [],
          missing: [],
          present: { what: true, why: true, whatsNext: true }
        }
      }
    ];

    const summary = summarizeNarrativeEnhancements(sections);

    assert.equal(summary.totalSections, 2);
    assert.equal(summary.enhancedSections, 1);
    assert.deepEqual(summary.sectionNames, ['Opening', 'guidance']);
    assert.equal(summary.enhancementCounts['Added card identification'], 1);
    assert.equal(summary.missingCounts.why, 1);
  });
});

describe('prompt slimming respects budget order', () => {
  it('applies slimming steps when token budget is exceeded and slimming is enabled', () => {
    const spreadInfo = { name: 'Three-Card Story (Past · Present · Future)' };
    const cardsInfo = [
      { card: 'The Fool', position: 'Past', number: 0, orientation: 'Upright', meaning: 'A long wandering path.' },
      { card: 'The Magician', position: 'Present', number: 1, orientation: 'Upright', meaning: 'Manifesting resources and skill.' },
      { card: 'The High Priestess', position: 'Future', number: 2, orientation: 'Reversed', meaning: 'Trust inner knowing and mystery.' }
    ];

    const themes = {
      reversalCount: 1,
      reversalDescription: {
        name: 'Blocked Energy',
        description: 'Reversals show resistance.',
        guidance: 'Name the block, then describe how to clear or integrate it.'
      },
      knowledgeGraph: {},
      suitCounts: {},
      elementCounts: {}
    };

    // Slimming is disabled by default - must explicitly enable via ENABLE_PROMPT_SLIMMING
    // Actual token counts come from API response (llmUsage.input_tokens)
    const { promptMeta } = buildEnhancedClaudePrompt({
      spreadInfo,
      cardsInfo,
      userQuestion: 'How do I navigate this massive life transition? '.repeat(8),
      reflectionsText: '',
      themes,
      spreadAnalysis: null,
      context: 'career',
      visionInsights: [],
      deckStyle: 'rws-1909',
      promptBudgetEnv: {
        ENABLE_PROMPT_SLIMMING: 'true',
        PROMPT_BUDGET_CLAUDE: '40'
      }
    });

    assert.equal(promptMeta.slimmingEnabled, true);
    assert.ok(promptMeta.estimatedTokens.total > promptMeta.estimatedTokens.budget);
    assert.deepEqual(promptMeta.slimmingSteps, [
      'drop-low-weight-imagery',
      'drop-forecast',
      'drop-ephemeris',
      'trim-graphrag-passages',
      'drop-graphrag-block',
      'drop-deck-geometry',
      'drop-diagnostics'
    ]);
    // GraphRAG telemetry may be absent when no graph keys/payload were available.
    if (promptMeta.graphRAG) {
      assert.equal(promptMeta.graphRAG.includedInPrompt, false);
    }
  });
});

describe('hard-cap truncation', () => {
  it('preserves safety sections and marks truncation metadata', () => {
    const spreadInfo = { name: 'One-Card Insight' };
    const cardsInfo = [
      { card: 'The Star', position: 'Theme', number: 17, orientation: 'Upright', meaning: 'Hope and healing.' }
    ];
    const themes = {
      reversalCount: 0,
      reversalDescription: {
        name: 'All Upright',
        description: 'No reversals present.',
        guidance: 'Read cards in their upright flow.'
      },
      knowledgeGraph: {},
      suitCounts: {},
      elementCounts: {}
    };

    const hugeAddition = 'X'.repeat(80000);
    const { systemPrompt, promptMeta } = buildEnhancedClaudePrompt({
      spreadInfo,
      cardsInfo,
      userQuestion: 'What should I focus on this week?',
      reflectionsText: '',
      themes,
      spreadAnalysis: null,
      context: 'self',
      visionInsights: [],
      deckStyle: 'rws-1909',
      budgetTarget: 'default',
      promptBudgetEnv: { ENABLE_PROMPT_SLIMMING: 'false' },
      variantOverrides: { systemPromptAddition: hugeAddition }
    });

    assert.ok(promptMeta.truncation, 'truncation metadata should be present');
    assert.ok(promptMeta.truncation.systemTruncated || promptMeta.truncation.userTruncated, 'prompt should be truncated');
    assert.ok(promptMeta.slimmingSteps.includes('hard-cap-truncation'));
    assert.ok(systemPrompt.includes('ETHICS'));
    assert.ok(systemPrompt.includes('CORE PRINCIPLES'));
    assert.ok(systemPrompt.includes('MODEL DIRECTIVES:'));
  });
});

describe('reversal formatter', () => {
  it('produces option-aware cached reversal descriptions without mutating source objects', () => {
    const themes = {
      reversalCount: 2,
      reversalDescription: {
        name: 'Internalized Energy',
        description: 'Energy moves inward before it emerges.',
        guidance: 'Invite reflection and integration before action.',
        examples: { 'The Sun': 'Joy cultivated privately first.' }
      }
    };

    const formatted = formatReversalLens(themes, { includeExamples: true, includeReminder: true });
    const noExamples = formatReversalLens(themes, { includeExamples: false, includeReminder: false });
    const noExamplesRepeat = formatReversalLens(themes, { includeExamples: false, includeReminder: false });

    assert.ok(formatted.lines.some((line) => line.includes('Reversal lens')));
    assert.ok(formatted.lines.some((line) => line.includes('Guidance')));
    assert.ok(formatted.lines.some((line) => line.includes('Example applications')));
    assert.ok(!noExamples.text.includes('Example applications'));
    assert.strictEqual(noExamples.text, noExamplesRepeat.text, 'cached variant should be stable');
    assert.equal(
      Object.prototype.hasOwnProperty.call(themes.reversalDescription, 'formattedLens'),
      false,
      'formatter cache must not mutate framework/theme objects'
    );
  });
});

describe('context diagnostics propagation', () => {
  it('pushes unknown context warnings into diagnostics array', () => {
    const diagnostics = [];
    const themes = {
      reversalCount: 0,
      reversalDescription: {
        name: 'All Upright',
        description: 'No reversals present.',
        guidance: 'Read cards in their upright flow.'
      },
      knowledgeGraph: {},
      suitCounts: {},
      elementCounts: {}
    };

    const { contextDiagnostics } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'One-Card Insight' },
      cardsInfo: [
        { card: 'The Star', position: 'Theme', number: 17, orientation: 'Upright', meaning: 'Hope and healing.' }
      ],
      userQuestion: 'What should I know?',
      reflectionsText: '',
      themes,
      spreadAnalysis: null,
      context: 'mystery-context',
      visionInsights: [],
      deckStyle: 'rws-1909',
      contextDiagnostics: diagnostics
    });

    assert.equal(diagnostics.length, 1);
    assert.equal(contextDiagnostics.length, 1);
    assert.match(contextDiagnostics[0], /Unknown context/);

    const normalized = normalizeContext('mystery-context', {
      onUnknown: (msg) => diagnostics.push(msg)
    });
    assert.equal(normalized, 'general');
  });

  it('reports relationship clarifier truncation diagnostics when prompt input exceeds contract', () => {
    const themes = {
      reversalCount: 0,
      reversalDescription: {
        name: 'All Upright',
        description: 'No reversals present.',
        guidance: 'Read cards in their upright flow.'
      },
      knowledgeGraph: {},
      suitCounts: {},
      elementCounts: {}
    };
    const cardsInfo = [
      { card: 'Two of Cups', position: 'You / your energy', orientation: 'Upright', meaning: 'Mutual attraction.' },
      { card: 'The Lovers', position: 'Them / their energy', orientation: 'Upright', meaning: 'Values alignment.' },
      { card: 'Temperance', position: 'The connection / shared lesson', orientation: 'Upright', meaning: 'Integration.' },
      { card: 'Three of Pentacles', position: 'Dynamics / guidance', orientation: 'Upright', meaning: 'Co-creation.' },
      { card: 'The Star', position: 'Outcome / what this can become', orientation: 'Upright', meaning: 'Renewed trust.' },
      { card: 'King of Swords', position: 'Additional clarifier 3', orientation: 'Upright', meaning: 'Boundaries.' }
    ];

    const { userPrompt, contextDiagnostics } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Relationship Snapshot', key: 'relationship' },
      cardsInfo,
      userQuestion: 'How do we repair this connection?',
      reflectionsText: '',
      themes,
      spreadAnalysis: null,
      context: 'love',
      visionInsights: [],
      deckStyle: 'rws-1909'
    });

    assert.ok(
      contextDiagnostics.some((entry) => entry.includes('[relationship]') && entry.includes('truncating to 2')),
      'context diagnostics should include relationship clarifier truncation'
    );
    assert.ok(userPrompt.includes('Dynamics / guidance'));
    assert.ok(userPrompt.includes('Outcome / what this can become'));
    assert.ok(!userPrompt.includes('Additional clarifier 3'));
  });
});

describe('prompt builder resilience', () => {
  it('handles missing themes and sanitizes long reflections', () => {
    const reflectionsText = '# Heading\n' + 'This is a very long reflection '.repeat(50);

    const { userPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'One-Card Insight' },
      cardsInfo: [
        { card: 'The Hermit', position: 'Theme / Guidance of the Moment', number: 9, orientation: 'Upright', meaning: 'Inner guidance and solitude.' }
      ],
      userQuestion: '',
      reflectionsText,
      themes: null,
      spreadAnalysis: null,
      context: 'self',
      visionInsights: [],
      deckStyle: 'rws-1909'
    });

    const match = userPrompt.match(/\*\*Querent's Reflections\*\*:\n([\s\S]+?)\n\n/);
    assert.ok(match, 'Reflections block should be present when provided');
    const sanitized = match[1];
    assert.ok(!sanitized.includes('#'), 'Sanitized reflections should strip markdown headings');
    assert.ok(sanitized.length <= 620, 'Sanitized reflections should be truncated to a safe length');
  });

  it('reuses GraphRAG payload across slimming passes', () => {
    process.env.PROMPT_BUDGET_CLAUDE = '40';
    process.env.GRAPHRAG_ENABLED = 'true';

    const themes = {
      reversalCount: 0,
      reversalDescription: {
        name: 'Upright Focus',
        description: 'No reversals detected.',
        guidance: 'Refer to upright meanings unless a reversed card appears.'
      },
      knowledgeGraph: {
        graphKeys: {
          completeTriadIds: ['fool-magician-highpriestess']
        }
      },
      suitCounts: {},
      elementCounts: {}
    };

    const graphRAGPayload = {
      passages: [
        { title: 'Triad Wisdom', text: "Insight about the Fool's Journey.", source: 'Arcana Anthology', priority: 1, type: 'triad' }
      ],
      initialPassageCount: 1,
      formattedBlock: null,
      retrievalSummary: {
        semanticScoringRequested: false,
        semanticScoringUsed: false,
        semanticScoringFallback: false
      },
      maxPassages: 1,
      rankingStrategy: 'keyword'
    };

    const { promptMeta } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Three-Card Story (Past · Present · Future)' },
      cardsInfo: [
        { card: 'The Fool', position: 'Past', number: 0, orientation: 'Upright', meaning: 'Leap of faith.' },
        { card: 'The Magician', position: 'Present', number: 1, orientation: 'Upright', meaning: 'Channel skills.' },
        { card: 'The High Priestess', position: 'Future', number: 2, orientation: 'Reversed', meaning: 'Inner knowing.' }
      ],
      userQuestion: 'How do I integrate this chapter? '.repeat(6),
      reflectionsText: '',
      themes,
      spreadAnalysis: null,
      context: 'self',
      visionInsights: [],
      deckStyle: 'rws-1909',
      graphRAGPayload
    });

    assert.ok(promptMeta.graphRAG, 'graphRAG metadata should be present');
    assert.equal(promptMeta.graphRAG.passagesProvided, 1);
  });
});

describe('cardsInfo validation guard', () => {
  it('throws TypeError with clear message when cardsInfo is undefined', () => {
    assert.throws(
      () => buildEnhancedClaudePrompt({
        spreadInfo: { name: 'One-Card Insight' },
        cardsInfo: undefined,
        userQuestion: 'test'
      }),
      {
        name: 'TypeError',
        message: /cardsInfo must be a non-empty array.*Received: undefined/
      }
    );
  });

  it('throws TypeError with clear message when cardsInfo is null', () => {
    assert.throws(
      () => buildEnhancedClaudePrompt({
        spreadInfo: { name: 'One-Card Insight' },
        cardsInfo: null,
        userQuestion: 'test'
      }),
      {
        name: 'TypeError',
        message: /cardsInfo must be a non-empty array.*Received: null/
      }
    );
  });

  it('throws TypeError with clear message when cardsInfo is empty array', () => {
    assert.throws(
      () => buildEnhancedClaudePrompt({
        spreadInfo: { name: 'One-Card Insight' },
        cardsInfo: [],
        userQuestion: 'test'
      }),
      {
        name: 'TypeError',
        message: /cardsInfo must be a non-empty array.*length: 0/
      }
    );
  });

  it('throws TypeError when cardsInfo is a non-array object', () => {
    assert.throws(
      () => buildEnhancedClaudePrompt({
        spreadInfo: { name: 'One-Card Insight' },
        cardsInfo: { card: 'The Fool' },
        userQuestion: 'test'
      }),
      {
        name: 'TypeError',
        message: /cardsInfo must be a non-empty array/
      }
    );
  });

  it('accepts valid non-empty cardsInfo array', () => {
    const { userPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'One-Card Insight' },
      cardsInfo: [
        { card: 'The Fool', position: 'Theme', number: 0, orientation: 'Upright', meaning: 'New beginnings.' }
      ],
      userQuestion: 'test',
      reflectionsText: '',
      themes: null,
      spreadAnalysis: null,
      context: 'general',
      visionInsights: [],
      deckStyle: 'rws-1909'
    });
    assert.ok(userPrompt.length > 0, 'Valid cardsInfo should produce a prompt');
    assert.ok(userPrompt.includes('The Fool'), 'Prompt should reference the card');
  });
});

describe('context and deck style validation signals', () => {
  it('returns null when context fallback is disabled', () => {
    const normalized = normalizeContext('mystery-context', { allowFallback: false });
    assert.equal(normalized, null);
  });

  it('throws when strict context validation is requested', () => {
    assert.throws(
      () => normalizeContext('mystery-context', { strict: true, allowFallback: false }),
      /Unknown context/
    );
  });

  it('prefers theme deckStyle and surfaces diagnostics on conflict', () => {
    const { promptMeta, contextDiagnostics } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Three-Card Story (Past · Present · Future)', deckStyle: 'marseille-classic' },
      cardsInfo: [
        { card: 'The Fool', position: 'Past', number: 0, orientation: 'Upright', meaning: 'Start.' },
        { card: 'The Magician', position: 'Present', number: 1, orientation: 'Upright', meaning: 'Manifest.' },
        { card: 'The High Priestess', position: 'Future', number: 2, orientation: 'Reversed', meaning: 'Inner voice.' }
      ],
      userQuestion: 'How do I integrate this chapter?',
      reflectionsText: '',
      themes: {
        deckStyle: 'thoth-a1',
        reversalDescription: {
          name: 'Upright Focus',
          description: 'No reversals detected.',
          guidance: 'Refer to upright meanings unless a reversed card appears.'
        },
        knowledgeGraph: {},
        suitCounts: {},
        elementCounts: {}
      },
      spreadAnalysis: null,
      context: 'self',
      visionInsights: [],
      deckStyle: 'rws-1909',
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
    });

    assert.equal(promptMeta.deckStyle, 'thoth-a1');
    assert.ok(
      Array.isArray(contextDiagnostics) &&
      contextDiagnostics.some((d) => d.includes('deck-style')),
      'Deck style conflicts should surface diagnostics'
    );
  });
});
