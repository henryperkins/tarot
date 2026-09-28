import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMemoryList, requestMemoryJson } from '../src/lib/memoryApi.js';

test('memory list validation rejects malformed rows instead of turning failure into an empty list', () => {
  for (const value of [null, {}, { memories: {} }, { memories: [null] }, { memories: [{ id: 'one', text: {} }] }]) {
    assert.throws(() => parseMemoryList(value), /load your memories.*try again/);
  }
  assert.deepEqual(parseMemoryList({ memories: [] }), []);
  const memories = [{ id: 'one', text: '🌿 安心 أمان', category: 'general' }];
  assert.deepEqual(parseMemoryList({ memories }), memories);
});

for (const [status, expected] of [[401, /session has expired.*Sign in/], [403, /do not have access/], [429, /Wait a moment/]]) {
  test(`memory requests explain recovery for status ${status}`, async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('upstream detail', { status }));
    await assert.rejects(requestMemoryJson('/api/memories'), expected);
  });
}

test('gateway HTML and internal service errors produce a usable retry message', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Database detail</html>', { status: 502 }));
  await assert.rejects(requestMemoryJson('/api/memories', { method: 'POST' }, 'save your memory'), /could not save your memory.*try again/);
});

test('server validation feedback is retained', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Memory text is required (min 3 characters)' }, { status: 400 }));
  await assert.rejects(requestMemoryJson('/api/memories', { method: 'POST' }, 'save your memory'), /min 3 characters/);
});

test('a success status without mutation confirmation does not claim a save succeeded', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ unrelated: true }));
  await assert.rejects(requestMemoryJson('/api/memories', { method: 'POST' }, 'save your memory'), /could not save/);
});

test('an explicitly confirmed save preserves deduplication metadata', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, deduplicated: true, id: null }));
  assert.deepEqual(await requestMemoryJson('/api/memories', { method: 'POST' }, 'save your memory'), { success: true, deduplicated: true, id: null });
});

test('read timeouts release the request and offer retry', async t => {
  t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  await assert.rejects(requestMemoryJson('/api/memories', {}, 'load memories', 5), /took too long.*try again/);
});

test('a timed-out write asks the user to refresh before retrying an unconfirmed change', async t => {
  t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  await assert.rejects(requestMemoryJson('/api/memories', { method: 'POST' }, 'save your memory', 5), /could not confirm.*Refresh memories before/);
});

test('unmount cancellation remains cancellation, not a user-facing network failure', async t => {
  t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const controller = new AbortController();
  const request = requestMemoryJson('/api/memories', { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});
