import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as sourceHelpers from '../src/lib/journalSummarySource.js';

const entry = (id, day = 1) => ({ id, ts: Date.UTC(2026, 9, day), question: 'A reflection', cards: [] });
const response = (summary = 'A summary') => Response.json({ summary, meta: { totalEntries: 1, provider: 'heuristic' } });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

// Execute the real hook with controlled state/effect scheduling and transport.
// Browser verification separately covers React mounting and responsive layouts.
async function driver(fetch) {
  const text = await readFile(new URL('../src/hooks/useJournalSummary.js', import.meta.url), 'utf8');
  const states = [], refs = [], effects = [], pendingEffects = [];
  const timers = new Map();
  let stateIndex, refIndex, effectIndex, dirty, now = 0, nextTimer = 0;
  let props = { userId: 'owner-a', enabled: true, entries: [entry('a')] };
  const bindings = {
    ...sourceHelpers, fetch, AbortController, Date: { now: () => now },
    setTimeout: (callback) => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id),
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (update) => {
        states[index] = typeof update === 'function' ? update(states[index]) : update;
        dirty = true;
      }];
    },
    useRef: (initial) => refs[refIndex++] ||= { current: initial },
    useCallback: (callback) => callback,
    useEffect: (effect, deps) => { pendingEffects[effectIndex++] = { effect, deps }; },
  };
  const program = text.replace(/^import .*;$/gm, '').replace('export function', 'function').replace('export default useJournalSummary;', '');
  const hook = new Function(...Object.keys(bindings), `${program}; return useJournalSummary;`)(...Object.values(bindings));
  const render = (patch = {}) => {
    props = { ...props, ...patch };
    let result;
    do {
      dirty = false; stateIndex = 0; refIndex = 0; effectIndex = 0;
      result = hook(props);
    } while (dirty);
    pendingEffects.forEach(({ effect, deps }, index) => {
      if (effects[index] && deps.every((dep, i) => Object.is(dep, effects[index].deps[i]))) return;
      effects[index]?.cleanup?.();
      effects[index] = { deps, cleanup: effect() };
    });
    return result;
  };
  return {
    render,
    advance: () => { now += 5001; for (const callback of timers.values()) callback(); timers.clear(); },
    close: () => effects.forEach(({ cleanup }) => cleanup?.()),
  };
}

test('requests pin the selected cloud IDs and retain result provenance through rerenders', async (t) => {
  let body;
  const d = await driver(async (_url, options) => { body = JSON.parse(options.body); return response(); });
  t.after(d.close);
  const entries = [entry('a'), entry('local-draft', 4), entry('b', 3), entry('c', 2)];
  const context = { scopeMode: 'filters', scopeNote: 'Original filters' };
  await d.render({ entries }).generate({ entryIds: ['a', 'c'], limit: 1, context });
  assert.deepEqual(body, { entryIds: ['c'], limit: 1 });
  assert.deepEqual(d.render().result.context, context);
  assert.equal(d.render({ entries: [entry('new', 5), ...entries] }).result.summary, 'A summary');
});

test('duplicate clicks, pending requests, and cooldowns cannot dispatch duplicate generation', async (t) => {
  const gate = deferred(); let calls = 0;
  const d = await driver(() => { calls++; return gate.promise; }); t.after(d.close);
  const original = d.render(); const pending = original.generate();
  await original.generate(); d.render(); d.advance();
  await d.render().generate();
  assert.equal(calls, 1, 'still pending after cooldown expires');
  gate.resolve(response()); await pending;
  d.render().clear();
  assert.equal(d.render().canGenerate, true);
});

test('account changes abort and reject late responses even if the transport ignores cancellation', async (t) => {
  const gates = [deferred(), deferred()]; const signals = []; let calls = 0;
  const d = await driver((_url, options) => { signals.push(options.signal); return gates[calls++].promise; }); t.after(d.close);
  const first = d.render().generate(); d.render();
  assert.equal(d.render({ userId: 'owner-b', entries: [entry('b')] }).result, null);
  assert.equal(signals[0].aborted, true);
  const second = d.render().generate(); d.render();
  gates[0].resolve(response('Old account')); await first;
  assert.equal(d.render().isLoading, true, 'old completion cannot settle the new request');
  gates[1].resolve(response('New account')); await second;
  assert.equal(d.render().result.summary, 'New account');
});

test('source edits invalidate in-flight work and cannot be undone by a late response', async (t) => {
  const gate = deferred(); let signal;
  const d = await driver((_url, options) => { signal = options.signal; return gate.promise; }); t.after(d.close);
  const pending = d.render().generate(); d.render();
  const state = d.render({ entries: [{ ...entry('a'), question: 'Changed' }] });
  assert.equal(signal.aborted, true);
  assert.equal(state.isLoading, false);
  assert.match(state.notice, /journal changed/i);
  gate.resolve(response()); await pending;
  assert.equal(d.render().result, null);
});

test('deletion and entitlement loss clear completed results', async (t) => {
  const d = await driver(async () => response()); t.after(d.close);
  await d.render().generate(); assert.ok(d.render().result);
  assert.equal(d.render({ entries: [] }).result, null);
  d.advance();
  await d.render({ entries: [entry('a')] }).generate(); assert.ok(d.render().result);
  assert.equal(d.render({ enabled: false }).result, null);
  assert.equal(d.render().canGenerate, false);
  assert.equal(d.render({ enabled: true }).result, null, 'reenabling does not resurrect a prior result');
});

test('clearing and unmounting cancel pending work without publishing a result', async (t) => {
  const gate = deferred(); let signal;
  const d = await driver((_url, options) => { signal = options.signal; return gate.promise; }); t.after(d.close);
  const pending = d.render().generate(); d.render().clear(); d.render();
  assert.equal(signal.aborted, true);
  d.close(); gate.resolve(response()); await pending;
  assert.equal(d.render().result, null);
});

test('errors recover after cooldown and empty filter scopes never fall back to recent entries', async (t) => {
  let calls = 0;
  const d = await driver(async () => { calls++; return calls === 1 ? Response.json({ error: 'Try again' }, { status: 503 }) : response(); }); t.after(d.close);
  await d.render().generate({ entryIds: [] });
  assert.equal(calls, 0);
  assert.match(d.render().error, /No cloud entries/);
  await d.render().generate();
  assert.equal(d.render().error, 'Try again');
  assert.equal(d.render().canGenerate, false);
  d.advance(); await d.render().generate();
  assert.equal(d.render().error, null);
  assert.ok(d.render().result);
});
