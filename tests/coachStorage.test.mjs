import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { HISTORY_STORAGE_KEY, loadCoachHistory, recordCoachQuestion } from '../src/lib/coachStorage.js';

describe('coach question persistence', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let storage;
  let events;

  beforeEach(() => {
    const values = new Map();
    storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    };
    events = [];
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: storage, dispatchEvent: event => events.push(event.type) }
    });
  });

  afterEach(() => {
    for (const [key, descriptor] of [['window', originalWindow], ['localStorage', originalStorage]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  it('reports success after a question can be loaded from its owner history', () => {
    const question = 'What can I learn from this change?';
    const result = recordCoachQuestion(question, undefined, 'reader-1');

    assert.equal(result.success, true);
    assert.equal(loadCoachHistory(undefined, 'reader-1')[0].question, question);
    assert.deepEqual(loadCoachHistory(undefined, 'reader-2'), []);
    assert.deepEqual(events, ['coach-storage-sync']);
  });

  it('reports a full storage failure and preserves the existing history', () => {
    const existing = [{ id: 'earlier-question', question: 'What is changing?', createdAt: 1 }];
    storage.setItem(`${HISTORY_STORAGE_KEY}_anon`, JSON.stringify(existing));
    storage.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); };

    const result = recordCoachQuestion('How can I respond with care?');

    assert.equal(result.success, false);
    assert.match(result.error, /storage/i);
    assert.deepEqual(result.history, existing);
    assert.deepEqual(loadCoachHistory(), existing);
    assert.deepEqual(events, []);
  });

  it('does not report success when storage silently drops a write', () => {
    storage.setItem = () => {};

    const result = recordCoachQuestion('How can I make space for rest?');

    assert.equal(result.success, false);
    assert.deepEqual(loadCoachHistory(), []);
    assert.deepEqual(events, []);
  });
});
