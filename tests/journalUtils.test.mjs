import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizeTimestamp,
  getTimestamp,
  getTimestampSeconds
} from '../shared/journal/utils.js';

describe('shared/journal/utils', () => {
  describe('normalizeTimestamp', () => {
    it('handles milliseconds, seconds, and ISO strings', () => {
      const ms = 1735689600000; // 2025-01-01T00:00:00Z
      const seconds = Math.floor(ms / 1000);
      const iso = '2025-01-01T00:00:00Z';

      assert.equal(normalizeTimestamp(ms), ms);
      assert.equal(normalizeTimestamp(seconds), ms);
      assert.equal(normalizeTimestamp(String(seconds)), ms);
      assert.equal(normalizeTimestamp(iso), ms);
    });

    it('returns null for invalid inputs', () => {
      assert.equal(normalizeTimestamp('not-a-date'), null);
      assert.equal(normalizeTimestamp(undefined), null);
      assert.equal(normalizeTimestamp(null), null);
    });
  });

  describe('getTimestamp', () => {
    const ms = 1735689600000;
    const seconds = Math.floor(ms / 1000);
    const iso = '2025-01-01T00:00:00Z';

    it('prefers ts when present', () => {
      assert.equal(getTimestamp({ ts: ms, created_at: seconds }), ms);
    });

    it('accepts legacy timestamp fields', () => {
      assert.equal(getTimestamp({ timestamp: seconds }), ms);
      assert.equal(getTimestamp({ createdAt: iso }), ms);
      assert.equal(getTimestamp({ updatedAt: seconds }), ms);
    });

    it('falls back to created_at/updated_at', () => {
      assert.equal(getTimestamp({ created_at: seconds }), ms);
      assert.equal(getTimestamp({ updated_at: seconds }), ms);
    });

    it('returns null when no timestamp fields found', () => {
      assert.equal(getTimestamp({}), null);
      assert.equal(getTimestamp(null), null);
    });
  });

  describe('getTimestampSeconds', () => {
    it('converts milliseconds to seconds', () => {
      const ms = 1735689600000;
      assert.equal(getTimestampSeconds({ ts: ms }), Math.floor(ms / 1000));
    });

    it('passes through normalized seconds', () => {
      const seconds = 1735689600;
      assert.equal(getTimestampSeconds({ created_at: seconds }), seconds);
    });
  });
});
