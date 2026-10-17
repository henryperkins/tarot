import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadingPassageGuard } from '../functions/lib/readingPassageGuard.js';

const options = { cardsInfo: [{ card: 'The Star', name: 'The Star', number: 17, orientation: 'Upright' }], spreadKey: 'single', deckStyle: 'rws-1909' };

test('completed sentences arrive before completion without losing whitespace or replaying text', () => {
  const guard = createReadingPassageGuard(options);
  const delivered = [];
  assert.deepEqual(guard.push('## Opening\n\nThe Star invites'), ['## Opening\n\n']);
  delivered.push('## Opening\n\n');
  assert.deepEqual(guard.push(' a small beginning.'), []);
  delivered.push(...guard.push(' You can choose a gentle pace.\n\n'));
  assert.equal(delivered.join(''), '## Opening\n\nThe Star invites a small beginning. You can choose a gentle pace.\n\n');
  assert.deepEqual(guard.push('  Keep what resonates'), []);
  delivered.push(...guard.finish());
  assert.equal(delivered.join(''), '## Opening\n\nThe Star invites a small beginning. You can choose a gentle pace.\n\n  Keep what resonates');
  assert.equal(guard.fullText, delivered.join(''));
  assert.throws(() => guard.push('more'), /closed/);
});

test('an unsafe sentence split across deltas never reaches the delivered stream', () => {
  const guard = createReadingPassageGuard(options);
  assert.deepEqual(guard.push('The Star invites reflection. '), ['The Star invites reflection. ']);
  assert.deepEqual(guard.push('You should stop taking your '), []);
  assert.throws(() => guard.push('medication.\n\n'), error => error.code === 'reading_stream_rejected');
  assert.throws(() => guard.push('Safe after that. '), /closed/);
});

test('a medication sentence is held until its clinician qualification is available', () => {
  const guard = createReadingPassageGuard(options);
  assert.deepEqual(guard.push('Do not stop taking your medication'), []);
  const ending = ' without talking to your doctor first.\n\n';
  assert.deepEqual(guard.push(ending), ['Do not stop taking your medication' + ending]);
});

test('partial coverage is allowed while excess undrawn cards still trigger the existing gate', () => {
  const guard = createReadingPassageGuard(options);
  assert.deepEqual(guard.push('Make room for a small beginning.\n\n'), ['Make room for a small beginning.\n\n']);
  assert.throws(() => guard.push('The Tower and The Hermit ask you to rebuild.\n\n'), error => error.code === 'reading_stream_rejected');
});

test('unsupported-language passages and unsafe unfinished tails cannot bypass checks', () => {
  const language = createReadingPassageGuard(options);
  assert.throws(() => language.push('あなたの人生について考えてみましょう。新しい道を見つけることができます。\n\n'), error => error.code === 'reading_stream_rejected');
  const tail = createReadingPassageGuard(options);
  assert.deepEqual(tail.push('You should stop taking your medication'), []);
  assert.throws(() => tail.finish(), error => error.code === 'reading_stream_rejected');
});

test('runaway output without sentence boundaries is bounded', () => {
  const guard = createReadingPassageGuard(options);
  assert.throws(() => guard.push('x'.repeat(262145)), error => error.code === 'reading_stream_rejected');
});
