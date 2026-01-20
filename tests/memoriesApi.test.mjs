import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createMemoriesHandlers } from '../functions/api/memories.js';
import { MEMORY_CONSTANTS } from '../functions/lib/userMemory.js';

function createTestDeps(overrides = {}) {
  const calls = {
    getMemories: [],
    saveMemory: [],
    deleteMemory: [],
    clearAllMemories: []
  };

  const deps = {
    validateSession: async (_db, token) => (token ? { id: 'user-1' } : null),
    getSessionFromCookie: (cookieHeader) => {
      if (!cookieHeader) return null;
      const match = cookieHeader.match(/(?:^|;\\s*)session=([^;]+)/);
      return match ? match[1] : null;
    },
    getMemories: async (_db, userId, options) => {
      calls.getMemories.push({ userId, options });
      return [];
    },
    saveMemory: async (_db, userId, memory) => {
      calls.saveMemory.push({ userId, memory });
      return { saved: true, id: 'memory-1' };
    },
    deleteMemory: async (_db, userId, memoryId) => {
      calls.deleteMemory.push({ userId, memoryId });
      return { deleted: true };
    },
    clearAllMemories: async (_db, userId) => {
      calls.clearAllMemories.push({ userId });
      return { deleted: 3 };
    },
    MEMORY_CONSTANTS,
    ...overrides
  };

  return { deps, calls };
}

describe('/api/memories', () => {
  test('GET returns 401 when unauthenticated', async () => {
    const { deps } = createTestDeps({
      validateSession: async () => null
    });
    const { onRequestGet } = createMemoriesHandlers(deps);

    const request = new Request('https://example.com/api/memories');
    const response = await onRequestGet({ request, env: { DB: {} } });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Not authenticated' });
  });

  test('GET coerces invalid scope to global and caps limit to 100', async () => {
    const { deps, calls } = createTestDeps();
    const { onRequestGet } = createMemoriesHandlers(deps);

    const request = new Request('https://example.com/api/memories?scope=session&limit=999', {
      headers: { Cookie: 'session=token' }
    });
    const response = await onRequestGet({ request, env: { DB: {} } });

    assert.equal(response.status, 200);
    assert.equal(calls.getMemories.length, 1);
    assert.equal(calls.getMemories[0].options.scope, 'global');
    assert.equal(calls.getMemories[0].options.limit, 100);
  });

  test('GET includes category filter only for valid categories', async () => {
    const { deps, calls } = createTestDeps();
    const { onRequestGet } = createMemoriesHandlers(deps);

    const validRequest = new Request('https://example.com/api/memories?category=theme', {
      headers: { Cookie: 'session=token' }
    });
    await onRequestGet({ request: validRequest, env: { DB: {} } });

    assert.equal(calls.getMemories.length, 1);
    assert.deepEqual(calls.getMemories[0].options.categories, ['theme']);

    const invalidRequest = new Request('https://example.com/api/memories?category=not-a-category', {
      headers: { Cookie: 'session=token' }
    });
    await onRequestGet({ request: invalidRequest, env: { DB: {} } });

    assert.equal(calls.getMemories.length, 2);
    assert.equal(calls.getMemories[1].options.categories, undefined);
  });

  test('POST returns 400 for invalid category', async () => {
    const { deps } = createTestDeps();
    const { onRequestPost } = createMemoriesHandlers(deps);

    const request = new Request('https://example.com/api/memories', {
      method: 'POST',
      headers: {
        Cookie: 'session=token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: 'Remember this', category: 'not-a-category' })
    });
    const response = await onRequestPost({ request, env: { DB: {} } });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.ok(payload.error.includes('Invalid category'));
  });

  test('POST calls saveMemory with global scope and user source', async () => {
    const { deps, calls } = createTestDeps({
      saveMemory: async (_db, userId, memory) => {
        calls.saveMemory.push({ userId, memory });
        return { saved: true, id: 'memory-123', deduplicated: false };
      }
    });
    const { onRequestPost } = createMemoriesHandlers(deps);

    const request = new Request('https://example.com/api/memories', {
      method: 'POST',
      headers: {
        Cookie: 'session=token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: 'Prefers direct readings',
        keywords: ['tone'],
        category: 'communication'
      })
    });
    const response = await onRequestPost({ request, env: { DB: {} } });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { success: true, id: 'memory-123', deduplicated: false });
    assert.equal(calls.saveMemory.length, 1);
    assert.equal(calls.saveMemory[0].memory.scope, 'global');
    assert.equal(calls.saveMemory[0].memory.source, 'user');
    assert.equal(calls.saveMemory[0].memory.confidence, 1.0);
  });

  test('DELETE clears all memories when all=true', async () => {
    const { deps, calls } = createTestDeps();
    const { onRequestDelete } = createMemoriesHandlers(deps);

    const request = new Request('https://example.com/api/memories?all=true', {
      method: 'DELETE',
      headers: { Cookie: 'session=token' }
    });
    const response = await onRequestDelete({ request, env: { DB: {} } });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, deleted: 3 });
    assert.equal(calls.clearAllMemories.length, 1);
  });

  test('DELETE returns 400 when ID is missing', async () => {
    const { deps } = createTestDeps();
    const { onRequestDelete } = createMemoriesHandlers(deps);

    const request = new Request('https://example.com/api/memories', {
      method: 'DELETE',
      headers: { Cookie: 'session=token' }
    });
    const response = await onRequestDelete({ request, env: { DB: {} } });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Memory ID is required' });
  });

  test('DELETE returns 404 when the memory does not exist', async () => {
    const { deps } = createTestDeps({
      deleteMemory: async () => ({ deleted: false })
    });
    const { onRequestDelete } = createMemoriesHandlers(deps);

    const request = new Request('https://example.com/api/memories?id=missing', {
      method: 'DELETE',
      headers: { Cookie: 'session=token' }
    });
    const response = await onRequestDelete({ request, env: { DB: {} } });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Memory not found' });
  });
});

