import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onRequestGet } from '../functions/api/journal/[id].js';

class MockDB {
  constructor({
    sessionRow,
    entryRow,
    legacyEntryRow,
    followupsRows = [],
    throwOnBaseSelect = false
  } = {}) {
    this.sessionRow = sessionRow || {
      session_id: 'session-1',
      user_id: 'user-1',
      email: 'test@example.com',
      username: 'test-user',
      is_active: 1,
      subscription_tier: 'plus',
      subscription_status: 'active',
      subscription_provider: 'stripe',
      stripe_customer_id: 'cus_123'
    };
    this.entryRow = entryRow || null;
    this.legacyEntryRow = legacyEntryRow || null;
    this.followupsRows = followupsRows;
    this.throwOnBaseSelect = throwOnBaseSelect;
  }

  prepare(query) {
    if (query.includes('FROM sessions')) {
      return {
        bind: () => ({
          first: async () => this.sessionRow
        })
      };
    }

    if (query.startsWith('UPDATE sessions')) {
      return {
        bind: () => ({
          run: async () => ({ meta: { changes: 1 } })
        })
      };
    }

    if (query.includes('FROM journal_entries')) {
      const isBaseSelect = query.includes('location_latitude') || query.includes('extracted_steps');
      return {
        bind: () => ({
          first: async () => {
            if (isBaseSelect && this.throwOnBaseSelect) {
              throw new Error('no such column: location_latitude');
            }
            return isBaseSelect ? this.entryRow : this.legacyEntryRow;
          }
        })
      };
    }

    if (query.includes('FROM journal_followups')) {
      return {
        bind: () => ({
          all: async () => ({ results: this.followupsRows })
        })
      };
    }

    return {
      bind: () => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: 0 } })
      })
    };
  }
}

function createRequest(entryId, { includeFollowups = false } = {}) {
  const query = includeFollowups ? '?includeFollowups=true' : '';
  return new Request(`https://example.com/api/journal/${entryId}${query}`, {
    headers: {
      Cookie: 'session=token-1'
    }
  });
}

describe('journal entry API', () => {
  it('returns entry with follow-ups when requested', async () => {
    const entryRow = {
      id: 'entry-1',
      user_id: 'user-1',
      created_at: 1_700_000_000,
      spread_key: 'three-card',
      spread_name: 'Three Card',
      question: 'What now?',
      cards_json: JSON.stringify([{ name: 'The Fool', position: 'Past' }]),
      narrative: 'Test narrative',
      themes_json: JSON.stringify({ vibe: 'steady' }),
      reflections_json: JSON.stringify({ note: 'ok' }),
      context: 'career',
      provider: 'openai',
      session_seed: 'seed-1',
      user_preferences_json: JSON.stringify({}),
      deck_id: 'deck-1',
      request_id: 'req-1',
      extracted_steps: JSON.stringify([{ step: 'start' }]),
      step_embeddings: JSON.stringify([0.1, 0.2]),
      extraction_version: 'v1',
      location_latitude: 12.34,
      location_longitude: 56.78,
      location_timezone: 'UTC',
      location_consent: 1
    };

    const followupsRows = [
      {
        entry_id: 'entry-1',
        turn_number: 1,
        question: 'Follow-up question',
        answer: 'Follow-up answer',
        journal_context_json: JSON.stringify({ card: 'The Fool' }),
        created_at: 1_700_000_100
      }
    ];

    const db = new MockDB({ entryRow, followupsRows });
    const response = await onRequestGet({
      request: createRequest('entry-1', { includeFollowups: true }),
      env: { DB: db },
      params: { id: 'entry-1' }
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.entry.id, 'entry-1');
    assert.equal(payload.entry.ts, entryRow.created_at * 1000);
    assert.equal(payload.entry.followUps.length, 1);
    assert.equal(payload.entry.followUps[0].question, 'Follow-up question');
    assert.equal(payload.entry.location.latitude, 12.34);
  });

  it('falls back to legacy select when newer columns are missing', async () => {
    const legacyEntryRow = {
      id: 'entry-legacy',
      user_id: 'user-1',
      created_at: 1_700_000_200,
      spread_key: 'legacy',
      spread_name: 'Legacy Spread',
      question: 'Legacy question',
      cards_json: JSON.stringify([{ name: 'The Tower' }]),
      narrative: 'Legacy narrative',
      themes_json: null,
      reflections_json: null,
      context: 'self',
      provider: 'openai',
      session_seed: 'seed-legacy',
      user_preferences_json: null,
      deck_id: 'deck-legacy',
      request_id: 'req-legacy'
    };

    const db = new MockDB({
      legacyEntryRow,
      throwOnBaseSelect: true
    });

    const response = await onRequestGet({
      request: createRequest('entry-legacy'),
      env: { DB: db },
      params: { id: 'entry-legacy' }
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.entry.spread, 'Legacy Spread');
    assert.equal(payload.entry.extractedSteps, null);
    assert.equal(payload.entry.stepEmbeddings, null);
    assert.equal(payload.entry.location, null);
  });
});
