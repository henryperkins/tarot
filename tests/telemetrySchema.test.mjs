/**
 * Tests for telemetry schema module
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  SCHEMA_VERSION,
  buildMetricsPayload,
  buildPromptTelemetry,
  buildGraphRAGTelemetry,
  buildNarrativeTelemetry,
  getGraphRAGStats,
  getPromptVersion,
  getNarrativeCoverage,
  isSchemaV2,
  migratePayloadToV2
} from '../functions/lib/telemetrySchema.js';

describe('telemetrySchema', () => {
  describe('SCHEMA_VERSION', () => {
    it('should be version 2', () => {
      assert.strictEqual(SCHEMA_VERSION, 2);
    });
  });

  describe('buildPromptTelemetry', () => {
    it('should return null for null input', () => {
      assert.strictEqual(buildPromptTelemetry(null), null);
    });

    // Note: version extraction test removed - version now only in experiment.promptVersion
    it('should return object with null fields for minimal promptMeta', () => {
      const promptMeta = {};
      const result = buildPromptTelemetry(promptMeta);
      assert.strictEqual(result.tokens, null);
      assert.strictEqual(result.truncation, null);
    });

    it('should extract token estimates', () => {
      const promptMeta = {
        estimatedTokens: {
          system: 1000,
          user: 2000,
          total: 3000,
          budget: 8000,
          hardCap: 16000,
          budgetTarget: 'azure',
          overBudget: false
          // Note: truncated removed - use prompt.truncation !== null instead
        }
      };
      const result = buildPromptTelemetry(promptMeta);
      assert.deepStrictEqual(result.tokens, {
        system: 1000,
        user: 2000,
        total: 3000,
        budget: 8000,
        hardCap: 16000,
        budgetTarget: 'azure',
        overBudget: false
      });
    });

    it('should extract slimming info', () => {
      const promptMeta = {
        slimmingEnabled: true,
        slimmingSteps: ['drop-forecast', 'drop-ephemeris']
      };
      const result = buildPromptTelemetry(promptMeta);
      assert.deepStrictEqual(result.slimming, {
        enabled: true,
        steps: ['drop-forecast', 'drop-ephemeris']
      });
    });

    it('should extract applied options', () => {
      const promptMeta = {
        appliedOptions: {
          omitLowWeightImagery: true,
          includeForecast: false,
          includeEphemeris: true,
          includeDeckContext: true,
          includeDiagnostics: false
        }
      };
      const result = buildPromptTelemetry(promptMeta);
      // Note: includeGraphRAG removed - use graphRAG.includedInPrompt instead
      assert.deepStrictEqual(result.options, {
        omitLowWeightImagery: true,
        includeForecast: false,
        includeEphemeris: true,
        includeDeckContext: true,
        includeDiagnostics: false
      });
    });
  });

  describe('buildGraphRAGTelemetry', () => {
    it('should return null for null input', () => {
      assert.strictEqual(buildGraphRAGTelemetry(null), null);
    });

    it('should extract basic fields', () => {
      const stats = {
        includedInPrompt: true,
        disabledByEnv: false,
        passagesProvided: 5,
        passagesUsedInPrompt: 3,
        truncatedPassages: 2,
        parseStatus: 'complete',
        referenceBlockClosed: true
      };
      const result = buildGraphRAGTelemetry(stats);
      assert.strictEqual(result.includedInPrompt, true);
      assert.strictEqual(result.disabledByEnv, false);
      assert.strictEqual(result.passagesProvided, 5);
      assert.strictEqual(result.passagesUsedInPrompt, 3);
      assert.strictEqual(result.truncatedPassages, 2);
      assert.strictEqual(result.parseStatus, 'complete');
      assert.strictEqual(result.referenceBlockClosed, true);
    });

    it('should preserve null passagesUsedInPrompt for partial parsing', () => {
      const stats = {
        includedInPrompt: false,
        passagesProvided: 4,
        passagesUsedInPrompt: null,
        parseStatus: 'partial',
        referenceBlockClosed: false
      };
      const result = buildGraphRAGTelemetry(stats);
      assert.strictEqual(result.passagesUsedInPrompt, null);
      assert.strictEqual(result.parseStatus, 'partial');
      assert.strictEqual(result.referenceBlockClosed, false);
    });

    it('should extract semantic scoring info', () => {
      const stats = {
        semanticScoringRequested: true,
        semanticScoringUsed: false,
        semanticScoringAttempted: true,
        semanticScoringFallback: true
      };
      const result = buildGraphRAGTelemetry(stats);
      assert.deepStrictEqual(result.semanticScoring, {
        requested: true,
        used: false,
        attempted: true,
        fallback: true
      });
    });

    it('should extract patterns detected', () => {
      const stats = {
        patternsDetected: {
          completeTriads: 1,
          partialTriads: 2,
          foolsJourneyStage: 'integration',
          totalMajors: 3,
          highDyads: 2,
          mediumHighDyads: 1,
          strongSuitProgressions: 1,
          emergingSuitProgressions: 0
        }
      };
      const result = buildGraphRAGTelemetry(stats);
      assert.deepStrictEqual(result.patterns, {
        completeTriads: 1,
        partialTriads: 2,
        foolsJourneyStage: 'integration',
        totalMajors: 3,
        highDyads: 2,
        mediumHighDyads: 1,
        strongSuitProgressions: 1,
        emergingSuitProgressions: 0
      });
    });
  });

  describe('buildNarrativeTelemetry', () => {
    it('should return empty structure for null input', () => {
      const result = buildNarrativeTelemetry(null);
      assert.deepStrictEqual(result, { spine: null, coverage: null });
    });

    it('should extract spine info', () => {
      const metrics = {
        spine: {
          isValid: true,
          totalSections: 5,
          completeSections: 4,
          incompleteSections: 1,
          cardSections: 3,
          cardComplete: 3,
          cardIncomplete: 0,
          structuralSections: 2,
          suggestions: ['Add closing']
        }
      };
      const result = buildNarrativeTelemetry(metrics);
      assert.strictEqual(result.spine.isValid, true);
      assert.strictEqual(result.spine.totalSections, 5);
      assert.deepStrictEqual(result.spine.suggestions, ['Add closing']);
    });

    it('should extract coverage info', () => {
      const metrics = {
        cardCount: 3,
        cardCoverage: 1.0,
        missingCards: [],
        hallucinatedCards: ['The Fool']
      };
      const result = buildNarrativeTelemetry(metrics);
      assert.deepStrictEqual(result.coverage, {
        cardCount: 3,
        percentage: 1.0,
        missingCards: [],
        hallucinatedCards: ['The Fool']
      });
    });
  });

  describe('buildMetricsPayload', () => {
    it('should include schema version', () => {
      const result = buildMetricsPayload({
        requestId: 'test-123',
        timestamp: '2024-01-01T00:00:00Z'
      });
      assert.strictEqual(result.schemaVersion, 2);
    });

    it('should build complete payload', () => {
      const result = buildMetricsPayload({
        requestId: 'test-123',
        timestamp: '2024-01-01T00:00:00Z',
        provider: 'azure-gpt5',
        spreadKey: 'celtic',
        deckStyle: 'rws-1909',
        context: 'relationships',
        promptMeta: { readingPromptVersion: '1.0.0' },
        graphRAGStats: { includedInPrompt: true },
        narrativeMetrics: { cardCount: 10, cardCoverage: 1.0 },
        visionMetrics: null,
        abAssignment: { variantId: 'v1', experimentId: 'exp1' },
        capturedUsage: { input_tokens: 1000, output_tokens: 500 },
        evalGateResult: { passed: true },
        wasGateBlocked: false,
        backendErrors: [],
        enhancementTelemetry: null,
        diagnostics: ['test warning']
      });

      assert.strictEqual(result.requestId, 'test-123');
      assert.strictEqual(result.provider, 'azure-gpt5');
      assert.strictEqual(result.experiment.promptVersion, '1.0.0');
      assert.strictEqual(result.experiment.variantId, 'v1');
      assert.strictEqual(result.graphRAG.includedInPrompt, true);
      assert.strictEqual(result.narrative.coverage.cardCount, 10);
      assert.strictEqual(result.llmUsage.inputTokens, 1000);
      assert.strictEqual(result.evalGate.passed, true);
      assert.strictEqual(result.diagnostics.count, 1);
    });

    it('should omit backendErrors when empty', () => {
      const result = buildMetricsPayload({
        requestId: 'test-123',
        backendErrors: []
      });
      assert.strictEqual(result.backendErrors, undefined);
    });

    it('should include backendErrors when present', () => {
      const result = buildMetricsPayload({
        requestId: 'test-123',
        backendErrors: ['timeout']
      });
      assert.deepStrictEqual(result.backendErrors, ['timeout']);
    });
  });

  describe('backward compatibility helpers', () => {
    describe('isSchemaV2', () => {
      it('should return true for v2 payloads', () => {
        assert.strictEqual(isSchemaV2({ schemaVersion: 2 }), true);
      });

      it('should return false for v1 payloads', () => {
        assert.strictEqual(isSchemaV2({ requestId: 'test' }), false);
        assert.strictEqual(isSchemaV2(null), false);
      });
    });

    describe('getPromptVersion', () => {
      it('should get version from v2 payload', () => {
        const v2 = { schemaVersion: 2, experiment: { promptVersion: '2.0.0' } };
        assert.strictEqual(getPromptVersion(v2), '2.0.0');
      });

      it('should get version from v1 payload (top-level)', () => {
        const v1 = { readingPromptVersion: '1.0.0' };
        assert.strictEqual(getPromptVersion(v1), '1.0.0');
      });

      it('should get version from v1 payload (promptMeta)', () => {
        const v1 = { promptMeta: { readingPromptVersion: '1.0.0' } };
        assert.strictEqual(getPromptVersion(v1), '1.0.0');
      });
    });

    describe('getGraphRAGStats', () => {
      it('should get stats from v2 payload', () => {
        const v2 = { schemaVersion: 2, graphRAG: { includedInPrompt: true } };
        assert.deepStrictEqual(getGraphRAGStats(v2), { includedInPrompt: true });
      });

      it('should get stats from v1 promptMeta', () => {
        const v1 = { promptMeta: { graphRAG: { includedInPrompt: false } } };
        assert.deepStrictEqual(getGraphRAGStats(v1), { includedInPrompt: false });
      });

      it('should get stats from v1 top-level', () => {
        const v1 = { graphRAG: { passagesProvided: 3 } };
        assert.deepStrictEqual(getGraphRAGStats(v1), { passagesProvided: 3 });
      });
    });

    describe('getNarrativeCoverage', () => {
      it('should get coverage from v2 payload', () => {
        const v2 = {
          schemaVersion: 2,
          narrative: { coverage: { cardCount: 10, percentage: 1.0 } }
        };
        assert.deepStrictEqual(getNarrativeCoverage(v2), { cardCount: 10, percentage: 1.0 });
      });

      it('should get coverage from v1 payload', () => {
        const v1 = {
          narrative: { cardCount: 3, cardCoverage: 0.9, missingCards: ['The Star'] }
        };
        const result = getNarrativeCoverage(v1);
        assert.strictEqual(result.cardCount, 3);
        assert.strictEqual(result.percentage, 0.9);
        assert.deepStrictEqual(result.missingCards, ['The Star']);
      });
    });
  });

  describe('migratePayloadToV2', () => {
    it('should return null for null input', () => {
      assert.strictEqual(migratePayloadToV2(null), null);
    });

    it('should pass through v2 payloads unchanged', () => {
      const v2 = { schemaVersion: 2, requestId: 'test' };
      const result = migratePayloadToV2(v2);
      assert.strictEqual(result, v2);
    });

    it('should migrate v1 payload to v2 structure', () => {
      const v1 = {
        requestId: 'test-123',
        timestamp: '2024-01-01T00:00:00Z',
        provider: 'azure-gpt5',
        spreadKey: 'threeCard',
        deckStyle: 'rws-1909',
        context: 'career',
        readingPromptVersion: '1.5.0',
        variantId: 'control',
        experimentId: 'exp-1',
        promptMeta: {
          readingPromptVersion: '1.5.0',
          slimmingSteps: ['drop-forecast'],
          graphRAG: { includedInPrompt: true, passagesProvided: 3 }
        },
        narrative: {
          cardCount: 3,
          cardCoverage: 1.0,
          missingCards: [],
          hallucinatedCards: []
        },
        tokens: { input: 1000, output: 500, total: 1500, source: 'api' },
        evalGate: { ran: true, passed: true }
      };

      const result = migratePayloadToV2(v1);

      assert.strictEqual(result.schemaVersion, 2);
      assert.strictEqual(result.requestId, 'test-123');
      assert.strictEqual(result.experiment.promptVersion, '1.5.0');
      assert.strictEqual(result.experiment.variantId, 'control');
      assert.strictEqual(result.graphRAG.includedInPrompt, true);
      assert.strictEqual(result.narrative.coverage.cardCount, 3);
      assert.strictEqual(result.llmUsage.inputTokens, 1000);
    });

    it('should handle missing optional fields gracefully', () => {
      const v1 = {
        requestId: 'minimal-test',
        provider: 'local-composer'
      };

      const result = migratePayloadToV2(v1);

      assert.strictEqual(result.schemaVersion, 2);
      assert.strictEqual(result.requestId, 'minimal-test');
      assert.strictEqual(result.experiment.promptVersion, null);
      assert.strictEqual(result.graphRAG, null);
      // prompt is an object with null/default fields when promptMeta is empty
      // Note: prompt.version removed - use experiment.promptVersion instead
      assert.strictEqual(result.prompt.tokens, null);
    });
  });
});
