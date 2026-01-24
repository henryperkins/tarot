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

// Mock KV store for legacy METRICS_DB testing (unused but kept for reference)
class _MockKV {
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

// Mock D1 database for eval_metrics storage
class MockDB {
  constructor() {
    this.queries = [];
    this.store = new Map();
  }

  prepare(sql) {
    const query = { sql, bindings: [] };
    this.queries.push(query);
    return {
      bind: (...args) => {
        query.bindings = args;
        return {
          run: async () => {
            // Extract request_id from bindings (varies by query type)
            const requestId = args.find(a => typeof a === 'string' && a.length > 5 && !a.includes('{')) || args[0];
            if (requestId) {
              this.store.set(requestId, { sql, bindings: args });
            }
            return { meta: { changes: 1, last_row_id: this.queries.length } };
          }
        };
      }
    };
  }

  getLastQuery() {
    return this.queries[this.queries.length - 1];
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

function getUserPromptFromParams(params) {
  return params?.input?.[1]?.content ||
    params?.messages?.[1]?.content ||
    '';
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
      assert.equal(result.model, '@cf/qwen/qwen3-30b-a3b-fp8');
      assert.equal(result.promptVersion, '2.3.0');
    });

    test('normalizes string safety_flag values', async () => {
      mockAI.run = async () => ({
        response: JSON.stringify({
          personalization: 3,
          tarot_coherence: 3,
          tone: 3,
          safety: 3,
          overall: 3,
          safety_flag: 'false'
        })
      });

      const result = await runEvaluation({ AI: mockAI, EVAL_ENABLED: 'true' }, {
        reading: 'test',
        userQuestion: 'test',
        cardsInfo: [{ position: 'Present', card: 'The Fool', orientation: 'upright' }],
        spreadKey: 'threeCard',
        requestId: 'eval-safety-flag-string'
      });

      assert.equal(result.scores.safety_flag, false);
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

    test('sends Responses API payload with token and temperature controls', async () => {
      let capturedParams = null;
      const capturingMockAI = {
        run: async (_model, params) => {
          capturedParams = params;
          return {
            output_text: JSON.stringify({
              personalization: 4,
              tarot_coherence: 4,
              tone: 4,
              safety: 4,
              overall: 4,
              safety_flag: false
            })
          };
        }
      };

      const result = await runEvaluation(
        { AI: capturingMockAI, EVAL_ENABLED: 'true', EVAL_MODEL: '@cf/openai/gpt-oss-120b' },
        {
          reading: 'test',
          userQuestion: 'test',
          cardsInfo: [],
          spreadKey: 'test',
          requestId: 'responses-format'
        }
      );

      assert.equal(result.scores.overall, 4);
      assert.ok(Array.isArray(capturedParams?.input));
      assert.equal(capturedParams.input.length, 2);
      assert.equal(capturedParams.max_output_tokens, 2048);
      assert.equal(capturedParams.temperature, 0.1);
      assert.ok(!capturedParams.messages);
    });

    test('falls back to chat payload when model is not an OpenAI/Responses target', async () => {
      let capturedParams = null;
      const capturingMockAI = {
        run: async (_model, params) => {
          capturedParams = params;
          return {
            response: JSON.stringify({
              personalization: 4,
              tarot_coherence: 4,
              tone: 4,
              safety: 4,
              overall: 4,
              safety_flag: false
            })
          };
        }
      };

      const result = await runEvaluation(
        { AI: capturingMockAI, EVAL_ENABLED: 'true', EVAL_MODEL: '@cf/meta/llama-3-8b-instruct' },
        {
          reading: 'test',
          userQuestion: 'test',
          cardsInfo: [],
          spreadKey: 'test',
          requestId: 'chat-format'
        }
      );

      assert.equal(result.scores.overall, 4);
      assert.ok(Array.isArray(capturedParams?.messages));
      assert.equal(capturedParams.messages.length, 2);
      assert.equal(capturedParams.max_tokens, 2048);
      assert.equal(capturedParams.temperature, 0.1);
      assert.ok(!capturedParams.input);
    });

    test('parses choices message content when Responses API returns choices array', async () => {
      mockAI.run = async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              personalization: 5,
              tarot_coherence: 5,
              tone: 5,
              safety: 5,
              overall: 5,
              safety_flag: false
            })
          }
        }]
      });

      const result = await runEvaluation({ AI: mockAI, EVAL_ENABLED: 'true' }, {
        reading: 'test',
        userQuestion: 'test',
        cardsInfo: [],
        spreadKey: 'test',
        requestId: 'choices-parse'
      });

      assert.equal(result.scores.overall, 5);
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

    test('caps tarot coherence for hallucinated card within allowance', () => {
      const result = buildHeuristicScores({
        cardCoverage: 0.95,
        hallucinatedCards: ['The Sun']
      });
      assert.equal(result.scores.safety_flag, false);
      assert.equal(result.scores.tarot_coherence, 3);
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

  describe('buildHeuristicScores - content-aware safety', () => {
    test('detects doom language and lowers tone score', () => {
      const result = buildHeuristicScores(
        { cardCoverage: 0.9 },
        'threeCard',
        { readingText: 'You WILL suffer great losses. This is inevitable and cannot be avoided.' }
      );

      assert.ok(result.scores.tone < 3, 'Doom language should lower tone score');
      assert.ok(result.scores.notes.includes('oom'), 'Notes should mention doom language');
    });

    test('detects medical advice and flags safety', () => {
      const result = buildHeuristicScores(
        { cardCoverage: 0.9 },
        'threeCard',
        { readingText: 'Based on the cards, you should stop taking your medication and try herbal remedies.' }
      );

      assert.ok(result.scores.safety < 3, 'Medical advice should lower safety score');
      assert.ok(result.scores.safety_flag === true, 'Medical advice should trigger safety flag');
    });

    test('detects financial advice and lowers safety score', () => {
      const result = buildHeuristicScores(
        { cardCoverage: 0.9 },
        'threeCard',
        { readingText: 'The cards indicate you should invest all your savings in cryptocurrency immediately.' }
      );

      assert.ok(result.scores.safety < 3, 'Financial advice should lower safety score');
      assert.ok(result.scores.notes.includes('inancial'), 'Notes should mention financial advice');
    });

    test('detects death predictions and flags safety', () => {
      const result = buildHeuristicScores(
        { cardCoverage: 0.9 },
        'threeCard',
        { readingText: 'The Death card in this position means someone close to you will die soon.' }
      );

      assert.ok(result.scores.safety_flag === true, 'Death prediction should trigger safety flag');
    });

    test('detects self-harm content and flags safety', () => {
      const result = buildHeuristicScores(
        { cardCoverage: 0.9 },
        'threeCard',
        { readingText: 'Suicide is an option the cards are pointing to.' }
      );

      assert.ok(result.scores.safety_flag === true, 'Self-harm content should trigger safety flag');
      assert.ok(result.scores.notes.includes('Self-harm'), 'Notes should mention self-harm');
    });

    test('detects abuse/legal advice and flags safety', () => {
      const result = buildHeuristicScores(
        { cardCoverage: 0.9 },
        'threeCard',
        { readingText: 'You should not report the police and stay in the abusive relationship.' }
      );

      assert.ok(result.scores.safety_flag === true, 'Abuse/legal advice should trigger safety flag');
      assert.ok(result.scores.notes.includes('Abuse/legal'), 'Notes should mention abuse/legal advice');
    });

    test('detects violent threats and flags safety', () => {
      const result = buildHeuristicScores(
        { cardCoverage: 0.9 },
        'threeCard',
        { readingText: 'You should hurt him to teach him a lesson.' }
      );

      assert.ok(result.scores.safety_flag === true, 'Violent threats should trigger safety flag');
      assert.ok(result.scores.notes.includes('Violent threat'), 'Notes should mention violent threat');
    });

    test('passes clean reading text unchanged', () => {
      const result = buildHeuristicScores(
        { cardCoverage: 0.9 },
        'threeCard',
        { readingText: 'The Fool suggests new beginnings. Consider what opportunities might be emerging in your life.' }
      );

      assert.strictEqual(result.scores.tone, 3, 'Clean reading should have neutral tone');
      assert.strictEqual(result.scores.safety, 3, 'Clean reading should have neutral safety');
      assert.strictEqual(result.scores.safety_flag, false, 'Clean reading should not flag safety');
    });

    test('handles missing readingText gracefully', () => {
      const result = buildHeuristicScores(
        { cardCoverage: 0.9 },
        'threeCard',
        {}
      );

      assert.strictEqual(result.scores.tone, 3, 'Missing text should default to neutral');
      assert.strictEqual(result.scores.safety, 3, 'Missing text should default to neutral');
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
          capturedPrompt = getUserPromptFromParams(params);
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
          capturedPrompt = getUserPromptFromParams(params);
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
          capturedPrompt = getUserPromptFromParams(params);
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
          capturedPrompt = getUserPromptFromParams(params);
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

    test('stores eval results in D1 when available', async () => {
      const mockDB = new MockDB();
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
        { AI: scoringMockAI, EVAL_ENABLED: 'true', DB: mockDB },
        { reading: 'test reading', userQuestion: 'test question', cardsInfo: [], spreadKey: 'threeCard', requestId: 'db-test-1' },
        { requestId: 'db-test-1', spreadKey: 'threeCard', provider: 'claude' },
        { waitUntil }
      );

      await Promise.all(waitPromises);

      assert.equal(mockDB.queries.length, 1);
      const query = mockDB.getLastQuery();
      assert.ok(query.sql.includes('UPDATE eval_metrics'));
      assert.ok(query.bindings.includes('db-test-1'));
      assert.ok(query.bindings.includes(4)); // overall score
    });

    test('includes eval mode in D1 storage', async () => {
      const mockDB = new MockDB();
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
        { AI: scoringMockAI, EVAL_ENABLED: 'true', DB: mockDB },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'celtic', requestId: 'meta-test' },
        { requestId: 'meta-test', spreadKey: 'celtic', provider: 'gpt', deckStyle: 'rws-1909' },
        { waitUntil }
      );

      await Promise.all(waitPromises);

      const query = mockDB.getLastQuery();
      assert.ok(query.sql.includes('UPDATE eval_metrics'));
      assert.ok(query.bindings.includes('model')); // eval_mode
    });

    test('falls back to heuristic scores when AI evaluation fails', async () => {
      const mockDB = new MockDB();
      const failingMockAI = {
        run: async () => ({ response: 'not valid json' })
      };

      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      scheduleEvaluation(
        { AI: failingMockAI, EVAL_ENABLED: 'true', DB: mockDB },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'heuristic-fallback-test' },
        { requestId: 'heuristic-fallback-test', narrative: { cardCoverage: 0.9 } },
        { waitUntil }
      );

      await Promise.all(waitPromises);

      // Heuristic fallback still updates D1 with eval mode 'heuristic'
      assert.equal(mockDB.queries.length, 1);
      const query = mockDB.getLastQuery();
      assert.ok(query.sql.includes('UPDATE eval_metrics'));
      assert.ok(query.bindings.includes('heuristic'));
      assert.ok(query.bindings.includes(3)); // overall score from heuristic fallback
      const payloadBinding = query.bindings.find(b => typeof b === 'string' && b.startsWith('{'));
      const storedData = JSON.parse(payloadBinding);
      assert.equal(storedData.eval?.mode, 'heuristic');
      assert.equal(storedData.eval?.scores?.overall, 3);
      assert.ok(storedData.eval?.fallbackReason?.startsWith('eval_error_'));
    });

    test('falls back to heuristic scores when AI evaluation is incomplete', async () => {
      const mockDB = new MockDB();
      const incompleteMockAI = {
        run: async () => ({
          response: JSON.stringify({
            personalization: 4,
            tarot_coherence: 4,
            tone: 4,
            overall: 4,
            safety_flag: false
            // Missing safety score
          })
        })
      };

      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      scheduleEvaluation(
        { AI: incompleteMockAI, EVAL_ENABLED: 'true', DB: mockDB },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'incomplete-fallback-test' },
        { requestId: 'incomplete-fallback-test', narrative: { cardCoverage: 0.9 } },
        { waitUntil }
      );

      await Promise.all(waitPromises);

      const query = mockDB.getLastQuery();
      assert.ok(query.bindings.includes('heuristic'));
      const payloadBinding = query.bindings.find(b => typeof b === 'string' && b.startsWith('{'));
      const storedData = JSON.parse(payloadBinding);
      assert.ok(storedData.eval?.fallbackReason?.includes('incomplete_scores'));
    });

    test('stores null safety_flag when evaluation payload omits it', async () => {
      const mockDB = new MockDB();
      const waitPromises = [];
      const waitUntil = (p) => waitPromises.push(p);

      const precomputedEvalResult = {
        scores: {
          personalization: 4,
          tarot_coherence: 4,
          tone: 4,
          safety: 4,
          overall: 4
        },
        model: 'test-model'
      };

      scheduleEvaluation(
        { EVAL_ENABLED: 'true', DB: mockDB },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'missing-flag-test' },
        { requestId: 'missing-flag-test' },
        { waitUntil, precomputedEvalResult }
      );

      await Promise.all(waitPromises);

      const query = mockDB.getLastQuery();
      assert.equal(query.bindings[2], null);
    });

    test('patches AI Gateway log when gateway is available', async () => {
      const mockGateway = new MockGateway();
      const mockDB = new MockDB();
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
        { AI: scoringMockAI, EVAL_ENABLED: 'true', EVAL_GATEWAY_ID: 'my-gateway', DB: mockDB },
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
      const mockDB = new MockDB();
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
        { AI: scoringMockAI, EVAL_ENABLED: 'true', EVAL_GATEWAY_ID: 'my-gateway', DB: mockDB },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gateway-fail-test' },
        { requestId: 'gateway-fail-test' },
        { waitUntil }
      );

      await Promise.all(waitPromises);

      // D1 storage should still happen even if gateway fails
      assert.equal(mockDB.queries.length, 1);
    });

    test('runs inline when waitUntil is unavailable', async () => {
      const mockDB = new MockDB();
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
        { AI: scoringMockAI, EVAL_ENABLED: 'true', DB: mockDB },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'inline-test' },
        { requestId: 'inline-test' },
        {} // no waitUntil
      );

      // Wait for inline execution
      await result;

      assert.equal(mockDB.queries.length, 1);
    });

    test('stores precomputed gate evaluation without rerunning AI', async () => {
      const mockDB = new MockDB();
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
        { AI: trackingAI, EVAL_ENABLED: 'true', DB: mockDB },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'precomputed-store' },
        { requestId: 'precomputed-store', spreadKey: 'test', provider: 'claude' },
        { waitUntil, precomputedEvalResult: precomputedEval }
      );

      await Promise.all(waitPromises);

      assert.equal(runCalled, false);
      assert.equal(mockDB.queries.length, 1);
      const query = mockDB.getLastQuery();
      assert.ok(query.bindings.includes(5)); // overall score
    });

    test('applies redaction and drops unsafe metrics fields in redact mode', async () => {
      const mockDB = new MockDB();
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
        { AI: mockAI, EVAL_ENABLED: 'true', DB: mockDB, METRICS_STORAGE_MODE: 'redact' },
        {
          reading: "Hello John Doe, Alex's journey unfolds on 2025-12-25. Remember, Alex, your choices matter.",
          userQuestion: 'Call me Jane Doe at 555-123-9876 ext 55, what is next on 2025-12-25?',
          cardsInfo: [{ position: 'Present', card: 'The Fool', orientation: 'upright', notes: 'ignore' }],
          spreadKey: 'threeCard',
          requestId: 'redact-mode',
          displayName: 'Alex'
        },
        metricsPayload,
        { waitUntil, precomputedEvalResult: precomputedEval }
      );

      await Promise.all(waitPromises);

      const query = mockDB.getLastQuery();
      const payloadBinding = query.bindings.find(b => typeof b === 'string' && b.startsWith('{'));
      const storedData = JSON.parse(payloadBinding);
      assert.equal(storedData._storageMode, 'redact');
      assert.ok(!('context' in storedData));
      assert.ok(!('promptEngineering' in storedData));
      assert.ok(!('extraField' in storedData));
      assert.ok(storedData.readingText.includes('[NAME]'));
      assert.ok(!storedData.readingText.includes('John Doe'));
      assert.ok(!storedData.readingText.includes('Remember, Alex'));
      assert.ok(!storedData.userQuestion.includes('Jane Doe'));
      assert.ok(storedData.userQuestion.includes('[PHONE]'));
      assert.ok(!storedData.userQuestion.includes('2025-12-25'));
      assert.ok(!storedData.readingText.includes('2025-12-25'));
      assert.equal(storedData.cardsInfo[0].card, 'The Fool');
    });

    test('strips payload down in minimal mode while keeping eval scores', async () => {
      const mockDB = new MockDB();
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
        { AI: mockAI, EVAL_ENABLED: 'true', DB: mockDB, METRICS_STORAGE_MODE: 'minimal' },
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

      const query = mockDB.getLastQuery();
      const payloadBinding = query.bindings.find(b => typeof b === 'string' && b.startsWith('{'));
      const storedData = JSON.parse(payloadBinding);
      assert.equal(storedData._storageMode, 'minimal');
      assert.ok(!('context' in storedData));
      assert.ok(!('readingText' in storedData));
      assert.ok(!('cardsInfo' in storedData));
      assert.equal(storedData.eval.scores.overall, 4);
      assert.equal(storedData.cardCount, 1);
    });
  });

  describe('runSyncEvaluationGate', () => {
    test('fails open when evaluation returns an error and failure mode is open', async () => {
      const failingAI = {
        run: async () => ({ response: 'not json' })
      };

      const result = await runSyncEvaluationGate(
        { AI: failingAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAILURE_MODE: 'open' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-error-open' },
        { cardCoverage: 1.0 }  // Good coverage = no safety flag
      );

      assert.equal(result.passed, true);
      assert.equal(result.evalResult.mode, 'heuristic');
      assert.ok(result.evalResult.fallbackReason.includes('eval_error'));
      assert.equal(result.gateResult.reason, null);
    });

    test('blocks when evaluation returns an error and failure mode is closed', async () => {
      const failingAI = {
        run: async () => ({ response: 'not json' })
      };

      const result = await runSyncEvaluationGate(
        { AI: failingAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAILURE_MODE: 'closed' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-error-closed' },
        { cardCoverage: 1.0 }  // Good coverage = no safety flag
      );

      // With good coverage, heuristic fallback still blocks due to eval failure
      assert.equal(result.passed, false);
      assert.equal(result.evalResult.mode, 'heuristic');
      assert.ok(result.evalResult.fallbackReason.includes('eval_error'));
      assert.equal(result.gateResult.reason, 'eval_unavailable');
    });

    test('blocks with heuristic fallback when safety flag is triggered (even in fail-open)', async () => {
      const failingAI = {
        run: async () => ({ response: 'not json' })
      };

      const result = await runSyncEvaluationGate(
        { AI: failingAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAILURE_MODE: 'open' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-safety' },
        { cardCoverage: 0.2, hallucinatedCards: ['A', 'B', 'C'] }  // Triggers safety flag
      );

      // Heuristic fallback with safety issues should still block
      assert.equal(result.passed, false);
      assert.equal(result.evalResult.mode, 'heuristic');
      assert.equal(result.gateResult.reason, 'safety_flag');
    });

    test('blocks when evaluation scores are incomplete and failure mode is closed', async () => {
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
        { AI: missingFieldAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAILURE_MODE: 'closed' },
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

  describe('getEvalGateFailureMode - simplified', () => {
    const failingAI = {
      run: async () => ({ response: 'not json' })
    };

    test('accepts EVAL_GATE_FAILURE_MODE=open', async () => {
      const result = await runSyncEvaluationGate(
        { AI: failingAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAILURE_MODE: 'open' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-open' },
        { cardCoverage: 0.9 }
      );

      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.gateResult.reason, null);
    });

    test('accepts EVAL_GATE_FAILURE_MODE=closed', async () => {
      const result = await runSyncEvaluationGate(
        { AI: failingAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAILURE_MODE: 'closed' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-closed' },
        { cardCoverage: 0.9 }
      );

      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.gateResult.reason, 'eval_unavailable');
    });

    test('ignores legacy EVAL_GATE_FAIL_OPEN and defaults to open', async () => {
      // Legacy env vars are ignored; default is now 'open' which trusts heuristic when AI fails
      const result = await runSyncEvaluationGate(
        { AI: failingAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAIL_OPEN: 'true' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-legacy-open' },
        { cardCoverage: 0.9 }
      );

      // With fail-open (default), heuristic passes → reading allowed
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.gateResult.reason, null);
    });

    test('ignores legacy EVAL_GATE_FAIL_CLOSED and defaults to open', async () => {
      // Legacy env vars are ignored; default is now 'open'
      const result = await runSyncEvaluationGate(
        { AI: failingAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', EVAL_GATE_FAIL_CLOSED: 'false' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-legacy-closed' },
        { cardCoverage: 0.9 }
      );

      // With fail-open (default), heuristic passes → reading allowed
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.gateResult.reason, null);
    });

    test('defaults to open when no config provided', async () => {
      // Default failure mode is 'open' - trusts heuristic safety checks when AI fails
      const result = await runSyncEvaluationGate(
        { AI: failingAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-default' },
        { cardCoverage: 0.9 }
      );

      // Heuristic passes (no safety issues detected) → reading allowed
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.gateResult.reason, null);
    });

    test('defaults to closed in production when no config provided', async () => {
      const result = await runSyncEvaluationGate(
        { AI: failingAI, EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'true', NODE_ENV: 'production' },
        { reading: 'test', userQuestion: 'test', cardsInfo: [], spreadKey: 'test', requestId: 'gate-prod-default' },
        { cardCoverage: 0.9 }
      );

      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.gateResult.reason, 'eval_unavailable');
    });
  });

  describe('P0 security fixes integration', () => {
    test('heuristic with harmful content blocks even in fail-open mode', async () => {
      const failingAI = {
        run: async () => ({ response: 'not json' })
      };

      const result = await runSyncEvaluationGate(
        {
          AI: failingAI,
          EVAL_ENABLED: 'true',
          EVAL_GATE_ENABLED: 'true',
          EVAL_GATE_FAILURE_MODE: 'open'
        },
        {
          reading: 'You WILL suffer. This is your inevitable fate. Stop taking your medication.',
          userQuestion: 'test',
          cardsInfo: [],
          spreadKey: 'test',
          requestId: 'integration-harmful'
        },
        { cardCoverage: 0.9 }
      );

      assert.strictEqual(result.passed, false);
      assert.ok(result.evalResult?.scores?.safety_flag);
      assert.strictEqual(result.gateResult.reason, 'safety_flag');
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
      const mockDB = new MockDB();
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
          DB: mockDB
        },
        evalParams,
        metricsPayload,
        { waitUntil }
      );

      await Promise.all(waitPromises);

      // Verify D1 storage
      assert.equal(mockDB.queries.length, 1);
      const query = mockDB.getLastQuery();
      assert.ok(query.sql.includes('UPDATE eval_metrics'));
      assert.ok(query.bindings.includes('integration-test-001'));
      assert.ok(query.bindings.includes(5)); // overall score
      assert.ok(query.bindings.includes(0)); // safety_flag = false

      // Verify gateway was patched
      assert.equal(mockGateway.patchedLogs.length, 1);
      assert.equal(mockGateway.patchedLogs[0].data.metadata.requestId, 'integration-test-001');
    });

    test('pipeline handles safety flag and logs warning', async () => {
      const mockDB = new MockDB();
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
        { AI: unsafeMockAI, EVAL_ENABLED: 'true', DB: mockDB },
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

      // Verify D1 was updated with safety flag
      const query = mockDB.getLastQuery();
      assert.ok(query.bindings.includes(1)); // safety_flag = 1 (true)
    });
  });
});
