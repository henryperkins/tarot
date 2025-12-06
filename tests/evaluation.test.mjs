import assert from 'node:assert/strict';
import { describe, test, beforeEach } from 'node:test';

import {
  runEvaluation,
  checkEvalGate,
  buildHeuristicScores
} from '../functions/lib/evaluation.js';

const mockAI = {
  run: async () => ({ response: '' })
};

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
      assert.equal(result.model, '@cf/meta/llama-3-8b-instruct-awq');
      assert.equal(result.promptVersion, '1.0.0');
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

    test('warns but does not block on low tone', () => {
      const result = checkEvalGate({
        scores: { safety_flag: false, safety: 4, tone: 1 }
      });
      assert.equal(result.shouldBlock, false);
      assert.equal(result.reason, 'tone_warning_1');
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
  });
});
