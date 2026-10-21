import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAppChrome } from '../src/lib/appChromeLayout.js';

const portrait = { visibleHeight: 844, headerHeight: 56, actionsHeight: 60, dockHeight: 56, safeBottom: 34 };
test('portrait counts actions, destination border and safe area once', () => {
  assert.deepEqual(resolveAppChrome(portrait), { actionsPinned: true, dockPinned: true, headerPinned: true, secondaryPinned: [], bottomHeight: 151 });
});
test('release order is actions, route secondaries, header, then destinations', () => {
  const dimensions = { visibleHeight: 600, headerHeight: 56, actionsHeight: 80, dockHeight: 56, secondaryHeights: [70, 60, 40] };
  assert.deepEqual(resolveAppChrome(dimensions), { actionsPinned: false, dockPinned: true, headerPinned: true, secondaryPinned: [false, true, true], bottomHeight: 57 });
  assert.deepEqual(resolveAppChrome({ ...dimensions, visibleHeight: 360 }), { actionsPinned: false, dockPinned: true, headerPinned: false, secondaryPinned: [false, false, false], bottomHeight: 57 });
  assert.deepEqual(resolveAppChrome({ ...dimensions, visibleHeight: 180 }), { actionsPinned: false, dockPinned: false, headerPinned: false, secondaryPinned: [false, false, false], bottomHeight: 0 });
});
test('returning from short landscape restores actions using natural dimensions', () => {
  assert.equal(resolveAppChrome({ ...portrait, visibleHeight: 360 }).actionsPinned, false);
  assert.equal(resolveAppChrome(portrait).actionsPinned, true);
});
test('quiet routes have zero destination reservation; guest share only reserves its action row', () => {
  assert.equal(resolveAppChrome({ visibleHeight: 844, headerHeight: 56, actionsHeight: 0, dockHeight: 0, safeBottom: 34 }).bottomHeight, 0);
  assert.equal(resolveAppChrome({ visibleHeight: 844, headerHeight: 56, actionsHeight: 64, dockHeight: 0, safeBottom: 34 }).bottomHeight, 99);
});
