import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { onRequestGet, onRequestPost } from '../functions/api/media.js';

class FakeMediaDb {
  constructor({
    user = null,
    mediaRows = []
  } = {}) {
    this.user = user;
    this.mediaRows = mediaRows;
  }

  prepare(sql) {
    if (sql.includes('FROM sessions s')) {
      return {
        bind: () => ({
          first: async () => this.user ? {
            session_id: 'session-1',
            user_id: this.user.id,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            email: this.user.email || 'user@example.com',
            username: this.user.username || 'user',
            is_active: 1,
            subscription_tier: this.user.subscription_tier || 'free',
            subscription_status: this.user.subscription_status || 'inactive',
            subscription_provider: this.user.subscription_provider || null,
            stripe_customer_id: this.user.stripe_customer_id || null,
            email_verified: 1
          } : null
        })
      };
    }

    if (sql.includes('UPDATE sessions SET last_used_at')) {
      return {
        bind: () => ({
          run: async () => ({ meta: { changes: 1 } })
        })
      };
    }

    if (sql.includes('FROM user_media') && sql.includes('ORDER BY created_at DESC')) {
      return {
        bind: () => ({
          all: async () => ({ results: this.mediaRows })
        })
      };
    }

    if (sql.includes('SELECT COUNT(*) AS total FROM user_media')) {
      return {
        bind: () => ({
          first: async () => ({ total: this.mediaRows.length })
        })
      };
    }

    throw new Error(`Unexpected SQL in FakeMediaDb: ${sql}`);
  }
}

describe('/api/media', () => {
  it('returns 401 when unauthenticated', async () => {
    const request = new Request('https://example.com/api/media');
    const response = await onRequestGet({
      request,
      env: { DB: new FakeMediaDb() }
    });

    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.error, 'Authentication required');
  });

  it('returns 403 for free tier users', async () => {
    const request = new Request('https://example.com/api/media', {
      headers: { Authorization: 'Bearer session-token' }
    });
    const response = await onRequestGet({
      request,
      env: {
        DB: new FakeMediaDb({
          user: {
            id: 'user-free',
            subscription_tier: 'free',
            subscription_status: 'inactive'
          }
        })
      }
    });

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.tierLimited, true);
    assert.equal(payload.requiredTier, 'plus');
  });

  it('lists persisted media for Plus users', async () => {
    const now = Math.floor(Date.now() / 1000);
    const request = new Request('https://example.com/api/media?limit=12', {
      headers: { Authorization: 'Bearer session-token' }
    });
    const response = await onRequestGet({
      request,
      env: {
        DB: new FakeMediaDb({
          user: {
            id: 'user-plus',
            subscription_tier: 'plus',
            subscription_status: 'active'
          },
          mediaRows: [{
            id: 'media-1',
            user_id: 'user-plus',
            created_at: now,
            updated_at: now,
            media_type: 'image',
            source: 'story-art',
            title: 'Story Art',
            prompt_question: 'What should I focus on?',
            card_name: null,
            position_label: null,
            style_id: 'watercolor',
            format_id: 'single',
            mime_type: 'image/jpeg',
            storage_provider: 'r2',
            storage_key: 'story-art/cache-key.jpg',
            bytes: 1024,
            metadata_json: JSON.stringify({ foo: 'bar' })
          }]
        })
      }
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(Array.isArray(payload.media), true);
    assert.equal(payload.media.length, 1);
    assert.equal(payload.media[0].id, 'media-1');
    assert.equal(payload.media[0].contentUrl, '/api/media?contentId=media-1');
    assert.equal(payload.media[0].downloadUrl, '/api/media?contentId=media-1&download=1');
  });

  it('validates POST payload before write', async () => {
    const request = new Request('https://example.com/api/media', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        mediaType: 'video',
        source: 'invalid-source',
        storageKey: 'card-video/key.mp4',
        mimeType: 'video/mp4'
      })
    });
    const response = await onRequestPost({
      request,
      env: {
        DB: new FakeMediaDb({
          user: {
            id: 'user-pro',
            subscription_tier: 'pro',
            subscription_status: 'active'
          }
        })
      }
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error, 'source must be story-art or card-reveal');
  });
});
