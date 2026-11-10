/**
 * A READING_JOBS Durable Object namespace for Node tests, backed by real
 * ReadingJob instances with in-memory storage. The reading itself is
 * injected (`runReading`), so tests control what the "model" returns.
 */
import { ReadingJob } from '../../src/worker/readingJob.js';

export function createReadingJobState() {
  const data = new Map();
  const pending = new Set();
  const alarm = { at: null };
  const hooks = { beforeCommit: null };
  let storageTail = Promise.resolve();
  const serialized = operation => {
    const result = storageTail.then(operation);
    storageTail = result.catch(() => {});
    return result;
  };
  const access = (map, alarmState) => ({
    async get(key) { return map.has(key) ? structuredClone(map.get(key)) : undefined; },
    async put(key, value) { map.set(key, structuredClone(value)); },
    async delete(key) { return map.delete(key); },
    async deleteAll() { map.clear(); },
    async setAlarm(time) { alarmState.at = time instanceof Date ? time.getTime() : time; },
    async getAlarm() { return alarmState.at; },
    async deleteAlarm() { alarmState.at = null; }
  });
  const direct = access(data, alarm);
  const storage = Object.fromEntries(Object.entries(direct).map(([name, fn]) => [name, (...args) => serialized(() => fn(...args))]));
  storage.transaction = callback => serialized(async () => {
    const snapshot = structuredClone(data);
    const alarmSnapshot = { ...alarm };
    const result = await callback(access(snapshot, alarmSnapshot));
    await hooks.beforeCommit?.(snapshot, alarmSnapshot);
    data.clear();
    for (const [key, value] of snapshot) data.set(key, structuredClone(value));
    alarm.at = alarmSnapshot.at;
    return result;
  });
  return {
    storage,
    stored: data,
    alarm,
    hooks,
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
    idFromString(id) {
      return id;
    },
    get(id) {
      return {
        fetch(input, init) {
          let entry = instances.get(id);
          if (!entry) {
            const state = createReadingJobState();
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
        while (state.pending.size) await Promise.all([...state.pending]);
      }
    },
    /** Replace volatile object state while preserving only durable storage. */
    async restart(jobId, nextRunner = runReading) {
      const entry = instances.get(jobId);
      if (entry.state.pending.size) throw new Error('Settle or abandon old work before restarting');
      entry.object.closeSubscribers();
      entry.object = new ReadingJob(entry.state, env, { runReading: nextRunner });
      await entry.object.initialized;
      return entry.object;
    },
    /** Fire a job's alarm as the runtime does: it is spent before the handler runs. */
    async fireAlarm(jobId) {
      const { state, object } = instances.get(jobId);
      state.alarm.at = null;
      await object.alarm();
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
  errorBody = {},
  calls = []
} = {}) {
  return async (context) => {
    calls.push(context);
    if (status !== 200) {
      return new Response(JSON.stringify({ error: reading, ...errorBody }), {
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
