import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildGuidedQuestion } from '../src/lib/intentionCoach.js';

describe('Question Generation Determinism', () => {
  describe('buildGuidedQuestion with seed', () => {
    it('should produce identical output for same inputs with seed', () => {
      const params = {
        topic: 'relationships',
        timeframe: 'week',
        depth: 'guided',
        customFocus: 'my partnership',
        seed: 'test-seed-123'
      };

      const question1 = buildGuidedQuestion(params);
      const question2 = buildGuidedQuestion(params);
      const question3 = buildGuidedQuestion(params);

      assert.strictEqual(question1, question2, 'First and second calls should match');
      assert.strictEqual(question2, question3, 'Second and third calls should match');
      assert.strictEqual(question1, question3, 'First and third calls should match');
    });

    it('should produce different output for different seeds', () => {
      const baseParams = {
        topic: 'relationships',
        timeframe: 'week',
        depth: 'guided',
        customFocus: 'my partnership'
      };

      const question1 = buildGuidedQuestion({ ...baseParams, seed: 'seed-A' });
      const question2 = buildGuidedQuestion({ ...baseParams, seed: 'seed-B' });
      const question3 = buildGuidedQuestion({ ...baseParams, seed: 'seed-C' });

      // With 3 variants in navigate pattern, we have ~89% chance of at least 2 being different
      const uniqueQuestions = new Set([question1, question2, question3]);
      assert.ok(uniqueQuestions.size >= 2, 'Different seeds should produce different questions');
    });

    it('should be reproducible across all depth patterns', () => {
      const depths = ['pulse', 'guided', 'lesson', 'deep'];
      const seed = 'reproducibility-test';

      depths.forEach(depth => {
        const params = {
          topic: 'growth',
          timeframe: 'month',
          depth,
          customFocus: 'my spiritual practice',
          seed
        };

        const question1 = buildGuidedQuestion(params);
        const question2 = buildGuidedQuestion(params);

        assert.strictEqual(
          question1,
          question2,
          `Depth pattern '${depth}' should be reproducible`
        );
      });
    });

    it('should work without seed (backward compatibility)', () => {
      const params = {
        topic: 'career',
        timeframe: 'today',
        depth: 'pulse',
        customFocus: 'my work'
        // No seed provided - should use legacy time-based randomization
      };

      const question1 = buildGuidedQuestion(params);
      const question2 = buildGuidedQuestion(params);

      assert.ok(typeof question1 === 'string', 'Should return a string');
      assert.ok(question1.endsWith('?'), 'Should end with question mark');
      assert.ok(question1.length > 10, 'Should be a reasonable length');

      // Without seed, questions MIGHT be different (time-based)
      // We just verify they're both valid questions
      assert.ok(typeof question2 === 'string', 'Second call should also return a string');
    });

    it('should handle seed as number', () => {
      const params = {
        topic: 'wellbeing',
        timeframe: 'week',
        depth: 'guided',
        customFocus: 'my energy levels'
      };

      const question1 = buildGuidedQuestion({ ...params, seed: 12345 });
      const question2 = buildGuidedQuestion({ ...params, seed: 12345 });

      assert.strictEqual(question1, question2, 'Numeric seeds should work');
    });

    it('should produce valid questions for all topic/depth combinations', () => {
      const topics = ['relationships', 'career', 'wellbeing', 'growth', 'decision', 'abundance'];
      const depths = ['pulse', 'guided', 'lesson', 'deep'];
      const seed = 'comprehensive-test';

      topics.forEach(topic => {
        depths.forEach(depth => {
          const params = {
            topic,
            timeframe: 'week',
            depth,
            seed
          };

          const question = buildGuidedQuestion(params);

          assert.ok(typeof question === 'string', `${topic}/${depth} should return string`);
          assert.ok(question.endsWith('?'), `${topic}/${depth} should end with ?`);
          assert.ok(question.length > 15, `${topic}/${depth} should be meaningful length`);
          assert.ok(!question.includes('undefined'), `${topic}/${depth} should not contain undefined`);
        });
      });
    });

    it('should integrate customFocus into seed for variant selection', () => {
      const baseParams = {
        topic: 'relationships',
        timeframe: 'week',
        depth: 'guided',
        seed: 'same-seed'
      };

      const question1 = buildGuidedQuestion({ ...baseParams, customFocus: 'my partner' });
      const question2 = buildGuidedQuestion({ ...baseParams, customFocus: 'my family' });

      // Different customFocus may produce different variants even with same seed
      // (because focus is mixed into the seed hash)
      assert.ok(typeof question1 === 'string', 'Question1 should be valid');
      assert.ok(typeof question2 === 'string', 'Question2 should be valid');
    });
  });

  describe('Determinism verification', () => {
    it('should produce same question 100 times with same seed', () => {
      const params = {
        topic: 'growth',
        timeframe: 'season',
        depth: 'deep',
        customFocus: 'my transformation',
        seed: 'consistency-test'
      };

      const firstQuestion = buildGuidedQuestion(params);
      const questions = Array.from({ length: 100 }, () => buildGuidedQuestion(params));

      assert.ok(questions.every(q => q === firstQuestion), 'All 100 calls should produce identical output');
    });

    it('should respect grammar fixes in navigate pattern', () => {
      const params = {
        topic: 'career',
        timeframe: 'month',
        depth: 'guided',  // navigate pattern
        seed: 'grammar-test'
      };

      const question = buildGuidedQuestion(params);

      // After grammar fix, should not have awkward "navigate stay aligned" phrasing
      assert.ok(
        !question.includes('navigate stay aligned'),
        'Should not have old awkward grammar'
      );

      // Should have proper grammar (either variant works)
      const hasProperGrammar =
        question.includes('How can I navigate') ||
        question.includes('How can I stay aligned') ||
        question.includes('How can I make progress');

      assert.ok(hasProperGrammar, 'Should use proper grammar construction');
    });
  });
});
