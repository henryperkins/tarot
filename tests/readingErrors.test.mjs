import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as errors from '../src/lib/readingErrors.js';

test('safety outage becomes a retryable error with a clear user message', () => {
  const error = errors.createReadingError({ code: 'reading_safety_unavailable', retryable: true, message: 'We could not finish checking your reading. Please try again in a moment.' });
  const reading = errors.formatReadingFailure(error);
  assert.equal(reading.isError, true);
  assert.equal(reading.isStreaming, false);
  assert.equal(reading.errorCode, 'reading_safety_unavailable');
  assert.equal(reading.retryable, true);
  assert.match(reading.raw, /try again/i);
  assert.doesNotMatch(reading.raw, /A Moment of Reflection/);
});

test('generic errors retain their message without claiming a safety rejection', () => {
  const reading = errors.formatReadingFailure(new Error('The connection was interrupted.'));
  assert.equal(reading.isError, true);
  assert.equal(reading.errorCode, null);
  assert.equal(reading.raw, 'The connection was interrupted.');
});
