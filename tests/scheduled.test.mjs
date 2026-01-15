import assert from 'node:assert';
import test from 'node:test';

import { handleScheduled } from '../functions/lib/scheduled.js';

class FakeKV {
  constructor(entries) {
    this.map = new Map(entries);
  }

  async list({ prefix, limit = 100, cursor }) {
    const keys = Array.from(this.map.keys()).filter(key => key.startsWith(prefix));
    const start = cursor ? Number(cursor) : 0;
    const slice = keys.slice(start, start + limit);
    const nextCursor = start + limit < keys.length ? String(start + limit) : undefined;

    return {
      keys: slice.map(name => ({ name, metadata: { dummy: true } })),
      list_complete: nextCursor === undefined,
      cursor: nextCursor
    };
  }

  async get(name) {
    return this.map.get(name);
  }

  async delete(name) {
    this.map.delete(name);
  }
}

class _FakeBucket {
  constructor() {
    this.objects = [];
  }

  async put(key, value, options) {
    this.objects.push({ key, value, options });
  }
}

class FakeDB {
  constructor(deleted = 0) {
    this.deleted = deleted;
    this.prepareCount = 0;
  }

  prepare() {
    this.prepareCount++;
    const self = this;
    return {
      bind() {
        return {
          run() {
            return { meta: { changes: self.deleted } };
          }
        };
      }
    };
  }
}

const RealDate = global.Date;
const fixedNow = new Date('2025-02-01T03:04:05Z');

function mockDate() {
  global.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        return new RealDate(fixedNow);
      }
      return new RealDate(...args);
    }

    static now() {
      return fixedNow.getTime();
    }

    static parse(value) {
      return RealDate.parse(value);
    }

    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  };
}

test('handleScheduled archives KV data to D1', async (t) => {
  mockDate();
  t.after(() => {
    global.Date = RealDate;
  });

  const metricsKV = new FakeKV([
    ['reading:1', { requestId: 'r1' }],
    ['reading:2', { requestId: 'r2' }]
  ]);
  const feedbackKV = new FakeKV([
    ['feedback:1', { message: 'Great' }]
  ]);
  const db = new FakeDB(2);

  await handleScheduled(
    { cron: '0 3 * * *' },
    { METRICS_DB: metricsKV, FEEDBACK_KV: feedbackKV, DB: db },
    { waitUntil: (promise) => promise }
  );

  // KV keys should be deleted after archival to D1
  assert.strictEqual(metricsKV.map.size, 0, 'metrics KV keys should be deleted');
  assert.strictEqual(feedbackKV.map.size, 0, 'feedback KV keys should be deleted');

  // Verify D1 was called (FakeDB tracks prepare calls)
  assert.ok(db.prepareCount > 0, 'D1 prepare should have been called');
});
