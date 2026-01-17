import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchJournalEntryById } from '../src/lib/journal/fetchEntryById.js';

function createFetcher({ status = 200, payload = {} } = {}) {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload
    };
  };
  return { fetcher, calls };
}

describe('fetchJournalEntryById', () => {
  it('returns invalid when entryId is missing', async () => {
    const result = await fetchJournalEntryById('', {
      isAuthenticated: true,
      canUseCloudJournal: true,
      fetcher: async () => ({ ok: true, status: 200, json: async () => ({}) })
    });

    assert.equal(result.status, 'invalid');
  });

  it('returns skipped when not authenticated', async () => {
    const { fetcher, calls } = createFetcher();
    const result = await fetchJournalEntryById('entry-1', {
      isAuthenticated: false,
      canUseCloudJournal: true,
      fetcher
    });

    assert.equal(result.status, 'skipped');
    assert.equal(calls.length, 0);
  });

  it('requests follow-ups by default and returns found', async () => {
    const { fetcher, calls } = createFetcher({
      payload: { entry: { id: 'entry-1' } }
    });

    const result = await fetchJournalEntryById('entry-1', {
      isAuthenticated: true,
      canUseCloudJournal: true,
      fetcher
    });

    assert.equal(result.status, 'found');
    assert.equal(result.entry.id, 'entry-1');
    assert.ok(calls[0].includes('/api/journal/entry-1?includeFollowups=true'));
  });

  it('returns not-found when the API responds 404', async () => {
    const { fetcher } = createFetcher({ status: 404 });

    const result = await fetchJournalEntryById('missing', {
      isAuthenticated: true,
      canUseCloudJournal: true,
      fetcher
    });

    assert.equal(result.status, 'not-found');
  });

  it('returns error on fetch failure', async () => {
    const result = await fetchJournalEntryById('entry-1', {
      isAuthenticated: true,
      canUseCloudJournal: true,
      fetcher: async () => {
        throw new Error('boom');
      }
    });

    assert.equal(result.status, 'error');
    assert.equal(result.message, 'boom');
  });
});
