import test from 'node:test';
import assert from 'node:assert/strict';
import { getSectionKeyFromHeading } from '../src/lib/narrativeSections.js';

test('maps headings to cinematic section keys', () => {
  assert.equal(getSectionKeyFromHeading('Opening'), 'opening');
  assert.equal(getSectionKeyFromHeading('The Cards'), 'cards');
  assert.equal(getSectionKeyFromHeading('Bringing It Together'), 'synthesis');
  assert.equal(getSectionKeyFromHeading('Guidance'), 'guidance');
  assert.equal(getSectionKeyFromHeading('Your Reflections'), 'guidance');
});
