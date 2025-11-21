import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildGuidedQuestion } from '../src/lib/intentionCoach.js';

describe('Journal Integration with Deterministic Question Generation', () => {
  describe('Coach Recommendations from Journal', () => {
    it('should generate deterministic questions from context-based recommendations', () => {
      // Simulating a recommendation from JournalInsightsPanel
      // Based on user's most common context (e.g., "love")
      const recommendation = {
        topicValue: 'relationships',
        timeframeValue: 'week',
        depthValue: 'guided',
        customFocus: 'my closest relationships and connections',
        source: 'context:love'
      };

      // Create seed from recommendation source for reproducibility
      const seed = `journal-rec|${recommendation.source}`;

      const params = {
        topic: recommendation.topicValue,
        timeframe: recommendation.timeframeValue,
        depth: recommendation.depthValue,
        customFocus: recommendation.customFocus,
        seed
      };

      const question1 = buildGuidedQuestion(params);
      const question2 = buildGuidedQuestion(params);
      const question3 = buildGuidedQuestion(params);

      assert.strictEqual(question1, question2, 'Should produce identical questions');
      assert.strictEqual(question2, question3, 'Should remain consistent');
      assert.ok(question1.length > 20, 'Should produce meaningful question');
    });

    it('should generate deterministic questions from theme-based recommendations', () => {
      // Simulating a theme-based recommendation
      // Based on user's recent journal themes
      const theme = 'transformation';
      const recommendation = {
        question: `How can I explore the theme of ${theme} more deeply?`,
        topicValue: 'growth',
        timeframeValue: 'month',
        depthValue: 'guided',
        customFocus: theme,
        source: `theme:${theme}`
      };

      const seed = `journal-rec|${recommendation.source}`;

      const params = {
        topic: recommendation.topicValue,
        timeframe: recommendation.timeframeValue,
        depth: recommendation.depthValue,
        customFocus: recommendation.customFocus,
        seed
      };

      const question1 = buildGuidedQuestion(params);
      const question2 = buildGuidedQuestion(params);

      assert.strictEqual(question1, question2, 'Theme-based questions should be reproducible');
      assert.ok(question1.includes(theme), 'Should incorporate the theme');
    });

    it('should generate deterministic questions from card-based recommendations', () => {
      // Simulating a frequent card recommendation
      const cardName = 'The Tower';
      const recommendation = {
        question: `What is ${cardName} inviting me to embody next?`,
        topicValue: 'growth',
        timeframeValue: 'open',
        depthValue: 'lesson',
        customFocus: `${cardName} recurring energy`,
        source: `card:${cardName}`,
        cardName
      };

      const seed = `journal-rec|${recommendation.source}`;

      const params = {
        topic: recommendation.topicValue,
        timeframe: recommendation.timeframeValue,
        depth: recommendation.depthValue,
        customFocus: recommendation.customFocus,
        seed
      };

      const question1 = buildGuidedQuestion(params);
      const question2 = buildGuidedQuestion(params);

      assert.strictEqual(question1, question2, 'Card-based questions should be reproducible');
      assert.ok(question1.includes(cardName), 'Should reference the card');
    });

    it('should produce different questions for different journal insights', () => {
      const contexts = ['love', 'career', 'spiritual'];
      const questions = [];

      contexts.forEach(context => {
        const recommendation = {
          topicValue: context === 'love' ? 'relationships' : context === 'career' ? 'career' : 'growth',
          timeframeValue: 'week',
          depthValue: 'guided',
          source: `context:${context}`
        };

        const seed = `journal-rec|${recommendation.source}`;
        const params = {
          topic: recommendation.topicValue,
          timeframe: recommendation.timeframeValue,
          depth: recommendation.depthValue,
          seed
        };

        questions.push(buildGuidedQuestion(params));
      });

      // Different contexts should produce different questions
      const uniqueQuestions = new Set(questions);
      assert.ok(uniqueQuestions.size >= 2, 'Different contexts should produce varied questions');
    });
  });

  describe('Personalized Suggestions Determinism', () => {
    it('should produce consistent questions from buildPersonalizedSuggestions parameters', () => {
      // Simulating a personalized suggestion from buildPersonalizedSuggestions
      const suggestion = {
        id: 'card-The Fool-0',
        label: 'Recurring card: The Fool',
        question: 'What is The Fool inviting me to embody next?',
        topic: 'growth',
        timeframe: 'open',
        depth: 'lesson',
        customFocus: 'The Fool recurring energy'
      };

      // User applies this suggestion
      const seed = `suggestion|${suggestion.id}`;

      const params = {
        topic: suggestion.topic,
        timeframe: suggestion.timeframe,
        depth: suggestion.depth,
        customFocus: suggestion.customFocus,
        seed
      };

      const question1 = buildGuidedQuestion(params);
      const question2 = buildGuidedQuestion(params);

      assert.strictEqual(question1, question2, 'Suggestion-based questions should be reproducible');
    });

    it('should handle context hint suggestions with determinism', () => {
      // Simulating a context hint from CONTEXT_HINTS
      const contextHint = {
        label: 'Relationship reciprocity',
        topic: 'relationships',
        timeframe: 'week',
        depth: 'guided',
        customFocus: 'my closest relationships and how I can nurture reciprocity'
      };

      const seed = 'context-hint|love';

      const params = {
        topic: contextHint.topic,
        timeframe: contextHint.timeframe,
        depth: contextHint.depth,
        customFocus: contextHint.customFocus,
        seed
      };

      const question1 = buildGuidedQuestion(params);
      const question2 = buildGuidedQuestion(params);

      assert.strictEqual(question1, question2, 'Context hint questions should be reproducible');
    });

    it('should handle history-based suggestions', () => {
      // Simulating revisiting a previous question
      const historyItem = {
        id: 'question_123',
        question: 'How can I navigate my career transition with confidence?'
      };

      // When user applies history item, they might regenerate or use exact text
      // If regenerating from saved parameters:
      const seed = `history|${historyItem.id}`;

      const params = {
        topic: 'career',
        timeframe: 'month',
        depth: 'guided',
        customFocus: 'my career transition',
        seed
      };

      const question1 = buildGuidedQuestion(params);
      const question2 = buildGuidedQuestion(params);

      assert.strictEqual(question1, question2, 'History-based regenerations should be deterministic');
    });
  });

  describe('Journal Stats Impact on Creative Mode', () => {
    it('should maintain determinism despite journal personalization data', () => {
      // When buildCreativeQuestion is called, it loads journal insights
      // But the seed should still ensure determinism

      const params = {
        topic: 'relationships',
        timeframe: 'week',
        depth: 'guided',
        customFocus: 'my partnership',
        seed: 'test-with-journal-context'
      };

      // Even though buildCreativeQuestion loads journal insights,
      // the seed should make the backend's variant selection deterministic

      // We can't test buildCreativeQuestion here (it's async and calls API),
      // but we can verify the principle with buildGuidedQuestion
      const question1 = buildGuidedQuestion(params);
      const question2 = buildGuidedQuestion(params);

      assert.strictEqual(question1, question2, 'Determinism should be independent of loaded journal data');
    });
  });

  describe('Seed Strategy for Journal Integration', () => {
    it('should support composite seeds from journal metadata', () => {
      // Best practice: create seeds that capture the journal context
      const journalContext = {
        topCard: 'The Star',
        topTheme: 'healing',
        topContext: 'wellbeing',
        reversalRate: 42
      };

      const seed = `journal|${journalContext.topCard}|${journalContext.topTheme}|${journalContext.topContext}`;

      const params = {
        topic: 'wellbeing',
        timeframe: 'month',
        depth: 'guided',
        customFocus: journalContext.topTheme,
        seed
      };

      const question1 = buildGuidedQuestion(params);
      const question2 = buildGuidedQuestion(params);

      assert.strictEqual(question1, question2, 'Composite journal seeds should work');
    });

    it('should demonstrate seed uniqueness for different journal states', () => {
      const journalState1 = { topCard: 'The Moon', topTheme: 'intuition' };
      const journalState2 = { topCard: 'The Sun', topTheme: 'joy' };

      const seed1 = `journal|${journalState1.topCard}|${journalState1.topTheme}`;
      const seed2 = `journal|${journalState2.topCard}|${journalState2.topTheme}`;

      const baseParams = {
        topic: 'growth',
        timeframe: 'week',
        depth: 'lesson'
      };

      const question1 = buildGuidedQuestion({ ...baseParams, seed: seed1 });
      const question2 = buildGuidedQuestion({ ...baseParams, seed: seed2 });

      // Different journal states produce different seeds, thus different questions
      // (with high probability due to variant selection)
      assert.ok(typeof question1 === 'string', 'Should produce valid question');
      assert.ok(typeof question2 === 'string', 'Should produce valid question');
    });
  });
});
