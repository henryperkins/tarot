/**
 * A READING_JOBS Durable Object namespace for Node tests, backed by real
 * ReadingJob instances with in-memory storage. The reading itself is
 * injected (`runReading`), so tests control what the "model" returns.
 */
import { ReadingJob } from '../../src/worker/readingJob.js';

function createState() {
  const data = new Map();
  const pending = new Set();
  return {
    storage: {
      async get(key) { return data.has(key) ? structuredClone(data.get(key)) : undefined; },
      async put(key, value) { data.set(key, structuredClone(value)); },
      async delete(key) { data.delete(key); }
    },
    blockConcurrencyWhile(fn) { return fn(); },
    waitUntil(promise) {
      const tracked = Promise.resolve(promise).finally(() => pending.delete(tracked));
      pending.add(tracked);
    },
    pending
  };
}

export function createFakeReadingJobs({ env = {}, runReading } = {}) {
  const instances = new Map();
  const namespace = {
    idFromName(name) {
      return name;
    },
    get(id) {
      return {
        fetch(input, init) {
          let entry = instances.get(id);
          if (!entry) {
            const state = createState();
            entry = { state, object: new ReadingJob(state, env, { runReading }) };
            instances.set(id, entry);
          }
          return entry.object.fetch(input instanceof Request ? input : new Request(input, init));
        }
      };
    }
  };
  return {
    namespace,
    instances,
    /** Wait for every running job's background work to finish. */
    async settle() {
      for (const { state } of instances.values()) {
        await Promise.all([...state.pending]);
      }
    }
  };
}

/** A reading runner that answers like /api/tarot-reading in JSON mode. */
export function readingRunner({
  reading = 'The cards speak of patience.',
  provider = 'test-provider',
  requestId = 'req-test-1',
  themes = { dominantSuit: 'Cups' },
  gateReason = null,
  status = 200,
  calls = []
} = {}) {
  return async (context) => {
    calls.push(context);
    if (status !== 200) {
      return new Response(JSON.stringify({ error: reading }), {
        status,
        headers: { 'content-type': 'application/json' }
      });
    }
    const body = { reading, provider, requestId, themes, ...(gateReason ? { gateBlocked: true, gateReason } : {}) };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

/** A reading runner that never finishes until the job is cancelled. */
export function hangingRunner(calls = []) {
  return (context) => {
    calls.push(context);
    return new Promise((_, reject) => {
      context.request.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  };
}
