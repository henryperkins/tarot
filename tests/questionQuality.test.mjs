import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { scoreQuestion, getQualityLevel, getQuestionNudge, isAssessableQuestion } from '../src/lib/questionQuality.js';

describe('Question quality scoring', () => {
  it('rewards open, specific, time-bound, agency-forward questions', () => {
    const result = scoreQuestion('How can I navigate my career transition over the next six months?');
    assert.ok(result.openEnded);
    assert.ok(result.specific);
    assert.ok(result.actionable);
    assert.ok(result.timeframe);
    assert.ok(result.concreteSubject);
    assert.ok(result.score >= 85);
    assert.equal(getQualityLevel(result.score).label, 'Excellent');
  });

  it('penalizes deterministic yes/no phrasing', () => {
    const result = scoreQuestion('Will he come back to me?');
    assert.ok(result.deterministicLanguage);
    assert.ok(!result.openEnded);
    assert.ok(result.score < 40);
    assert.ok(result.feedback.some(tip => /avoid fate|avoid/.test(tip.toLowerCase())));
  });

  it('asks for more detail on short, vague prompts', () => {
    const result = scoreQuestion('What should I do?');
    assert.ok(result.score < 70);
    assert.ok(result.feedback.some(tip => /more detail/i.test(tip)));
  });

  it('rewards agency verbs and timeframe grounding', () => {
    const result = scoreQuestion('How do I build healthier boundaries at work this month?');
    assert.ok(result.actionable);
    assert.ok(result.timeframe);
    assert.ok(result.score >= 75);
  });
});

describe('Question quality edge cases', () => {
  it('treats an open question without its question mark as open', () => {
    const result = scoreQuestion('How can I approach my new role at work this month');
    assert.ok(result.openEnded);
    assert.ok(!result.feedback.some(tip => /yes\/no/.test(tip)));
  });

  it('recognizes a yes/no question without its question mark', () => {
    const result = scoreQuestion('Will I get the job');
    assert.ok(!result.openEnded);
    assert.match(result.feedback[0], /instead of yes\/no/);
  });

  it('asks a statement to become a question instead of calling it yes/no', () => {
    const result = scoreQuestion('Clarity about my career path');
    assert.ok(!result.openEnded);
    assert.match(result.feedback[0], /phrasing it as a question/);
  });

  it('does not read "no" or "always" inside an open question as closed or fated', () => {
    assert.ok(scoreQuestion('What does no mean to me right now?').openEnded);
    assert.ok(!scoreQuestion('How can I stop always feeling anxious at work?').deterministicLanguage);
    assert.ok(scoreQuestion('Will we always be together?').deterministicLanguage);
  });
});

describe('Question nudge', () => {
  it('nudges yes/no questions with or without the question mark', () => {
    assert.equal(getQuestionNudge('Will I get the job?'), 'closed');
    assert.equal(getQuestionNudge('Will I get the job'), 'closed');
    assert.equal(getQuestionNudge('Is it yes or no for this move'), 'closed');
  });

  it('waits for a few words before judging', () => {
    assert.equal(getQuestionNudge('Will I'), null);
    assert.equal(getQuestionNudge(''), null);
    assert.equal(getQuestionNudge('   '), null);
    assert.equal(getQuestionNudge(undefined), null);
  });

  it('leaves open questions and contractions alone', () => {
    assert.equal(getQuestionNudge('How can I approach my new role?'), null);
    assert.equal(getQuestionNudge("Can't stop thinking about the move"), null);
    assert.equal(getQuestionNudge('Island life this month, what shifts?'), null);
    assert.equal(getQuestionNudge('What does no mean to me?'), null);
  });

  it('names wording that asks for a guaranteed outcome', () => {
    assert.equal(getQuestionNudge('What is guaranteed to happen in my career?'), 'fixed-outcome');
    assert.equal(getQuestionNudge('What am I destined for this year?'), 'fixed-outcome');
  });
});

describe('Question scripts and punctuation', () => {
  it('accepts question marks from other scripts', () => {
    assert.ok(scoreQuestion('كيف يمكنني أن أجد التوازن بين عملي وعائلتي هذا الشهر؟').openEnded);
    assert.ok(scoreQuestion('今月、仕事と家族のバランスをどうすれば見つけられますか？').openEnded);
    assert.ok(scoreQuestion('Comment puis-je retrouver mon calme ce mois-ci ?').openEnded);
  });

  it('only grades text written mostly in Latin letters', () => {
    assert.equal(isAssessableQuestion('How can I rest this week?'), true);
    assert.equal(isAssessableQuestion('¿Cómo puedo encontrar calma este mes?'), true);
    assert.equal(isAssessableQuestion('كيف يمكنني أن أجد التوازن؟'), false);
    assert.equal(isAssessableQuestion('今月、どうすれば休めますか？'), false);
    assert.equal(isAssessableQuestion('🌙✨'), false);
    assert.equal(isAssessableQuestion(''), false);
  });
});
