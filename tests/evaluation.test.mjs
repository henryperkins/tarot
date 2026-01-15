import assert from 'node:assert/strict';
import { describe, test, beforeEach } from 'node:test';

import {
  runEvaluation,
  checkEvalGate,
  buildHeuristicScores,
  scheduleEvaluation,
  runSyncEvaluationGate,
  generateSafeFallbackReading
} from '../functions/lib/evaluation.js';

const mockAI = {
  run: async () => ({ response: '' })
};

// Mock KV store for METRICS_DB testing
class MockKV {
  constructor() {
    this.store = new Map();
    this.putCalls = [];
  }

  async put(key, value, options) {
    this.putCalls.push({ key, value, options });
    this.store.set(key, { value, options });
  }

  async get(key) {
    const entry = this.store.get(key);
    return entry ? entry.value : null;
  }
}

// Mock AI Gateway for gateway log patching tests
class MockGateway {
  constructor() {
    this.patchedLogs = [];
  }

  async patchLog(logId, data) {
    this.patchedLogs.push({ logId, data });
  }
}

describe('evaluation', () => {
  beforeEach(() => {
    mockAI.run = async () => ({ response: '' });
  });

  describe('runEvaluation', () => {
    test('returns null when AI binding is missing', async () => {
      const result = await runEvaluation({}, {
        reading: 'test reading',
        userQuestion: 'test question',
        cardsInfo: [],
        spreadKey: 'test',
        requestId: 'eval-missing-ai'
      });

      assert.equal(result, null);
    });

    test('returns null when EVAL_ENABLED is not true', async () => {
      const result = await runEvaluation({ AI: mockAI, EVAL_ENABLED: 'false' }, {
        reading: 'test reading',
        userQuestion: 'test question',
        cardsInfo: [],
        spreadKey: 'test',
        requestId: 'eval-disabled'
      });

      assert.equal(result, null);
    });

    test('parses valid JSON scores from AI response', async () => {
      mockAI.run = async () => ({
        response: JSON.stringify({
          personalization: 4,
          tarot_coherence: 5,
          tone: 4,
          safety: 5,
          overall: 4,
          safety_flag: false,
          notes: 'Good reading'
        })
      });

      const result = await runEvaluation({ AI: mockAI, EVAL_ENABLED: 'true' }, {
        reading: 'Your reading shows...',
        userQuestion: 'What about my career?',
        cardsInfo: [{ position: 'Present', card: 'The Fool', orientation: 'upright' }],
        spreadKey: 'threeCard',
        requestId: 'eval-parse'
      });

      assert.equal(result.scores.overall, 4);
      assert.equal(result.scores.safety_flag, false);
      assert.equal(result.model, '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
      assert.equal(result.promptVersion, '2.0.0');
    });

    test('handles malformed JSON response', async () => {
      mockAI.run = async () => ({ response: 'I cannot evaluate this properly' });

      const result = await runEvaluation({ AI: mockAI, EVAL_ENABLED: 'true' }, {
        reading: 'test',
        userQuestion: 'test',
        cardsInfo: [],
        spreadKey: 'test',
        requestId: 'eval-malformed'
      });

      assert.equal(result.error, 'invalid_json');
    });

    test('clamps scores to 1-5 range', async () => {
      mockAI.run = async () => ({
        response: JSON.stringify({
          personalization: 10,
          tarot_coherence: -1,
          tone: 3,
          safety: 5,
          overall: 4,
          safety_flag: false
        })
      });

      const result = await runEvaluation({ AI: mockAI, EVAL_ENABLED: 'true' }, {
        reading: 'test',
        userQuestion: 'test',
        cardsInfo: [],
        spreadKey: 'test',
        requestId: 'eval-clamp'
      });

      assert.equal(result.scores.personalization, 5);
      assert.equal(result.scores.tarot_coherence, 1);
    });
  });

  describe('checkEvalGate', () => {
    test('blocks on safety_flag', () => {
      const result = checkEvalGate({
        scores: { safety_flag: true, safety: 1, tone: 3 }
      });
      assert.equal(result.shouldBlock, true);
      assert.equal(result.reason, 'safety_flag');
    });

    test('blocks on very low safety score', () => {
      const result = checkEvalGate({
        scores: { safety_flag: false, safety: 1, tone: 3 }
      });
      assert.equal(result.shouldBlock, true);
      assert.equal(result.reason, 'safety_score_1');
    });

    test('blocks on very low tone', () => {
      const result = checkEvalGate({
        scores: { safety_flag: false, safety: 4, tone: 1 }
      });
      assert.equal(result.shouldBlock, true);
      assert.equal(result.reason, 'tone_score_1');
    });

    test('passes good scores', () => {
      const result = checkEvalGate({
        scores: { safety_flag: false, safety: 5, tone: 4 }
      });
      assert.equal(result.shouldBlock, false);
      assert.equal(result.reason, null);
    });
  });

  describe('buildHeuristicScores', () => {
    test('scores based on card coverage', () => {
      const result = buildHeuristicScores({ cardCoverage: 0.95 });
      assert.equal(result.scores.tarot_coherence, 5);
    });

    test('flags hallucinated cards', () => {
      const result = buildHeuristicScores({
        cardCoverage: 0.5,
        hallucinatedCards: ['The Sun', 'The Moon', 'The Star']
      });
      assert.equal(result.scores.safety_flag, true);
    });

    test('scores medium card coverage as 4', () => {
      const result = buildHeuristicScores({ cardCoverage: 0.75 });
      assert.equal(result.scores.tarot_coherence, 4);
    });

    test('scores low card coverage as 3', () => {
      const result = buildHeuristicScores({ cardCoverage: 0.55 });
      assert.equal(result.scores.tarot_coherence, 3);
    });

    test('scores very low card coverage as 2', () => {
      const result = buildHeuristicScores({ cardCoverage: 0.3 });
      assert.equal(result.scores.tarot_coherence, 2);
    });

    test('includes heuristic model identifier', () => {
      const result = buildHeuristicScores({ cardCoverage: 0.9 });
      assert.equal(result.model, 'heuristic-fallback');
    });

    test('includes timestamp', () => {
      const result = buildHeuristicScores({ cardCoverage: 0.9 });
      assert.ok(result.timestamp);
      assert.ok(new Date(result.timestamp).getTime() > 0);
    });

    test('provides conservative defaults for non-assessable dimensions', () => {
      const result = buildHeuristicScores({ cardCoverage: 0.8 });
      assert.equal(result.scores.personalization, 3);
      assert.equal(result.scores.tone, 3);
      assert.equal(result.scores.safety, 3);
    });

    test('sets overall score based on minimum of default and tarot_coherence', () => {
      // High coverage: overall = min(3, 5) = 3
      const highResult = buildHeuristicScores({ cardCoverage: 0.95 });
      assert.equal(highResult.scores.overall, 3);

      // Low coverage: overall = min(3, 2) = 2
      const lowResult = buildHeuristicScores({ cardCoverage: 0.4 });
      assert.equal(lowResult.scores.overall, 2);
    });

    test('marks mode as heuristic', () => {
      const result = buildHeuristicScores({ cardCoverage: 0.8 });
      assert.equal(result.mode, 'heuristic');
    });
  });

  describe('runEvaluation - timeout handling', () => {
    test('returns timeout error when AI call exceeds timeout', async () => {
      const slowMockAI = {
        run: async (model, params, options) => {
          // Simulate a slow response that will be aborted
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              resolve({ response: '{}' });
            }, 10000);

            // Handle abort signal
            if (options?.signal) {
              options.signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                const error = new Error('Aborted');
                error.name = 'AbortError';
                reject(error);
              });
            }
          });
        }
      };

      const result = await runEvaluation(
        { AI: slowMockAI, EVAL_ENABLED: 'true', EVAL_TIMEOUT_MS: '50' },
        {
          reading: 'test',
          userQuestion: 'test',
          cardsInfo: [],
          spreadKey: 'test',
          requestId: 'eval-timeout'
        }
      );

      assert.equal(result.error, 'timeout');
      assert.ok(result.latencyMs >= 50);
    });

    test('completes successfully when AI responds within timeout', async () => {
      const fastMockAI = {
        run: async () => ({
          response: JSON.stringify({
            personalization: 4,
            tarot_coherence: 4,
            tone: 4,
            safety: 5,
            overall: 4,
            safety_flag: false
          })
        })
      };

      const result = await runEvaluation(
        { AI: fastMockAI, EVAL_ENABLED: 'true', EVAL_TIMEOUT_MS: '5000' },
        {
          reading: 'test',
          userQuestion: 'test',
          cardsInfo: [],
          spreadKey: 'test',
          requestId: 'eval-fast'
        }
      );

      assert.equal(result.scores.overall, 4);
      assert.ok(!result.error);
    });
  });

  describe('runEvaluation - input length guards', () => {
    test('truncates very long readings to prevent context overflow', async () => {
      let capturedPrompt = '';
      const capturingMockAI = {
        run: async (model, params) => {
          capturedPrompt = params.messages[1].content;
          return {
            response: JSON.stringify({
              personalization: 4,
              tarot_coherence: 4,
              tone: 4,
              safety: 5,
              overall: 4,
              safety_flag: false
            })
          };
        }
      };

      const longReading = 'A'.repeat(12000);  // Exceeds 10000 char limit

      await runEvaluation(
        { AI: capturingMockAI, EVAL_ENABLED: 'true' },
        {
          reading: longReading,
          userQuestion: 'test',
          cardsInfo: [],
          spreadKey: 'test',
          requestId: 'eval-truncate-reading'
        }
      );

      // Verify truncation occurs for long readings
      assert.ok(capturedPrompt.includes('[truncated]'), 'Long reading should be truncated');
      assert.ok(!capturedPrompt.includes('A'.repeat(12000)), 'Full 12000 chars should not be present');
      assert.ok(capturedPrompt.includes('A'.repeat(8000)), 'At least 8000 chars should be preserved');
    });

    test('truncates very long user questions to prevent context overflow', async () => {
      let capturedPrompt = '';
      const capturingMockAI = {
        run: async (model, params) => {
          capturedPrompt = params.messages[1].content;
          return {
            response: JSON.stringify({
              personalization: 4,
              tarot_coherence: 4,
              tone: 4,
              safety: 5,
              overall: 4,
              safety_flag: false
            })
          };
        }
      };

      const longQuestion = 'What should I do about ' + 'my situation '.repeat(100);  // Exceeds 500 char limit

      await runEvaluation(
        { AI: capturingMockAI, EVAL_ENABLED: 'true' },
        {
          reading: 'test reading',
          userQuestion: longQuestion,
          cardsInfo: [],
          spreadKey: 'test',
          requestId: 'eval-truncate-question'
        }
      );

      // Verify question is truncated
      assert.ok(capturedPrompt.includes('[truncated]') || !capturedPrompt.includes(longQuestion),
        'Long question should be truncated');
    });

    test('preserves short readings without truncation', async () => {
      let capturedPrompt = '';
      const capturingMockAI = {
        run: async (model, params) => {
          capturedPrompt = params.messages[1].content;
          return {
            response: JSON.stringify({
              personalization: 4,
              tarot_coherence: 4,
              tone: 4,
              safety: 5,
              overall: 4,
              safety_flag: false
            })
          };
        }
      };

      const shortReading = 'This is a normal length reading that should not be truncated.';

      await runEvaluation(
        { AI: capturingMockAI, EVAL_ENABLED: 'true' },
        {
          reading: shortReading,
          userQuestion: 'What about my career?',
          cardsInfo: [],
          spreadKey: 'test',
          requestId: 'eval-no-truncate'
        }
      );

      // Verify NO truncation for short content
      assert.ok(!capturedPrompt.includes('[truncated]'), 'Short content should not be truncated');
      assert.ok(capturedPrompt.includes(shortReading), 'Full short reading should be preserved');
    });

    test('preserves all card information without truncation', async () => {
      let capturedPrompt = '';
      const capturingMockAI = {
        run: async (model, params) => {
          capturedPrompt = params.messages[1].content;
          return {
            response: JSON.stringify({
              personalization: 4,
              tarot_coherence: 4,
              tone: 4,
              safety: 5,
              overall: 4,
              safety_flag: false
            })
          };
        }
      };

      // Celtic Cross spread with all 10 cards
      const fullSpread = [
        { position: 'Present', card: 'The Fool', orientation: 'upright' },
        { position: 'Challenge', card: 'The Magician', orientation: 'reversed' },
        { position: 'Past', card: 'The High Priestess', orientation: 'upright' },
        { position: 'Future', card: 'The Empress', orientation: 'upright' },
        { position: 'Above', card: 'The Emperor', orientation: 'reversed' },
        { position: 'Below', card: 'The Hierophant', orientation: 'upright' },
        { position: 'Advice', card: 'The Lovers', orientation: 'upright' },
        { position: 'External', card: 'The Chariot', orientation: 'reversed' },
        { position: 'Hopes', card: 'Strength', orientation: 'upright' },
        { position: 'Outcome', card: 'The Hermit', orientation: 'upright' }
      ];

      await runEvaluation(
        { AI: capturingMockAI, EVAL_ENABLED: 'true' },
        {
          reading: 'test reading',
          userQuestion: 'test',
          cardsInfo: fullSpread,
          spreadKey: 'celticCross',
          requestId: 'eval-full-spread'
        }
      );

      // Verify all cards are included
      for (const card of fullSpread) {
        assert.ok(capturedPrompt.includes(card.card), `Missing card: ${card.card}`);
        assert.ok(capturedPrompt.includes(card.position), `Missing position: ${card.position}`);
      }
    });

    test('returns truncation metadata when inputs are clipped', async () => {
      mockAI.run = async () => ({
        response: JSON.stringify({
          personalization: 4,
          tarot_coherence: 4,
          tone: 4,
          safety: 5,
          overall: 4,
          safety_flag: false
        })
      });

      const longReading = 'B'.repeat(12000);  // Exceeds 10000 char limit
      const longQuestion = 'C'.repeat(800);

      const result = await runEvaluation(
        { AI: mockAI, EVAL_ENABLED: 'true' },
        {
          reading: longReading,
          userQuestion: longQuestion,
          cardsInfo: [],
          spreadKey: 'test',
          requestId: 'eval-truncation-metadata'
        }
      );

      assert.ok(Array.isArray(result.truncations));
      assert.ok(result.truncations.some((entry) => entry.includes('reading (12000 chars')), 'Missing reading truncation entry');
      assert.ok(result.truncations.some((entry) => entry.includes('question (800 chars')), 'Missing question truncation entry');
    });
  });

  describe('scheduleEvaluation', () => {
    test('does not run when EVAL_ENABLED is false', async () => {
      let evalRan = false;
      const trackingMockAI = {
        run: async () => {
          evalRan = true;
          return { response: '{}' };
        }
      };

      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      scheduleEvaluation(
        { AI: trackingMockAI, EVAL_ENABLED: 'false' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'test-1' },
        {},
        { waitUntil }
      );

      // Wait for any scheduled promises
      await Promise.all(waitPromises);
      assert.equal(evalRan, false);
    });

    test('stores eval results in METRICS_DB when available', async () => {
      const mockKV = new MockKV();
      const scoringMockAI = {
        run: async () => ({
          response: JSON.stringify({
            personalization: 4,
            tarot_coherence: 5,
            tone: 4,
            safety: 5,
            overall: 4,
            safety_flag: false,
            notes: 'Good reading'
          })
        })
      };

      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      scheduleEvaluation(
        { AI: scoringMockAI, EVAL_ENABLED: 'true', METRICS_DB: mockKV },
        { reading: 'test reading', userQuestion: 'test question', cardsInfo: [], spreadKey: 'threeCard', requestId: 'kv-test-1' },
        { requestId: 'kv-test-1', spreadKey: 'threeCard', provider: 'claude' },
        { waitUntil }
      );

      await Promise.all(waitPromises);

      assert.equal(mockKV.putCalls.length, 1);
      assert.equal(mockKV.putCalls[0].key, 'reading:kv-test-1');

      const storedData = JSON.parse(mockKV.putCalls[0].value);
      assert.ok(storedData.eval);
      assert.equal(storedData.eval.scores.overall, 4);
    });

    test('includes metadata in KV storage', async () => {
      const mockKV = new MockKV();
      const scoringMockAI = {
        run: async () => ({
          response: JSON.stringify({
            personalization: 4,
            tarot_coherence: 5,
            tone: 4,
            safety: 5,
            overall: 4,
            safety_flag: false
          })
        })
      };

      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      scheduleEvaluation(
        { AI: scoringMockAI, EVAL_ENABLED: 'true', METRICS_DB: mockKV },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'celtic', requestId: 'meta-test' },
        { requestId: 'meta-test', spreadKey: 'celtic', provider: 'gpt', deckStyle: 'rws-1909' },
        { waitUntil }
      );

      await Promise.all(waitPromises);

      const putCall = mockKV.putCalls[0];
      assert.ok(putCall.options.metadata);
      assert.equal(putCall.options.metadata.spreadKey, 'celtic');
      assert.equal(putCall.options.metadata.provider, 'gpt');
      assert.equal(putCall.options.metadata.deckStyle, 'rws-1909');
      assert.equal(putCall.options.metadata.hasEval, true);
      assert.equal(putCall.options.metadata.evalScore, 4);
    });

    test('falls back to heuristic scores when AI evaluation fails', async () => {
      const mockKV = new MockKV();
      const failingMockAI = {
        run: async () => ({ response: 'not valid json' })
      };

      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      scheduleEvaluation(
        { AI: failingMockAI, EVAL_ENABLED: 'true', METRICS_DB: mockKV },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'heuristic-fallback-test' },
        { requestId: 'heuristic-fallback-test', narrative: { cardCoverage: 0.9 } },
        { waitUntil }
      );

      await Promise.all(waitPromises);

      const storedData = JSON.parse(mockKV.putCalls[0].value);
      assert.ok(storedData.eval.heuristic);
      assert.equal(storedData.eval.heuristic.model, 'heuristic-fallback');
    });

    test('patches AI Gateway log when gateway is available', async () => {
      const mockGateway = new MockGateway();
      const mockKV = new MockKV();
      const scoringMockAI = {
        aiGatewayLogId: 'log-12345',
        gateway: () => mockGateway,
        run: async () => ({
          response: JSON.stringify({
            personalization: 4,
            tarot_coherence: 5,
            tone: 4,
            safety: 5,
            overall: 4,
            safety_flag: false
          })
        })
      };

      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      scheduleEvaluation(
        { AI: scoringMockAI, EVAL_ENABLED: 'true', EVAL_GATEWAY_ID: 'my-gateway', METRICS_DB: mockKV },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'threeCard', requestId: 'gateway-test' },
        { requestId: 'gateway-test', spreadKey: 'threeCard', provider: 'claude', deckStyle: 'rws-1909' },
        { waitUntil }
      );

      await Promise.all(waitPromises);

      assert.equal(mockGateway.patchedLogs.length, 1);
      assert.equal(mockGateway.patchedLogs[0].logId, 'log-12345');
      assert.ok(mockGateway.patchedLogs[0].data.metadata);
      assert.equal(mockGateway.patchedLogs[0].data.metadata.requestId, 'gateway-test');
      assert.equal(mockGateway.patchedLogs[0].data.metadata.spreadKey, 'threeCard');
    });

    test('continues when gateway patching fails', async () => {
      const failingGateway = {
        patchLog: async () => {
          throw new Error('Gateway unavailable');
        }
      };
      const mockKV = new MockKV();
      const scoringMockAI = {
        aiGatewayLogId: 'log-12345',
        gateway: () => failingGateway,
        run: async () => ({
          response: JSON.stringify({
            personalization: 4,
            tarot_coherence: 5,
            tone: 4,
            safety: 5,
            overall: 4,
            safety_flag: false
          })
        })
      };

      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      // Should not throw
      scheduleEvaluation(
        { AI: scoringMockAI, EVAL_ENABLED: 'true', EVAL_GATEWAY_ID: 'my-gateway', METRICS_DB: mockKV },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gateway-fail-test' },
        { requestId: 'gateway-fail-test' },
        { waitUntil }
      );

      await Promise.all(waitPromises);

      // KV storage should still happen even if gateway fails
      assert.equal(mockKV.putCalls.length, 1);
    });

    test('runs inline when waitUntil is unavailable', async () => {
      const mockKV = new MockKV();
      const scoringMockAI = {
        run: async () => ({
          response: JSON.stringify({
            personalization: 4,
            tarot_coherence: 4,
            tone: 4,
            safety: 5,
            overall: 4,
            safety_flag: false
          })
        })
      };

      // Call without waitUntil - should return a promise that runs inline
      const result = scheduleEvaluation(
        { AI: scoringMockAI, EVAL_ENABLED: 'true', METRICS_DB: mockKV },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'inline-test' },
        { requestId: 'inline-test' },
        {} // no waitUntil
      );

      // Wait for inline execution
      await result;

      assert.equal(mockKV.putCalls.length, 1);
    });

    test('stores precomputed gate evaluation without rerunning AI', async () => {
      const mockKV = new MockKV();
      let runCalled = false;
      const trackingAI = {
        run: async () => {
          runCalled = true;
          return { response: '{}' };
        }
      };

      const precomputedEval = {
        scores: {
          personalization: 5,
          tarot_coherence: 5,
          tone: 5,
          safety: 5,
          overall: 5,
          safety_flag: false
        },
        model: 'gate-model',
        latencyMs: 10,
        promptVersion: '1.2.0',
        timestamp: new Date().toISOString(),
        mode: 'model'
      };

      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      scheduleEvaluation(
        { AI: trackingAI, EVAL_ENABLED: 'true', METRICS_DB: mockKV },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'precomputed-store' },
        { requestId: 'precomputed-store', spreadKey: 'test', provider: 'claude' },
        { waitUntil, precomputedEvalResult: precomputedEval }
      );

      await Promise.all(waitPromises);

      assert.equal(runCalled, false);
      assert.equal(mockKV.putCalls.length, 1);
      const storedData = JSON.parse(mockKV.putCalls[0].value);
      assert.equal(storedData.eval.model, 'gate-model');
      assert.equal(storedData.eval.scores.overall, 5);
    });

    test('applies redaction and drops unsafe metrics fields in redact mode', async () => {
      const mockKV = new MockKV();
      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      const precomputedEval = {
        scores: {
          personalization: 4,
          tarot_coherence: 4,
          tone: 4,
          safety: 5,
          overall: 4,
          safety_flag: false
        },
        model: 'gate-model',
        latencyMs: 10,
        promptVersion: '1.2.0',
        timestamp: new Date().toISOString(),
        mode: 'model'
      };

      const metricsPayload = {
        requestId: 'redact-mode',
        spreadKey: 'threeCard',
        provider: 'claude',
        context: 'user context with pii',
        promptEngineering: { raw: 'should not persist' },
        extraField: 'drop me'
      };

      scheduleEvaluation(
        { AI: mockAI, EVAL_ENABLED: 'true', METRICS_DB: mockKV, METRICS_STORAGE_MODE: 'redact' },
        {
          reading: "Hello John Doe, Alex's journey unfolds on 2025-12-25.",
          userQuestion: 'Call me Jane Doe at 555-123-9876 ext 55, what is next on 2025-12-25?',
          cardsInfo: [{ position: 'Present', card: 'The Fool', orientation: 'upright', notes: 'ignore' }],
          spreadKey: 'threeCard',
          requestId: 'redact-mode'
        },
        metricsPayload,
        { waitUntil, precomputedEvalResult: precomputedEval }
      );

      await Promise.all(waitPromises);

      const storedData = JSON.parse(mockKV.putCalls[0].value);
      assert.equal(storedData._storageMode, 'redact');
      assert.ok(!('context' in storedData));
      assert.ok(!('promptEngineering' in storedData));
      assert.ok(!('extraField' in storedData));
      assert.ok(storedData.readingText.includes('[NAME]'));
      assert.ok(!storedData.readingText.includes('John Doe'));
      assert.ok(!storedData.userQuestion.includes('Jane Doe'));
      assert.ok(storedData.userQuestion.includes('[PHONE]'));
      assert.ok(!storedData.userQuestion.includes('2025-12-25'));
      assert.ok(!storedData.readingText.includes('2025-12-25'));
      assert.equal(storedData.cardsInfo[0].card, 'The Fool');
    });

    test('strips payload down in minimal mode while keeping eval scores', async () => {
      const mockKV = new MockKV();
      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      const precomputedEval = {
        scores: {
          personalization: 3,
          tarot_coherence: 4,
          tone: 4,
          safety: 5,
          overall: 4,
          safety_flag: false
        },
        model: 'gate-model',
        latencyMs: 5,
        promptVersion: '1.2.0',
        timestamp: new Date().toISOString(),
        mode: 'model'
      };

      const metricsPayload = {
        requestId: 'minimal-mode',
        spreadKey: 'single',
        provider: 'claude',
        context: 'sensitive context'
      };

      scheduleEvaluation(
        { AI: mockAI, EVAL_ENABLED: 'true', METRICS_DB: mockKV, METRICS_STORAGE_MODE: 'minimal' },
        {
          reading: 'Hello Casey, gentle reminder.',
          userQuestion: 'name is Casey',
          cardsInfo: [{ position: 'Single', card: 'The Star', orientation: 'upright' }],
          spreadKey: 'single',
          requestId: 'minimal-mode'
        },
        metricsPayload,
        { waitUntil, precomputedEvalResult: precomputedEval }
      );

      await Promise.all(waitPromises);

      const storedData = JSON.parse(mockKV.putCalls[0].value);
      assert.equal(storedData._storageMode, 'minimal');
      assert.ok(!('context' in storedData));
      assert.ok(!('readingText' in storedData));
      assert.ok(!('cardsInfo' in storedData));
      assert.equal(storedData.eval.scores.overall, 4);
      assert.equal(storedData.cardCount, 1);
    });
  });

  describe('runSyncEvaluationGate', () => {
    test('blocks when evaluation returns an error (fail closed)', async () => {
      const failingAI = {
        run: async () => ({ response: 'not json' })
      };

      const result = await runSyncEvaluationGate(
        { AI: failingAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-error' },
        { cardCoverage: 1.0 }  // Good coverage = no safety flag
      );

      // With good coverage, heuristic fallback still blocks due to eval failure
      assert.equal(result.passed, false);
      assert.equal(result.evalResult.mode, 'heuristic');
      assert.ok(result.evalResult.fallbackReason.includes('eval_error'));
      assert.equal(result.gateResult.reason, 'eval_unavailable');
    });

    test('blocks with heuristic fallback when safety flag is triggered', async () => {
      const failingAI = {
        run: async () => ({ response: 'not json' })
      };

      const result = await runSyncEvaluationGate(
        { AI: failingAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-safety' },
        { cardCoverage: 0.2, hallucinatedCards: ['A', 'B', 'C'] }  // Triggers safety flag
      );

      // Heuristic fallback with safety issues should still block
      assert.equal(result.passed, false);
      assert.equal(result.evalResult.mode, 'heuristic');
      assert.equal(result.gateResult.reason, 'safety_flag');
    });

    test('blocks when evaluation scores are incomplete (fail closed)', async () => {
      const missingFieldAI = {
        run: async () => ({
          response: JSON.stringify({
            personalization: 4,
            tarot_coherence: 4,
            tone: 4,
            overall: 4,
            safety_flag: false
            // Missing 'safety' field
          })
        })
      };

      const result = await runSyncEvaluationGate(
        { AI: missingFieldAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-missing' },
        { cardCoverage: 0.9 }  // Good coverage
      );

      // Falls back to heuristic but still blocks due to incomplete scores
      assert.equal(result.passed, false);
      assert.equal(result.evalResult.mode, 'heuristic');
      assert.ok(result.evalResult.fallbackReason.includes('incomplete_scores'));
      assert.equal(result.gateResult.reason, 'eval_incomplete_scores');
    });

    test('blocks on low safety score from AI evaluation', async () => {
      const unsafeAI = {
        run: async () => ({
          response: JSON.stringify({
            personalization: 4,
            tarot_coherence: 4,
            tone: 4,
            safety: 1,  // Very low safety
            overall: 3,
            safety_flag: false
          })
        })
      };

      const result = await runSyncEvaluationGate(
        { AI: unsafeAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-unsafe' },
        { cardCoverage: 0.9 }
      );

      assert.equal(result.passed, false);
      assert.equal(result.gateResult.reason, 'safety_score_1');
    });

    test('generates a safe fallback reading with spread context', () => {
      const text = generateSafeFallbackReading({ spreadKey: 'threeCard', cardCount: 3, reason: 'safety_flag' });
      assert.ok(text.includes('Three-Card'));
      assert.ok(text.includes('3 card'));
      assert.ok(text.includes('reflect'));
    });
  });

  describe('checkEvalGate - edge cases', () => {
    test('handles null evalResult gracefully', () => {
      const result = checkEvalGate(null);
      assert.equal(result.shouldBlock, false);
      assert.equal(result.reason, null);
    });

    test('handles evalResult without scores', () => {
      const result = checkEvalGate({ error: 'timeout' });
      assert.equal(result.shouldBlock, false);
      assert.equal(result.reason, null);
    });

    test('does not block on safety score of 2', () => {
      const result = checkEvalGate({
        scores: { safety_flag: false, safety: 2, tone: 4 }
      });
      assert.equal(result.shouldBlock, false);
    });

    test('warns on tone score of 2 without blocking', () => {
      const result = checkEvalGate({
        scores: { safety_flag: false, safety: 4, tone: 2 }
      });
      assert.equal(result.shouldBlock, false);
      assert.equal(result.reason, null); // tone >= 2 doesn't warn
    });
  });

  describe('integration: full evaluation pipeline', () => {
    test('complete flow from reading to stored evaluation', async () => {
      const mockKV = new MockKV();
      const mockGateway = new MockGateway();

      const comprehensiveMockAI = {
        aiGatewayLogId: 'integration-log-001',
        gateway: () => mockGateway,
        run: async () => ({
          response: JSON.stringify({
            personalization: 5,
            tarot_coherence: 5,
            tone: 5,
            safety: 5,
            overall: 5,
            safety_flag: false,
            notes: 'Excellent personalized reading'
          })
        })
      };

      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      // Simulate the complete flow
      const evalParams = {
        reading: 'The Fool card in your present position suggests a new beginning...',
        userQuestion: 'What should I focus on this month?',
        cardsInfo: [
          { position: 'Present', card: 'The Fool', orientation: 'upright' },
          { position: 'Challenge', card: 'The Tower', orientation: 'reversed' },
          { position: 'Advice', card: 'The Star', orientation: 'upright' }
        ],
        spreadKey: 'threeCard',
        requestId: 'integration-test-001'
      };

      const metricsPayload = {
        requestId: 'integration-test-001',
        spreadKey: 'threeCard',
        provider: 'claude',
        deckStyle: 'rws-1909',
        timestamp: new Date().toISOString(),
        narrative: {
          cardCoverage: 1.0,
          hallucinatedCards: []
        }
      };

      scheduleEvaluation(
        {
          AI: comprehensiveMockAI,
          EVAL_ENABLED: 'true',
          EVAL_GATEWAY_ID: 'test-gateway',
          METRICS_DB: mockKV
        },
        evalParams,
        metricsPayload,
        { waitUntil }
      );

      await Promise.all(waitPromises);

      // Verify KV storage
      assert.equal(mockKV.putCalls.length, 1);
      const storedData = JSON.parse(mockKV.putCalls[0].value);

      // Verify eval scores stored
      assert.equal(storedData.eval.scores.overall, 5);
      assert.equal(storedData.eval.scores.safety_flag, false);
      assert.equal(storedData.eval.model, '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
      assert.equal(storedData.eval.promptVersion, '2.0.0');

      // Verify original metrics preserved
      assert.equal(storedData.requestId, 'integration-test-001');
      assert.equal(storedData.spreadKey, 'threeCard');
      assert.equal(storedData.provider, 'claude');

      // Verify gateway was patched
      assert.equal(mockGateway.patchedLogs.length, 1);
      assert.equal(mockGateway.patchedLogs[0].data.metadata.requestId, 'integration-test-001');

      // Verify gate check passes
      const gateResult = checkEvalGate(storedData.eval);
      assert.equal(gateResult.shouldBlock, false);
    });

    test('pipeline handles safety flag and logs warning', async () => {
      const mockKV = new MockKV();
      const warningLogs = [];
      const originalWarn = console.warn;
      console.warn = (...args) => warningLogs.push(args.join(' '));

      const unsafeMockAI = {
        run: async () => ({
          response: JSON.stringify({
            personalization: 4,
            tarot_coherence: 4,
            tone: 2,
            safety: 3,
            overall: 3,
            safety_flag: true,
            notes: 'Contains hallucinated card'
          })
        })
      };

      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      scheduleEvaluation(
        { AI: unsafeMockAI, EVAL_ENABLED: 'true', METRICS_DB: mockKV },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'safety-flag-test' },
        { requestId: 'safety-flag-test' },
        { waitUntil }
      );

      await Promise.all(waitPromises);
      console.warn = originalWarn;

      // Verify safety flag was logged
      assert.ok(warningLogs.some(log => log.includes('SAFETY FLAG TRIGGERED')));

      // Verify low tone was logged
      assert.ok(warningLogs.some(log => log.includes('Low tone score: 2')));

      // Verify gate would block this
      const storedData = JSON.parse(mockKV.putCalls[0].value);
      const gateResult = checkEvalGate(storedData.eval);
      assert.equal(gateResult.shouldBlock, true);
      assert.equal(gateResult.reason, 'safety_flag');
    });
  });
});
