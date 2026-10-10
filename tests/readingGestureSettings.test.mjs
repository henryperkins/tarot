import test from 'node:test';
import assert from 'node:assert/strict';
import { readingGesturesEnabled, readingGestureEdition } from '../src/lib/readingGestureSettings.js';

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
