import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { scoreQuestion, getQualityLevel } from '../src/lib/questionQuality.js';

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
