import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickStats, computeGalleryLoading } from '../src/pages/cardGallerySelectors.js';

describe('cardGallerySelectors', () => {
  describe('pickStats', () => {
    it('returns empty map when analytics are disabled', () => {
      const result = pickStats({
        isAuthenticated: true,
        analyticsDisabled: true,
        remoteStats: { remote: true },
        localStats: { local: true }
      });
      assert.deepEqual(result, {});
    });

    it('prefers local stats when unauthenticated even if remote stats exist', () => {
      const local = { local: { total_count: 1 } };
      const remote = { remote: { total_count: 3 } };
      const result = pickStats({
        isAuthenticated: false,
        analyticsDisabled: false,
        remoteStats: remote,
        localStats: local
      });
      assert.equal(result, local);
    });

    it('prefers remote stats when authenticated and remote data exists', () => {
      const local = { local: { total_count: 1 } };
      const remote = { remote: { total_count: 3 } };
      const result = pickStats({
        isAuthenticated: true,
        analyticsDisabled: false,
        remoteStats: remote,
        localStats: local
      });
      assert.equal(result, remote);
    });

    it('falls back to local stats when authenticated but remote is empty', () => {
      const local = { local: { total_count: 1 } };
      const result = pickStats({
        isAuthenticated: true,
        analyticsDisabled: false,
        remoteStats: {},
        localStats: local
      });
      assert.equal(result, local);
    });
  });

  describe('computeGalleryLoading', () => {
    it('returns false when analytics are disabled', () => {
      const result = computeGalleryLoading({
        isAuthenticated: true,
        analyticsDisabled: true,
        remoteStats: { remote: true },
        remoteLoading: true,
        journalLoading: true
      });
      assert.equal(result, false);
    });

    it('uses journal loading when unauthenticated', () => {
      const result = computeGalleryLoading({
        isAuthenticated: false,
        analyticsDisabled: false,
        remoteStats: { remote: true },
        remoteLoading: true,
        journalLoading: true
      });
      assert.equal(result, true);
    });

    it('uses remote loading when authenticated and remote stats exist', () => {
      const result = computeGalleryLoading({
        isAuthenticated: true,
        analyticsDisabled: false,
        remoteStats: { remote: true },
        remoteLoading: true,
        journalLoading: false
      });
      assert.equal(result, true);
    });

    it('waits on either remote or journal when authenticated without remote stats', () => {
      const result = computeGalleryLoading({
        isAuthenticated: true,
        analyticsDisabled: false,
        remoteStats: null,
        remoteLoading: false,
        journalLoading: true
      });
      assert.equal(result, true);
    });
  });
});
