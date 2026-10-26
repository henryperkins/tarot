// The entry share button reuses the newest live single-reading link rather
// than minting another public link on every tap.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  findReusableShareLink,
  isShareLinkForEntry,
  isShareLinkLive
} from '../src/lib/journal/shareLinkSelection.js';

const NOW = Date.UTC(2026, 9, 26, 12);

test('the newest live link for the entry is reused', () => {
  const links = [
    { token: 'old', scope: 'entry', entryIds: ['a'], createdAt: NOW - 3000, expiresAt: null },
    { token: 'new', scope: 'entry', entryIds: ['a'], createdAt: NOW - 1000, expiresAt: NOW + 60_000 },
    { token: 'expired', scope: 'entry', entryIds: ['a'], createdAt: NOW - 10, expiresAt: NOW - 1 },
    { token: 'journal', scope: 'journal', entryIds: ['a'], createdAt: NOW },
    { token: 'other', scope: 'entry', entryIds: ['b'], createdAt: NOW },
    { scope: 'entry', entryIds: ['a'], createdAt: NOW }
  ];
  assert.equal(findReusableShareLink(links, 'a', NOW)?.token, 'new');
  assert.equal(findReusableShareLink(links, 'b', NOW)?.token, 'other');
  assert.equal(findReusableShareLink(links, 'c', NOW), null);
  assert.equal(findReusableShareLink(null, 'a', NOW), null);
});

test('legacy single-entry links and ISO expiry dates are understood', () => {
  assert.equal(isShareLinkForEntry({ entryId: 'a' }, 'a'), true);
  assert.equal(isShareLinkForEntry({ scope: 'journal', entryIds: ['a'] }, 'a'), false);
  assert.equal(isShareLinkForEntry({ scope: 'entry', entryIds: ['a'] }, ''), false);
  assert.equal(isShareLinkLive({ expiresAt: new Date(NOW - 1).toISOString() }, NOW), false);
  assert.equal(isShareLinkLive({ expiresAt: new Date(NOW + 1000).toISOString() }, NOW), true);
  assert.equal(isShareLinkLive({ expiresAt: 'not a date' }, NOW), true);
  assert.equal(isShareLinkLive({}, NOW), true);
});
