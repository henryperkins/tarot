import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { validatePassageAssociationsPayload } from '../shared/contracts/readingPassageAssociations.js';

const rawText = 'The Star pours water. Memory follows.';
const cards = [{ index: 0, canonicalName: 'The Star' }];
const cue = (overrides = {}) => ({
  id: 'star',
  kind: 'literal',
  targets: [{ spreadIndex: 0, canonicalName: 'The Star', detailIds: ['pool-pour'] }],
  passage: { start: 0, end: 8, quote: 'The Star' },
  ...overrides
});
const intro = (overrides = {}) => ({
  spreadIndex: 0, canonicalName: 'The Star', start: 0, namedEnd: 8,
  descriptionStart: 9, midpoint: 14, end: 21, ...overrides
});
const validate = (association, options = {}, payload = {}) => validatePassageAssociationsPayload({
  associations: [association], ...payload
}, { rawText, cards, ...options });

describe('passage contract rejects unsupported associations before exposure', () => {
  test('an explicitly absent recorded reflection preserves the passage and removes only its optional context', () => {
    const result = validate(cue({ personalContext: { type: 'recorded-fixture-context', quote: 'nostalgic' } }), {}, { recordedContext: null });
    assert.equal(result.associations.length, 1);
    assert.equal(result.associations[0].personalContext, undefined);
    assert.equal(result.valid, true);
  });
  test('strips a personal claim when its supplied context is absent', () => {
    for (const type of ['question', 'card-reflection', 'querent-reflection', 'recorded-fixture-context']) {
      const result = validate(cue({ personalContext: { type, spreadIndex: 0, quote: 'nostalgic' } }));
      assert.equal(result.associations.length, 1);
      assert.equal(result.associations[0].personalContext, undefined, type);
      assert.equal(result.valid, true, type);
      assert.deepEqual(result.errors, [], type);
    }
  });

  test('retains only exact personal quotations from the appropriate supplied source', () => {
    const cases = [
      [{ type: 'question', quote: 'leaving home' }, { userQuestion: 'How can I manage leaving home?' }],
      [{ type: 'card-reflection', spreadIndex: 0, quote: 'nostalgic' }, { cards: [{ ...cards[0], userReflection: 'I feel nostalgic.' }] }],
      [{ type: 'querent-reflection', quote: 'ready' }, { reflections: 'I feel ready.' }]
    ];
    for (const [personalContext, options] of cases) {
      assert.deepEqual(validate(cue({ personalContext }), options).associations[0].personalContext, personalContext);
      assert.equal(validate(cue({ personalContext: { ...personalContext, quote: 'invented claim' } }), options).associations[0].personalContext, undefined);
    }
    const unrelatedNotes = validate(cue({ personalContext: { type: 'querent-reflection', quote: 'nostalgic' } }), {
      reflections: [{ notes: 'nostalgic' }]
    });
    assert.equal(unrelatedNotes.associations[0].personalContext, undefined);
  });

  test('rejects every duplicate association ID even when a collision has not arrived', () => {
    for (const currentRaw of ['The Star', rawText]) {
      const result = validatePassageAssociationsPayload({
        associations: [cue(), cue({ passage: { start: 22, end: 28, quote: 'Memory' } })]
      }, { rawText: currentRaw, cards });
      assert.deepEqual(result.associations, []);
      assert.deepEqual(result.droppedAssociationIds, ['star']);
      assert.ok(result.errors.some((error) => /duplicate/i.test(error.message)));
    }
  });

  test('never exposes a future introduction whose target does not exist', () => {
    const result = validate(cue(), { rawText: 'The Star' }, {
      introductions: [intro({ spreadIndex: 1 }), intro({ canonicalName: 'The Moon' })]
    });
    assert.deepEqual(result.introductions, []);
    assert.equal(result.errors.filter((error) => error.field.startsWith('introductions.')).length, 2);
  });

  test('preserves explicit dynamic introduction arrival metadata', () => {
    const introduction = intro({ end: 14, dynamic: true, pending: true });
    const pending = validate(cue(), { rawText: 'The Star pours' }, { introductions: [introduction] });
    assert.deepEqual(pending.introductions, [introduction]);
    const ready = validate(cue(), {}, { introductions: [{ ...intro(), dynamic: true, pending: false }] });
    assert.deepEqual(ready.introductions, [{ ...intro(), dynamic: true, pending: false }]);
  });

  test('an explicitly empty spread rejects targets and introductions', () => {
    const result = validate(cue(), { cards: [] }, { introductions: [intro()] });
    assert.deepEqual(result.associations, []);
    assert.deepEqual(result.introductions, []);
    assert.deepEqual(result.droppedAssociationIds, ['star']);
  });

  test('filters unsupported geometry even when no spread was provided', () => {
    const result = validate(cue({ targets: [{ ...cue().targets[0], detailIds: ['pool-pour', 'invented'] }] }), {
      cards: undefined, getSupportedDetails: () => [{ id: 'pool-pour' }]
    });
    assert.deepEqual(result.associations[0].targets[0].detailIds, ['pool-pour']);
    assert.ok(result.errors.some((error) => error.field.endsWith('.detailIds')));
  });

  test('omits an unarrived meaning range until its exact quotation can be validated', () => {
    const association = cue({ meaningRange: { start: 22, end: 28, quote: 'Memory' } });
    const pending = validate(association, { rawText: 'The Star' });
    assert.equal(pending.associations[0].meaningRange, undefined);
    assert.deepEqual(validate(association).associations[0].meaningRange, association.meaningRange);
    const malformed = validate(cue({ meaningRange: { start: 22, end: 28, quote: 'Wrong!' } }));
    assert.deepEqual(malformed.associations, []);
    assert.ok(malformed.errors.some((error) => error.field.endsWith('.meaningRange')));
  });

  test('rejects impossible pending quote lengths rather than waiting forever', () => {
    const result = validate(cue({ passage: { start: 30, end: 40, quote: 'bad' } }), { rawText: 'The Star' });
    assert.deepEqual(result.droppedAssociationIds, ['star']);
    assert.ok(result.errors.some((error) => error.field.endsWith('.passage')));
  });

  test('accepts an exact expected source prefix but rejects extra or completed partial source', () => {
    const payload = { expectedRaw: rawText, introductions: [intro()] };
    assert.equal(validate(cue(), { rawText: 'The Star' }, payload).valid, true);
    assert.deepEqual(validate(cue(), { rawText: `${rawText} Extra.` }, payload).associations, []);
    assert.deepEqual(validate(cue(), { rawText: 'The Star', sourceComplete: true }, payload).associations, []);
    assert.equal(validate(cue(), { sourceComplete: true }, payload).valid, true);
  });

  test('rejects out of bounds completed data but keeps validated fixture introduction schedules', () => {
    const complete = validate(cue(), { rawText: 'The Star', sourceComplete: true }, { introductions: [intro()] });
    assert.deepEqual(complete.introductions, []);
    assert.ok(complete.errors.some((error) => error.field.startsWith('introductions.')));
    const scheduled = validate(cue(), { rawText: '' }, { expectedRaw: rawText, introductions: [intro()] });
    assert.deepEqual(scheduled.introductions, [intro()]);
    const invalidSchedule = validate(cue(), { rawText: 'The Star' }, {
      expectedRaw: rawText, introductions: [intro({ end: rawText.length + 1 })]
    });
    assert.deepEqual(invalidSchedule.introductions, []);
  });
});
