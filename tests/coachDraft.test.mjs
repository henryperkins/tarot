import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  COACH_DRAFT_TTL_MS,
  clearCoachDraft,
  isUnchangedCoachSession,
  loadCoachDraft,
  saveCoachDraft
} from '../src/lib/coachDraft.js';

const draft = {
  step: 2,
  topic: 'career',
  timeframe: 'month',
  depth: 'deep',
  customFocus: 'a studio launch',
  useCreative: false,
  remixCount: 3,
  questionText: '',
  autoQuestionEnabled: true,
  prefillSource: null
};

describe('coach drafts', () => {
  beforeEach(() => {
    clearCoachDraft(null);
    clearCoachDraft('user-1');
  });

  it('returns the unfinished session without its timestamp', () => {
    saveCoachDraft(null, draft, 1_000);
    assert.deepStrictEqual(loadCoachDraft(null, 2_000), draft);
  });

  it('expires a draft older than the time-to-live', () => {
    saveCoachDraft(null, draft, 1_000);
    assert.deepStrictEqual(loadCoachDraft(null, 1_000 + COACH_DRAFT_TTL_MS), draft);
    assert.strictEqual(loadCoachDraft(null, 1_001 + COACH_DRAFT_TTL_MS), null);
    // An expired draft is gone, not merely hidden.
    assert.strictEqual(loadCoachDraft(null, 1_000), null);
  });

  it('keeps anonymous and signed-in drafts apart', () => {
    saveCoachDraft(null, { ...draft, topic: 'growth' }, 1_000);
    saveCoachDraft('user-1', draft, 1_000);
    assert.strictEqual(loadCoachDraft(null, 1_000).topic, 'growth');
    assert.strictEqual(loadCoachDraft('user-1', 1_000).topic, 'career');
  });

  it('forgets a draft once the question is applied', () => {
    saveCoachDraft('user-1', draft, 1_000);
    clearCoachDraft('user-1');
    assert.strictEqual(loadCoachDraft('user-1', 1_000), null);
  });

  it('stores a copy, so later edits to the source object do not leak in', () => {
    const source = { ...draft };
    saveCoachDraft(null, source, 1_000);
    source.topic = 'decision';
    assert.strictEqual(loadCoachDraft(null, 1_000).topic, 'career');
  });

  it('ignores empty drafts', () => {
    saveCoachDraft(null, null, 1_000);
    assert.strictEqual(loadCoachDraft(null, 1_000), null);
  });
});

describe('isUnchangedCoachSession', () => {
  const recommendation = { question: 'What is The Hermit asking of me?', source: 'card:The Hermit' };
  const opening = {
    ...draft,
    step: 0,
    questionText: recommendation.question,
    autoQuestionEnabled: false,
    prefillSource: recommendation
  };

  it('treats an untouched session as unchanged, so no draft pins it', () => {
    assert.strictEqual(isUnchangedCoachSession({ ...opening }, opening), true);
  });

  it('ignores generated question text in automatic mode', () => {
    const automatic = { ...draft, questionText: '' };
    assert.strictEqual(
      isUnchangedCoachSession({ ...automatic, questionText: 'A freshly generated question?' }, automatic),
      true
    );
  });

  it('counts any choice, step, or written question as a change', () => {
    assert.strictEqual(isUnchangedCoachSession({ ...opening, step: 1 }, opening), false);
    assert.strictEqual(isUnchangedCoachSession({ ...opening, topic: 'growth' }, opening), false);
    assert.strictEqual(isUnchangedCoachSession({ ...opening, questionText: 'My own words?' }, opening), false);
    assert.strictEqual(isUnchangedCoachSession({ ...opening, prefillSource: null }, opening), false);
  });

  it('never calls a missing session unchanged', () => {
    assert.strictEqual(isUnchangedCoachSession(null, opening), false);
    assert.strictEqual(isUnchangedCoachSession(opening, null), false);
  });
});
