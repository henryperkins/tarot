import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { onRequestGet } from '../api/journal/search.js';

function createMockRequest(url, headers = {}) {
    const fullUrl = url.startsWith('http') ? url : `https://example.com${url}`;
    const headerMap = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));

    return {
        url: fullUrl,
        headers: {
            get: (key) => headerMap.get(String(key).toLowerCase()) || null
        }
    };
}

class MockStatement {
    constructor(query, db) {
        this.query = query;
        this.db = db;
        this.params = [];
    }

    bind(...params) {
        this.params = params;
        return this;
    }

    async first() {
        return this.db.resolveFirst(this.query, this.params);
    }

    async all() {
        return this.db.resolveAll(this.query, this.params);
    }

    async run() {
        return this.db.resolveRun(this.query, this.params);
    }
}

class MockDb {
    constructor(options = {}) {
        const {
            sessionRow,
            searchRows,
            searchByIdRows,
            followupRows,
            semanticRows
        } = options;
        this.sessionRow = sessionRow || null;
        this.searchRows = searchRows || [];
        this.searchByIdRows = searchByIdRows || [];
        this.followupRows = followupRows || [];
        this.semanticRows = semanticRows || [];
    }

    prepare(query) {
        return new MockStatement(query, this);
    }

    resolveFirst(query) {
        if (query.includes('FROM sessions')) {
            return this.sessionRow;
        }
        return null;
    }

    resolveAll(query) {
        if (query.includes('FROM journal_followups')) {
            return { results: this.followupRows };
        }
        if (query.includes('FROM journal_entries') && query.includes('step_embeddings')) {
            return { results: this.semanticRows };
        }
        if (query.includes('FROM journal_entries') && query.includes('id IN')) {
            return { results: this.searchByIdRows };
        }
        if (query.includes('FROM journal_entries')) {
            return { results: this.searchRows };
        }
        return { results: [] };
    }

    resolveRun() {
        return { meta: { rows_written: 1 }, changes: 1 };
    }
}

function createSessionRow(overrides = {}) {
    return {
        session_id: 'session-1',
        user_id: 'user-1',
        expires_at: Math.floor(Date.now() / 1000) + 60,
        id: 'user-1',
        email: 'user@example.com',
        username: 'mystic',
        is_active: 1,
        subscription_tier: 'plus',
        subscription_status: 'active',
        subscription_provider: 'stripe',
        stripe_customer_id: 'cus_123',
        ...overrides
    };
}

describe('journal search endpoint', () => {
    it('returns 401 when unauthenticated', async () => {
        const request = createMockRequest('/api/journal/search?q=stars');
        const response = await onRequestGet({ request, env: {} });
        const data = await response.json();

        assert.equal(response.status, 401);
        assert.match(data.error, /not authenticated/i);
    });

    it('returns 403 when user lacks entitlement', async () => {
        const db = new MockDb({
            sessionRow: createSessionRow({ subscription_tier: 'free', subscription_status: 'inactive' })
        });
        const request = createMockRequest('/api/journal/search?q=stars', {
            cookie: 'session=abc'
        });

        const response = await onRequestGet({ request, env: { DB: db } });
        const data = await response.json();

        assert.equal(response.status, 403);
        assert.equal(data.requiredTier, 'plus');
    });

    it('returns 400 when query is too short', async () => {
        const db = new MockDb({
            sessionRow: createSessionRow()
        });
        const request = createMockRequest('/api/journal/search?q=ab', {
            cookie: 'session=abc'
        });

        const response = await onRequestGet({ request, env: { DB: db } });
        const data = await response.json();

        assert.equal(response.status, 400);
        assert.match(data.error, /too short/i);
    });

    it('returns exact search results with follow-ups', async () => {
        const createdAt = 1710000000;
        const db = new MockDb({
            sessionRow: createSessionRow(),
            searchRows: [
                {
                    id: 'entry-1',
                    created_at: createdAt,
                    spread_key: 'threeCard',
                    spread_name: 'Three-Card',
                    question: 'What is next?',
                    cards_json: JSON.stringify([{ name: 'The Fool', orientation: 'Upright' }]),
                    narrative: 'A new beginning.',
                    themes_json: JSON.stringify({}),
                    reflections_json: JSON.stringify({ note: 'test' }),
                    context: 'general',
                    provider: 'azure',
                    session_seed: 'seed',
                    user_preferences_json: JSON.stringify({ tone: 'gentle' }),
                    deck_id: 'rws-1909',
                    request_id: 'req-1',
                    extracted_steps: JSON.stringify({ step: 'reflect' }),
                    extraction_version: 'v1',
                    location_latitude: 51.5,
                    location_longitude: -0.12,
                    location_timezone: 'Europe/London',
                    location_consent: 1
                }
            ],
            followupRows: [
                {
                    entry_id: 'entry-1',
                    turn_number: 1,
                    question: 'Follow up?',
                    answer: 'Yes.',
                    journal_context_json: JSON.stringify({ tag: 'test' }),
                    created_at: createdAt + 120
                }
            ]
        });

        const request = createMockRequest('/api/journal/search?q=begin', {
            cookie: 'session=abc'
        });

        const response = await onRequestGet({ request, env: { DB: db } });
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.equal(data.mode, 'exact');
        assert.equal(data.entries.length, 1);
        assert.equal(data.entries[0].id, 'entry-1');
        assert.equal(data.entries[0].ts, createdAt * 1000);
        assert.ok(data.entries[0].location);
        assert.equal(data.entries[0].location.timezone, 'Europe/London');
        assert.equal(data.entries[0].followUps.length, 1);
        assert.equal(data.entries[0].followUps[0].question, 'Follow up?');
    });

    it('returns semantic mode when no exact matches', async () => {
        const db = new MockDb({
            sessionRow: createSessionRow(),
            searchRows: []
        });

        const request = createMockRequest('/api/journal/search?q=meaningful', {
            cookie: 'session=abc'
        });

        const response = await onRequestGet({ request, env: { DB: db, AI: null } });
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.equal(data.mode, 'semantic');
        assert.equal(data.entries.length, 0);
    });
});
