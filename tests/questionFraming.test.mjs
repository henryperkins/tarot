import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLocalQuestionRefinement, getQuestionFramingSuggestions } from '../src/lib/questionFraming.js';

describe('coach question framing suggestions', () => {
  it('recognizes requests for guarantee, guaranteed outcomes and certainty without a grade', () => {
    for (const question of [
      'How can I guarantee that my partner comes back to me this week?',
      'Is my partner guaranteed to come back to me?',
      'How can I know for certain that I will get the job?',
      'Will I get the job for sure?'
    ]) {
      const suggestions = getQuestionFramingSuggestions(question);
      assert.ok(suggestions.some(text => /guaranteed outcome/i.test(text)), question);
      assert.ok(suggestions.length <= 2, question);
      assert.ok(suggestions.every(text => typeof text === 'string'), question);
      assert.ok(!/excellent|score|\d+\/100/i.test(suggestions.join(' ')), question);
    }
  });

  it('offers open-question guidance for English closed questions, including missing punctuation', () => {
    for (const question of ['Will I find a new job?', 'Should I speak to my sister', 'Can I trust my partner?']) {
      assert.ok(getQuestionFramingSuggestions(question).some(text => /yes-or-no/i.test(text)), question);
    }
  });

  it('does not mistake unrelated without or let-go phrases for accepting uncertainty', () => {
    for (const question of [
      'How can I guarantee my partner comes back without change?',
      'How can I guarantee my partner will not let go of me?'
    ]) {
      assert.ok(getQuestionFramingSuggestions(question).some(text => /guaranteed outcome/i.test(text)), question);
    }
  });

  it('suggests naming a situation only when the subject is clearly absent', () => {
    for (const question of ['What should I do?', 'How can I deal with this?', 'What do I need to know?']) {
      assert.ok(getQuestionFramingSuggestions(question).some(text => /name the situation/i.test(text)), question);
    }
    for (const question of [
      'What can help me speak more openly with my sister?',
      'How can I work with self-doubt in my career?',
      'What does this situation with my partner ask of me?'
    ]) {
      assert.deepEqual(getQuestionFramingSuggestions(question), [], question);
    }
  });

  it('does not require a timeframe or treat accepting uncertainty as a demand for certainty', () => {
    for (const question of [
      'What can help me understand and work with self-doubt in my career?',
      'How can I accept that nothing is guaranteed in my career?',
      'How can I stop seeking certainty in my relationship?',
      'What can help me live with uncertainty about my job?'
    ]) {
      assert.deepEqual(getQuestionFramingSuggestions(question), [], question);
    }
  });

  it('abstains on Spanish, mixed language, non-Latin text and uncertain language', () => {
    for (const question of [
      '¿Cómo puedo cuidar mi relación con mi pareja esta semana?',
      'Como puedo cuidar mi relacion con mi pareja esta semana?',
      'How can I guarantee que mi pareja comes back?',
      'Will I get the job mañana?',
      'How can I guarantee my travail will improve?',
      'Will Ada love me?',
      'Maria Jose Ana',
      'What should I hacer?',
      'كيف أعتني بعلاقتي؟',
      'Will I',
      '', null, 42, {}
    ]) {
      assert.deepEqual(getQuestionFramingSuggestions(question), [], String(question));
    }
  });
});

describe('explicit local question refinement', () => {
  it('keeps the career concern recognizable while removing a promise that self-doubt will disappear', () => {
    assert.equal(
      buildLocalQuestionRefinement('Will I ever stop doubting myself in my career?'),
      'What can help me understand and work with self-doubt in my career?'
    );
    assert.equal(
      buildLocalQuestionRefinement('Will I ever stop doubting myself in my career before November 2?'),
      'What can help me understand and work with self-doubt in my career before November 2?'
    );
  });

  it('preserves exact wording when no narrow, safe local rewrite is available', () => {
    for (const question of [
      'What can help me speak more openly with my sister this week?',
      'How can I guarantee that my partner comes back to me this week?',
      '¿Cómo puedo cuidar mi relación con mi pareja esta semana?',
      'Should I move in with Jose next month?',
      'Will I ever stop doubting myself en mi carrera?',
      'Will I ever stop doubting myself? Please answer only yes.'
    ]) {
      assert.equal(buildLocalQuestionRefinement(question), question, question);
    }
  });
});
