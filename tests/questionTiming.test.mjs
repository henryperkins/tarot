import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkQuestionTiming, extractQuestionTiming } from '../shared/coach/questionTiming.js';

describe('literal coach question timing', () => {
  it('keeps the captured this-week constraint distinct from the coming week', () => {
    const original = 'What can help me speak more openly with my sister this week?';
    const captured = 'What has shaped the silence between my sister and me, where do we stand right now, and how can I open up to her more honestly over the coming week?';
    assert.deepEqual(extractQuestionTiming(original), ['this week']);
    assert.equal(checkQuestionTiming(original, captured).valid, false);
    assert.ok(checkQuestionTiming(original, captured).issues.includes('timing_changed'));
  });

  it('accepts minimal edits that retain a literal timeframe, including punctuation', () => {
    assert.deepEqual(checkQuestionTiming(
      'What can help me speak more openly with my sister this week?',
      'How can I speak more openly with my sister this week?'
    ), { valid: true, issues: [] });
    assert.deepEqual(checkQuestionTiming('What can help my career on November 6?', 'How can I prepare for my career on November 6?'), { valid: true, issues: [] });
  });

  it('rejects replacing or adding an explicit duration or deadline', () => {
    for (const candidate of [
      'How can I speak with my sister next 30 days?',
      'How can I speak with my sister this month?',
      'How can I speak with my sister over the coming week?'
    ]) assert.equal(checkQuestionTiming('How can I speak with my sister this week?', candidate).valid, false, candidate);
    assert.deepEqual(checkQuestionTiming('How can I speak with my sister?', 'How can I speak with my sister this week?'), { valid: false, issues: ['timing_added'] });
    assert.equal(checkQuestionTiming('How can I speak with my sister this week?', 'How can I speak with my sister this week before Friday?').valid, false);
  });

  it('captures full date boundaries instead of nested date fragments', () => {
    for (const span of ['before November 2', 'by November 2, 2026', 'on 6 November 2026', 'before the 6th of November', 'in November']) {
      assert.deepEqual(extractQuestionTiming(`How can I prepare ${span}?`), [span], span);
    }
    assert.equal(checkQuestionTiming('How can I prepare before November 2?', 'How can I prepare after November 2?').valid, false);
    assert.equal(checkQuestionTiming('How can I prepare on November 2?', 'How can I prepare November 2?').valid, false);
  });

  it('retains negated and bounded timing relations', () => {
    for (const span of ['not before Friday', 'no earlier than Friday', 'no later than November 6', 'not until next week']) {
      assert.deepEqual(extractQuestionTiming(`I want to act ${span}. What can help?`), [span], span);
    }
    assert.equal(checkQuestionTiming('How can I prepare not before Friday?', 'How can I prepare before Friday?').valid, false);
    assert.equal(checkQuestionTiming('How can I prepare before Friday?', 'How can I prepare not before Friday?').valid, false);
  });

  it('protects ISO, numeric, and named dates literally', () => {
    for (const span of ['2026-11-06', 'on 11/06/2026', 'by 06-11-2026', 'November 6, 2026', 'in 2027', 'Q2 2027']) {
      assert.deepEqual(extractQuestionTiming(`What should I consider ${span}?`), [span], span);
    }
    assert.equal(checkQuestionTiming('How can I prepare by 11/06/2026?', 'How can I prepare by 06/11/2026?').valid, false);
  });

  it('keeps relative windows and weekdays rather than converting them', () => {
    for (const span of ['today', 'tomorrow', 'tonight', 'this weekend', 'next Friday', 'within 3 days', 'in two weeks', 'over the next 30 days']) {
      assert.deepEqual(extractQuestionTiming(`What can help me ${span}?`), [span], span);
    }
    assert.equal(checkQuestionTiming('What can help me tomorrow?', 'What can help me on Friday?').valid, false);
  });

  it('keeps date ranges together, including their boundary words', () => {
    for (const span of ['from Monday to Friday', 'between November 2 and November 6', 'November 2 through November 6']) {
      assert.deepEqual(extractQuestionTiming(`What can help me ${span}?`), [span], span);
    }
    assert.equal(checkQuestionTiming('What can help from Monday to Friday?', 'What can help from Monday until Thursday?').valid, false);
    assert.equal(checkQuestionTiming('What can help from Monday to Friday?', 'What can help Monday and Friday?').valid, false);
  });

  it('protects times and multiple constraints in source order', () => {
    for (const span of ['at 3pm', 'at 14:30', 'at 3:30 p.m. CDT', '2026-11-06T14:30:00Z']) {
      assert.deepEqual(extractQuestionTiming(`What can help me ${span}?`), [span], span);
    }
    const original = 'How can I prepare before November 6 at 3pm?';
    assert.deepEqual(extractQuestionTiming(original), ['before November 6', 'at 3pm']);
    assert.equal(checkQuestionTiming(original, 'How can I prepare before November 6 at 4pm?').valid, false);
  });

  it('protects confidently recognized Spanish phrases without treating Latin script as English', () => {
    for (const span of ['esta semana', 'hoy', 'mañana', 'la próxima semana', 'antes de viernes', 'no antes de viernes', 'dentro de tres días']) {
      assert.deepEqual(extractQuestionTiming(`¿Qué puede ayudarme ${span}?`), [span], span);
    }
    assert.equal(checkQuestionTiming('¿Cómo puedo hablar con mi hermana esta semana?', '¿Cómo puedo hablar con mi hermana la próxima semana?').valid, false);
    assert.deepEqual(checkQuestionTiming('¿Cómo puedo hablar con mi hermana esta semana?', '¿Qué puede ayudarme a hablar con mi hermana esta semana?'), { valid: true, issues: [] });
  });

  it('does not impose timing on general words or pretend to recognize uncertain languages', () => {
    for (const question of ['Will I ever stop doubting myself?', 'How can I make time for my sister?', 'How can I understand my current situation?', 'cette semaine', 'cette relation', 'Someday I may choose differently']) {
      assert.deepEqual(extractQuestionTiming(question), [], question);
    }
    assert.deepEqual(checkQuestionTiming('cette relation', 'cette relation'), { valid: true, issues: [] });
    assert.deepEqual(extractQuestionTiming(null), []);
    assert.deepEqual(extractQuestionTiming({ text: 'this week' }), []);
  });

  it('requires literal case and spacing for an identified timing span', () => {
    assert.equal(checkQuestionTiming('What can help me this week?', 'What can help me THIS WEEK?').valid, false);
    assert.equal(checkQuestionTiming('What can help me this  week?', 'What can help me this week?').valid, false);
  });

  it('does not accept a source phrase embedded in a different word', () => {
    assert.equal(checkQuestionTiming('What can help me this week?', 'What can help me this weeks?').valid, false);
    assert.equal(checkQuestionTiming('What can help Friday?', 'What can help Fridays?').valid, false);
  });

  it('protects a clock timezone even without colon notation', () => {
    assert.deepEqual(extractQuestionTiming('What can help me at 3pm CDT?'), ['at 3pm CDT']);
    assert.equal(checkQuestionTiming('What can help me at 3pm CDT?', 'What can help me at 3pm PDT?').valid, false);
  });

  it('recognizes a two-part numeric date only in an explicit timing context', () => {
    assert.deepEqual(extractQuestionTiming('What can help me by 11/6?'), ['by 11/6']);
    assert.deepEqual(extractQuestionTiming('How can I use 3/4 of my energy?'), []);
    assert.equal(checkQuestionTiming('What can help me by 11/6?', 'What can help me by 11/7?').valid, false);
  });

  it('retains duration bounds and explicit dayparts', () => {
    for (const span of ['at least two weeks', 'no more than 3 days', 'on Friday morning', 'tomorrow evening', 'in the morning', 'por la tarde']) {
      assert.deepEqual(extractQuestionTiming(`What can help me ${span}?`), [span], span);
    }
    assert.equal(checkQuestionTiming('What can help me after at least two weeks?', 'What can help me after at most two weeks?').valid, false);
    assert.equal(checkQuestionTiming('What can help me Friday morning?', 'What can help me Friday evening?').valid, false);
  });
});
