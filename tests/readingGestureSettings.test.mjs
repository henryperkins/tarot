import test from 'node:test';
import assert from 'node:assert/strict';
import * as settings from '../src/lib/readingGestureSettings.js';
const { readingGesturesEnabled, readingGestureEdition, readingVisualRequestsEnabled } = settings;

test('the development gesture opt-in cannot enable a production build', () => {
  assert.equal(readingGesturesEnabled({ DEV: true, VITE_READING_GESTURES: 'true' }), true);
  assert.equal(readingGesturesEnabled({ DEV: false, VITE_READING_GESTURES: 'true' }), false);
  assert.equal(readingGesturesEnabled({ DEV: true }), false);
  assert.equal(readingGesturesEnabled({ DEV: true, VITE_READING_GESTURES: 'false' }), false);
  assert.equal(readingGesturesEnabled(), false);
});

test('only opted-in RWS readings adopt the matching gesture edition', () => {
  assert.equal(readingGestureEdition({ enabled: true, deckStyleId: 'rws-1909' }), 'rws-immanuelle-vector');
  assert.equal(readingGestureEdition({ enabled: false, deckStyleId: 'rws-1909' }), null);
  for (const deckStyleId of ['thoth-a1', 'marseille-classic', 'unknown']) {
    assert.equal(readingGestureEdition({ enabled: true, deckStyleId }), `identity:${deckStyleId}`);
  }
  assert.equal(readingGestureEdition({ enabled: true, deckStyleId: 'rws-1909', artworkEdition: 'unsupported-edition' }), 'unsupported-edition');
});

test('optimized validation enables the explicit flag while ordinary production and missing flags stay off', () => {
  assert.equal(readingGesturesEnabled({ DEV: false, MODE: 'reading-cue-validation', VITE_READING_GESTURES: 'true' }), true);
  assert.equal(readingGesturesEnabled({ DEV: false, MODE: 'production', VITE_READING_GESTURES: 'true' }), false);
  assert.equal(readingGesturesEnabled({ DEV: false, MODE: 'reading-cue-validation' }), false);
  assert.equal(readingGesturesEnabled({ DEV: false, MODE: 'reading-cue-validation', VITE_READING_GESTURES: 'false' }), false);
  assert.equal(readingGesturesEnabled({ DEV: false, MODE: 'unrelated-validation', VITE_READING_GESTURES: 'true' }), false);
});


test('production aligner opt-in does not grant annotation consent', () => {
  for (const tier of ['guest', 'free', 'plus', 'pro', 'enterprise']) {
    for (const env of [
      { DEV: false, MODE: 'production', VITE_READING_ALIGNER_ENABLED: 'true' },
      { DEV: true, VITE_READING_GESTURES: 'true' },
      { DEV: false, MODE: 'reading-cue-validation', VITE_READING_GESTURES: 'true' }
    ]) {
      assert.equal(readingGesturesEnabled({ ...env, tier }), true);
      for (const consent of [undefined, 'false', 'TRUE', ' true ', true, '1']) {
        assert.equal(readingVisualRequestsEnabled({ ...env, tier, VITE_READING_MODEL_ANNOTATIONS: consent }), false);
      }
      assert.equal(readingVisualRequestsEnabled({ ...env, tier, VITE_READING_MODEL_ANNOTATIONS: 'true' }), true);
    }
  }
  for (const flag of [undefined, 'false', 'TRUE', ' true ', true, '1']) {
    const env = { DEV: false, MODE: 'production', VITE_READING_ALIGNER_ENABLED: flag, VITE_READING_MODEL_ANNOTATIONS: 'true' };
    assert.equal(readingGesturesEnabled(env), false);
    assert.equal(readingVisualRequestsEnabled(env), false);
  }
  assert.equal(readingVisualRequestsEnabled(), false);
});
