const modelClientEnv = { DEV: false, MODE: 'production', VITE_READING_ALIGNER_ENABLED: 'true', VITE_READING_MODEL_ANNOTATIONS: 'true' };
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import { persistJournalWithVisualFallback, writeVisualResume, readVisualResume, visualStorageNamespace, requestSavedVisualRetry, fingerprintSavedVisualEntry } from '../src/lib/readingVisualStorage.js';
import { safeStorage, setCachedNarrative } from '../src/lib/safeStorage.js';
import { persistJournalInsights, persistCoachStatsSnapshot, saveCoachRecommendation } from '../src/lib/journalInsights.js';
import { installJournalLocks } from './helpers/journalHookDriver.mjs';

function storageFixture(t) {
  installJournalLocks(t);
  const values = new Map();
  const storage = { get length() { return values.size; }, key: index => [...values.keys()][index],
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  const window = new EventTarget(); window.localStorage = storage;
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  t.after(() => {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage); else delete globalThis.localStorage;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window;
  });
  return { storage, values, window };
}
const entry = (id, result = `result-${id}`) => ({ id, readingResultId: result, personalReading: `Private prose ${id}`, cards: [], sessionSeed: id, ts: 1791689000000 });
const binding = result => ({ readingResultId: result, sourceRevision: 0, spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' });
const seed = (storage, owner, entries) => { storage.setItem(owner ? `tarot_journal_${owner}` : 'tarot_journal', JSON.stringify(entries)); storage.setItem(`tarot_journal_cache_${owner || 'anon'}`, JSON.stringify(entries)); };
const read = (storage, key) => JSON.parse(storage.getItem(key) || '[]');
async function helpers() {
  try { return await import('../src/lib/deletedJournalEntryStorage.js'); }
  catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; }
}
const purge = (helpers, options) => (helpers.purgeDeletedJournalEntryStorage || (() => ({ purged: false })))(options);
async function journalDriver(owner, fetchImpl, { canUseCloudJournal = true } = {}) {
  const source = await readFile(new URL('../src/hooks/useJournal.js', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module' });
  const states = []; const refs = []; const queues = []; const effects = []; const layouts = []; const cleanups = [];
  let stateIndex = 0; let refIndex = 0;
  let activeOwner = owner;
  const dependencies = {
    useState: initial => { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], update => queues.push(() => { states[index] = typeof update === 'function' ? update(states[index]) : update; })]; },
    useRef: initial => { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useCallback: callback => callback, useEffect: effect => effects.push(effect), useLayoutEffect: effect => layouts.push(effect),
    useAuth: () => ({ isAuthenticated: Boolean(activeOwner), user: activeOwner ? { id: activeOwner } : null }),
    useSubscription: () => ({ canUseCloudJournal }), fetch: fetchImpl
  };
  const removed = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      removed.push([node.start, node.end]);
      if (node.source.value === 'react' || node.source.value.includes('/contexts/')) continue;
      let target = node.source.value;
      if (!target.endsWith('.js')) target += '.js';
      const imported = await import(new URL(target, new URL('../src/hooks/useJournal.js', import.meta.url)));
      for (const specifier of node.specifiers) dependencies[specifier.local.name] = imported[specifier.imported.name];
    } else if (node.type === 'ExportNamedDeclaration') removed.push([node.start, node.declaration.start]);
    else if (node.type === 'ExportDefaultDeclaration') removed.push([node.start, node.end]);
  }
  let program = source;
  for (const [start, end] of removed.sort((a, b) => b[0] - a[0])) program = program.slice(0, start) + program.slice(end);
  const hook = new Function(...Object.keys(dependencies), `${program}; return useJournal;`)(...Object.values(dependencies));
  const render = ({ runEffects = true } = {}) => { stateIndex = 0; refIndex = 0; const result = hook({ autoLoad: false });
    if (!runEffects) { layouts.length = 0; effects.length = 0; return result; }
    for (const effect of [...layouts.splice(0), ...effects.splice(0)]) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
    return result; };
  return { render, setOwner: next => { activeOwner = next; }, flush: () => { while (queues.length) queues.shift()(); },
    close: () => cleanups.reverse().forEach(cleanup => cleanup()) };
}

test('confirmed cloud entry deletion purges synchronously and rejects a previously started list response', async t => {
  const owner = 'entry-late-list'; const { storage } = storageFixture(t); const removed = entry('remove'); const keep = entry('keep');
  seed(storage, owner, [removed, keep]); seed(storage, null, [removed]); seed(storage, 'other-owner', [removed]);
  let release; let gets = 0;
  const driver = await journalDriver(owner, async (_url, options) => options?.method === 'DELETE' ? Response.json({ success: true, retiredReadingResultIds: [removed.readingResultId] })
    : ++gets === 1 ? Response.json({ entries: [removed, keep] }) : new Promise(resolve => { release = resolve; }));
  t.after(() => driver.close());
  await driver.render().loadEntries(); driver.flush(); const hook = driver.render(); const pending = hook.loadEntries();
  const result = await hook.deleteEntry(removed.id);
  assert.equal(result.success, true);
  assert.deepEqual(read(storage, `tarot_journal_cache_${owner}`).map(e => e.id), ['keep'], 'confirmed DELETE must erase before queued state executes');
  assert.deepEqual(read(storage, `tarot_journal_${owner}`).map(e => e.id), ['keep']);
  release(Response.json({ entries: [removed, keep] })); await pending; driver.flush();
  assert.deepEqual(driver.render().entries.map(e => e.id), ['keep']);
  assert.deepEqual(read(storage, `tarot_journal_cache_${owner}`).map(e => e.id), ['keep']);
  assert.deepEqual(read(storage, 'tarot_journal'), [removed]); assert.deepEqual(read(storage, 'tarot_journal_other-owner'), [removed]);
});

test('pagination queued before confirmed deletion cannot persist or reinsert the entry', async t => {
  const owner = 'entry-queued-page'; const { storage } = storageFixture(t); const removed = entry('remove-page'); const keep = entry('keep-page');
  seed(storage, owner, [removed, keep]); let gets = 0;
  const driver = await journalDriver(owner, async (_url, options) => options?.method === 'DELETE' ? Response.json({ success: true, retiredReadingResultIds: [removed.readingResultId] })
    : Response.json({ entries: ++gets === 1 ? [removed, keep] : [removed, entry('new-page')], pagination: { hasMore: true, nextCursor: 'next' } }));
  t.after(() => driver.close()); await driver.render().loadEntries(); driver.flush(); const hook = driver.render();
  await hook.loadMoreEntries(); await hook.deleteEntry(removed.id); driver.flush();
  assert.deepEqual(new Set(driver.render().entries.map(e => e.id)), new Set(['keep-page', 'new-page']));
  assert.equal(read(storage, `tarot_journal_cache_${owner}`).some(e => e.id === removed.id), false);
});

test('a queued save and a late original capability cannot revive a confirmed deleted entry', async t => {
  const owner = 'entry-queued-save'; const { storage } = storageFixture(t); const removed = entry('save-delete'); const keep = entry('save-keep');
  seed(storage, owner, [removed, keep]);
  const driver = await journalDriver(owner, async (_url, options) => options?.method === 'DELETE' ? Response.json({ success: true, retiredReadingResultIds: [removed.readingResultId] })
    : options?.method === 'POST' ? Response.json({ entry: removed }) : Response.json({ entries: [removed, keep] }));
  t.after(() => driver.close()); await driver.render().loadEntries(); driver.flush(); const hook = driver.render();
  await hook.saveEntry(removed); await hook.deleteEntry(removed.id); driver.flush();
  assert.equal(driver.render().entries.some(e => e.id === removed.id), false);
  const b = binding(removed.readingResultId);
  assert.equal(writeVisualResume({ namespace: visualStorageNamespace(owner), binding: b, resumeHandle: { visualBinding: b, visualJobToken: 'late-secret' }, storage }), false);
  assert.equal(storage.getItem(`tarot_visual_resume:user:${owner}:${removed.readingResultId}`), null);
});

test('failed cloud DELETE creates no tombstone and leaves prose and future saves intact', async t => {
  const owner = 'entry-delete-refused'; const { storage, values } = storageFixture(t); const removed = entry('refused'); seed(storage, owner, [removed]);
  const driver = await journalDriver(owner, async (_url, options) => options?.method === 'DELETE' ? Response.json({}, { status: 503 })
    : options?.method === 'POST' ? Response.json({ entry: removed }) : Response.json({ entries: [removed] }));
  t.after(() => driver.close()); await driver.render().loadEntries(); driver.flush(); const hook = driver.render(); const before = new Map(values);
  assert.equal((await hook.deleteEntry(removed.id)).success, false); driver.flush(); assert.deepEqual(values, before);
  assert.equal((await hook.saveEntry(removed)).success, true); driver.flush(); assert.equal(driver.render().entries[0].id, removed.id);
});

test('confirmed cloud DELETE reports success and fences the entry if browser locking fails', async t => {
  const owner = 'entry-cloud-lock-denied'; const { storage } = storageFixture(t); const removed = entry('lock-denied'); seed(storage, owner, [removed]);
  const driver = await journalDriver(owner, async (_url, options) => options?.method === 'DELETE'
    ? Response.json({ retiredReadingResultIds: [removed.readingResultId] }) : Response.json({ entries: [removed] }));
  t.after(() => driver.close()); await driver.render().loadEntries(); driver.flush(); const hook = driver.render();
  navigator.locks = null;
  const result = await hook.deleteEntry(removed.id); driver.flush();
  assert.equal(result.success, true); assert.equal(result.purged, false);
  assert.deepEqual(driver.render().entries, []);
  assert.equal(storage.getItem(`tarot_deleted_journal_entry:user:${owner}:${removed.id}`) !== null, true);
  assert.equal((await hook.saveEntry(removed)).success, false);
});

test('local deletion removes from actual storage before success and preserves entries absent from stale hook state', async t => {
  const owner = 'entry-local'; const { storage } = storageFixture(t); const removed = entry('local-remove'); const keep = entry('local-keep');
  seed(storage, owner, [removed]); const driver = await journalDriver(owner, () => assert.fail('local action must not fetch'), { canUseCloudJournal: false });
  t.after(() => driver.close()); await driver.render().loadEntries(); driver.flush(); const hook = driver.render();
  seed(storage, owner, [removed, keep]); assert.equal((await hook.deleteEntry(removed.id)).success, true);
  assert.deepEqual(read(storage, `tarot_journal_${owner}`), [keep]); assert.deepEqual(read(storage, `tarot_journal_cache_${owner}`), [keep]);
});

test('local DELETE cannot report success or create a marker when the required journal write fails', async t => {
  const owner = 'entry-local-denied'; const { storage, values } = storageFixture(t); const removed = entry('denied'); seed(storage, owner, [removed]);
  const driver = await journalDriver(owner, () => assert.fail('local action must not fetch'), { canUseCloudJournal: false });
  t.after(() => driver.close()); await driver.render().loadEntries(); driver.flush(); const hook = driver.render();
  const before = new Map(values); const set = storage.setItem; storage.setItem = (key, value) => { if (key === `tarot_journal_${owner}`) throw new Error('denied'); set(key, value); };
  const result = await hook.deleteEntry(removed.id); assert.equal(result.success, false); assert.deepEqual(values, before);
});

test('an exact entry fence preserves a shared result handle and every other owner', async t => {
  const owner = 'entry-shared-result'; const { storage } = storageFixture(t); const removed = entry('shared-remove', 'shared'); const keep = entry('shared-keep', 'shared');
  seed(storage, owner, [removed, keep]); seed(storage, null, [removed]); seed(storage, 'other-owner', [removed]);
  const b = binding('shared'); writeVisualResume({ namespace: visualStorageNamespace(owner), binding: b, resumeHandle: { visualBinding: b, visualJobToken: 'keep-secret' }, storage });
  storage.setItem(`tarot_visual_resume:user:${owner}:entry:${removed.id}`, 'deleted private replay');
  const h = await helpers(); assert.equal(purge(h, { namespace: visualStorageNamespace(owner), entryId: removed.id, entries: [removed, keep], storage }).purged, true);
  assert.deepEqual(read(storage, `tarot_journal_${owner}`), [keep]); assert.ok(readVisualResume({ namespace: visualStorageNamespace(owner), readingResultId: 'shared', binding: b, storage }));
  assert.equal(storage.getItem(`tarot_visual_resume:user:${owner}:entry:${removed.id}`), null);
  assert.deepEqual(read(storage, 'tarot_journal'), [removed]); assert.deepEqual(read(storage, 'tarot_journal_other-owner'), [removed]);
});

test('another tab marker fences late storage before notification and native storage event clears in-memory prose', async t => {
  const owner = 'entry-other-tab'; const { storage, window } = storageFixture(t); const removed = entry('other-tab-remove'); const keep = entry('other-tab-keep'); seed(storage, owner, [removed, keep]);
  let release; let gets = 0; const driver = await journalDriver(owner, async () => ++gets === 1 ? Response.json({ entries: [removed, keep] }) : new Promise(resolve => { release = resolve; }));
  t.after(() => driver.close()); await driver.render().loadEntries(); driver.flush(); const hook = driver.render(); const pending = hook.loadEntries();
  const marker = `tarot_deleted_journal_entry:${visualStorageNamespace(owner)}:${encodeURIComponent(removed.id)}`;
  storage.setItem(marker, JSON.stringify({ readingResultIds: [removed.readingResultId] })); seed(storage, owner, [keep]);
  release(Response.json({ entries: [removed, keep] })); await pending; driver.flush();
  assert.deepEqual(read(storage, `tarot_journal_cache_${owner}`), [keep]);
  const event = new Event('storage'); Object.assign(event, { key: marker, newValue: storage.getItem(marker) }); window.dispatchEvent(event); driver.flush();
  assert.deepEqual(driver.render().entries, [keep]);
});

test('entry deletion rejects stale derivations but allows fresh survivors and other-owner shared cache entries', async t => {
  const owner = 'entry-derived'; const { storage } = storageFixture(t); const removed = entry('derived-remove'); const keep = entry('derived-keep'); seed(storage, owner, [removed, keep]);
  setCachedNarrative(owner, 'season', 'Deleted theme prose'); setCachedNarrative('other-owner', 'season', 'Other owner prose');
  const staleCache = storage.getItem('journey_narrative_cache'); const h = await helpers(); purge(h, { namespace: visualStorageNamespace(owner), entryId: removed.id, entries: [removed, keep], storage });
  setCachedNarrative(owner, 'season', 'Late deleted prose', [removed.id, keep.id]);
  persistCoachStatsSnapshot({ totalReadings: 2 }, { coachSuggestion: { question: 'Deleted private question' }, sourceEntryIds: [removed.id, keep.id] }, owner);
  saveCoachRecommendation({ question: 'Late deleted recommendation' }, owner, [removed.id]);
  safeStorage.setItem('journey_narrative_cache', staleCache);
  const cache = read(storage, 'journey_narrative_cache'); assert.equal(cache[`${owner}:season`], undefined); assert.equal(cache['other-owner:season'].narrative, 'Other owner prose');
  assert.equal(storage.getItem(`tarot_coach_stats_snapshot_${owner}`), null); assert.equal(storage.getItem(`tarot_coach_recommendation_${owner}`), null);
  setCachedNarrative(owner, 'season', 'Survivor prose', [keep.id]); persistJournalInsights([removed, keep], owner);
  assert.equal(read(storage, 'journey_narrative_cache')[`${owner}:season`].narrative, 'Survivor prose');
  assert.equal(read(storage, `tarot_journal_insights_${owner}`).stats.totalReadings, 1);
});


test('guest deletion fences late bucket writes and shared-cache replay without erasing signed owners', async t => {
  const { storage } = storageFixture(t); const removed = entry('guest-remove'); const keep = entry('guest-keep');
  seed(storage, null, [removed, keep]); seed(storage, 'guest-other-owner', [removed]);
  storage.setItem('journey_narrative_cache', JSON.stringify({ 'anon:season': { narrative: 'Deleted guest prose' }, 'guest-other-owner:season': { narrative: 'Other owner prose' } }));
  const stale = storage.getItem('journey_narrative_cache'); const h = await helpers();
  assert.equal(purge(h, { namespace: 'anon', entryId: removed.id, entries: [removed, keep], storage }).purged, true);
  assert.deepEqual(persistJournalWithVisualFallback({ key: 'tarot_journal', entries: [removed, keep], storage }).entries, [keep]);
  safeStorage.setItem('journey_narrative_cache', stale);
  assert.deepEqual(read(storage, 'journey_narrative_cache'), { 'guest-other-owner:season': { narrative: 'Other owner prose' } });
  assert.deepEqual(read(storage, 'tarot_journal_guest-other-owner'), [removed]);
});

test('queued old-owner pagination cannot write after the current namespace switches', async t => {
  const owner = 'entry-old-namespace'; const other = 'entry-new-namespace'; const { storage } = storageFixture(t);
  const old = entry('namespace-old'); const late = entry('namespace-late'); const current = entry('namespace-current');
  seed(storage, owner, [old]); seed(storage, other, [current]); let gets = 0;
  const driver = await journalDriver(owner, async () => Response.json({ entries: ++gets === 1 ? [old] : [late], pagination: { hasMore: true, nextCursor: 'next' } }));
  t.after(() => driver.close()); await driver.render().loadEntries(); driver.flush(); await driver.render().loadMoreEntries();
  driver.setOwner(other); driver.render(); driver.flush();
  assert.deepEqual(read(storage, `tarot_journal_${other}`), [current]);
  assert.equal(read(storage, `tarot_journal_cache_${owner}`).some(e => e.id === late.id), false);
});

test('confirmed server deletion retains its fence and truthfully reports incomplete device cleanup', async t => {
  const owner = 'entry-cloud-cleanup-denied'; const { storage } = storageFixture(t); const removed = entry('cleanup-denied'); seed(storage, owner, [removed]);
  const driver = await journalDriver(owner, async (_url, options) => options?.method === 'DELETE' ? Response.json({ success: true, retiredReadingResultIds: [removed.readingResultId] }) : Response.json({ entries: [removed] }));
  t.after(() => driver.close()); await driver.render().loadEntries(); driver.flush(); const hook = driver.render();
  const set = storage.setItem; storage.setItem = (key, value) => { if (key === `tarot_journal_${owner}`) throw new Error('denied'); set(key, value); };
  const result = await hook.deleteEntry(removed.id); driver.flush();
  assert.equal(result.success, true); assert.equal(result.purged, false); assert.match(result.error, /browser could not finish/);
  assert.deepEqual(driver.render().entries, []); assert.equal((await hook.saveEntry(removed)).success, false);
  assert.equal(storage.getItem(`tarot_deleted_journal_entry:user:${owner}:${removed.id}`) != null, true);
});

test('cross-tab markers reject both entry replay and original result capabilities before native events', t => {
  const owner = 'entry-late-capability'; const { storage } = storageFixture(t); const removed = entry('capability-remove');
  const namespace = visualStorageNamespace(owner); const b = binding(removed.readingResultId);
  storage.setItem(`tarot_deleted_journal_entry:${namespace}:${removed.id}`, JSON.stringify({ readingResultIds: [removed.readingResultId] }));
  storage.setItem(`tarot_deleted_journal_result:${namespace}:${removed.readingResultId}`, '1');
  assert.equal(writeVisualResume({ namespace, binding: b, resumeHandle: { visualBinding: b, visualJobToken: 'late-original' }, storage }), false);
  assert.equal(writeVisualResume({ namespace, entryId: removed.id, binding: b, resumeHandle: { visualBinding: b,
    readingResultId: removed.readingResultId, visualJobToken: 'late-replay', visualJobId: 'job', attemptId: 'attempt' }, storage }), false);
  assert.equal(readVisualResume({ namespace, readingResultId: removed.readingResultId, binding: b, storage }), null);
});

test('malformed shared data is preserved and reported while known owner buckets are purged', async t => {
  const owner = 'entry-malformed-shared'; const { storage } = storageFixture(t); const removed = entry('malformed-remove'); seed(storage, owner, [removed]);
  storage.setItem('journey_narrative_cache', 'malformed shared bytes'); const h = await helpers();
  assert.equal(purge(h, { namespace: visualStorageNamespace(owner), entryId: removed.id, entries: [removed], storage }).purged, false);
  assert.equal(storage.getItem('journey_narrative_cache'), 'malformed shared bytes'); assert.deepEqual(read(storage, `tarot_journal_${owner}`), []);
});


test('migration preserves a live owner entry whose ID was separately deleted in the guest namespace', async t => {
  const owner = 'entry-migration-owner'; const { storage } = storageFixture(t); const guest = entry('migration-shared-id');
  const owned = { ...guest, sessionSeed: 'owner-distinct-seed', personalReading: 'Legitimate owner prose' };
  seed(storage, null, [guest]); seed(storage, owner, [owned]); const h = await helpers(); purge(h, { namespace: 'anon', entryId: guest.id, entries: [guest], storage });
  const posted = []; const driver = await journalDriver(owner, async (_url, options) => {
    if (options?.method === 'POST') { posted.push(JSON.parse(options.body)); return Response.json({ entry: owned }); }
    return Response.json({ entries: posted.length ? [owned] : [] });
  }); t.after(() => driver.close());
  const result = await driver.render().migrateToCloud(); driver.flush(); assert.equal(result.success, true); assert.equal(result.migrated, 1);
  assert.equal(posted.length, 1); assert.equal(posted[0].personalReading, 'Legitimate owner prose');
  assert.equal(driver.render().entries[0].personalReading, 'Legitimate owner prose');
});

test('migration started before a guest deletion never posts the deleted guest snapshot', async t => {
  const owner = 'entry-migration-late-guest'; const { storage } = storageFixture(t); const removed = entry('migration-guest-remove'); seed(storage, null, [removed]);
  let release; const posted = []; const driver = await journalDriver(owner, async (url, options) => {
    if (options?.method === 'POST') { posted.push(JSON.parse(options.body)); return Response.json({ entry: removed }); }
    if (url.includes('all=true')) return new Promise(resolve => { release = resolve; });
    return Response.json({ entries: [] });
  }); t.after(() => driver.close()); const pending = driver.render().migrateToCloud();
  const h = await helpers(); purge(h, { namespace: 'anon', entryId: removed.id, entries: [removed], storage });
  release(Response.json({ entries: [] })); await pending; driver.flush(); assert.deepEqual(posted, []); assert.deepEqual(read(storage, 'tarot_journal'), []);
});


test('late single-entry GET and deduplicated save responses cannot return or persist deleted prose', async t => {
  const owner = 'entry-single-dedupe'; const { storage } = storageFixture(t); const removed = entry('single-dedupe'); seed(storage, owner, [removed]);
  const previousFetch = globalThis.fetch; const releases = [];
  globalThis.fetch = () => new Promise(resolve => releases.push(resolve)); t.after(() => { globalThis.fetch = previousFetch; });
  const driver = await journalDriver(owner, async (_url, options) => options?.method === 'DELETE' ? Response.json({ success: true, retiredReadingResultIds: [removed.readingResultId] })
    : options?.method === 'POST' ? Response.json({ entry: removed, deduplicated: true }) : Response.json({ entries: [removed] }));
  t.after(() => driver.close()); await driver.render().loadEntries(); driver.flush(); const hook = driver.render();
  const single = hook.fetchEntryById(removed.id); const saved = hook.saveEntry(removed);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(releases.length, 2);
  await hook.deleteEntry(removed.id); releases.forEach(release => release(Response.json({ entry: removed })));
  assert.deepEqual(await single, { entry: null, status: 'skipped' }); assert.equal((await saved).success, false); driver.flush();
  assert.deepEqual(driver.render().entries, []); assert.deepEqual(read(storage, `tarot_journal_cache_${owner}`), []);
});

test('a low-level cloud retry cannot commit after another tab deletes the entry before its response', async t => {
  const owner = 'entry-retry-boundary'; const { storage } = storageFixture(t);
  const saved = { ...entry('retry-boundary-remove'), cards: [{ name: 'The Star', position: 'Present' }] };
  const fingerprint = await fingerprintSavedVisualEntry(saved); seed(storage, owner, [saved]);
  let release; let began; const started = new Promise(resolve => { began = resolve; }); let commits = 0;
  const pending = requestSavedVisualRetry({ env: modelClientEnv, namespace: visualStorageNamespace(owner), entry: saved, cloud: true, storage,
    fetchImpl: () => { began(); return new Promise(resolve => { release = resolve; }); },
    commit: ({ update }) => { commits++; return { committed: true, entry: update(saved) }; } });
  await started;
  storage.setItem(`tarot_deleted_journal_entry:user:${owner}:${saved.id}`, JSON.stringify({ readingResultIds: [saved.readingResultId] }));
  seed(storage, owner, []);
  release(Response.json({ state: { attachmentStatus: 'failed', retryStatus: 'exhausted', sourceFingerprint: fingerprint, stateVersion: 1, reason: 'annotation-failed' } }));
  await assert.rejects(pending, error => error.code === 'stale' || error.code === 'not-found');
  assert.equal(commits, 0); assert.deepEqual(read(storage, `tarot_journal_cache_${owner}`), []);
});


async function journeyHook(archetypeData) {
  const source = await readFile(new URL('../src/hooks/useJourneyData.js', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module' }); const removed = [];
  const dependencies = { useMemo: callback => callback(), useCallback: callback => callback,
    useLocalCalendarDate: () => new Date(), useArchetypeJourney: () => archetypeData };
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      removed.push([node.start, node.end]);
      if (node.source.value === 'react' || node.source.value.includes('useArchetypeJourney') || node.source.value.includes('useLocalCalendarDate')) continue;
      let target = node.source.value; if (!target.endsWith('.js')) target += '.js';
      const imported = await import(new URL(target, new URL('../src/hooks/useJourneyData.js', import.meta.url)));
      for (const specifier of node.specifiers) dependencies[specifier.local.name] = imported[specifier.imported.name];
    } else if (node.type === 'ExportNamedDeclaration') removed.push([node.start, node.declaration.start]);
    else if (node.type === 'ExportDefaultDeclaration') removed.push([node.start, node.end]);
  }
  let program = source;
  for (const [start, end] of removed.sort((a, b) => b[0] - a[0])) program = program.slice(0, start) + program.slice(end);
  // Development logging has no part in the journal/analytics boundary contract.
  program = program.replaceAll('import.meta.env.DEV', 'false');
  return new Function(...Object.keys(dependencies), `${program}; return useJourneyData;`)(...Object.values(dependencies));
}

test('retained server aggregates cannot restore deleted prose or persist a stale narrative', async t => {
  const owner = 'entry-retained-aggregate'; const { storage } = storageFixture(t);
  const removed = { ...entry('aggregate-moon'), ts: Date.now(), cards: [{ name: 'The Moon', position: 'Present' }] };
  const keep = { ...entry('aggregate-star'), ts: Date.now(), cards: [{ name: 'The Star', position: 'Present' }] };
  seed(storage, owner, [removed, keep]);
  const aggregate = { topCards: [{ card_name: 'The Moon', count: 1 }], badges: [], majorArcanaFrequency: {}, cadenceData: [], stats: { needsBackfill: false } };
  const hook = await journeyHook(aggregate); const props = { entries: [removed, keep], filteredEntries: [removed, keep], filtersActive: false, isAuthenticated: true, canUseCloudJournal: true, userId: owner, timezone: 'UTC' };
  assert.match(hook(props).seasonNarrative, /Moon/);
  const h = await helpers(); purge(h, { namespace: visualStorageNamespace(owner), entryId: removed.id, entries: [removed, keep], storage });
  const current = hook({ ...props, entries: [keep], filteredEntries: [keep] });
  assert.match(current.seasonNarrative, /Star/);
  assert.doesNotMatch(current.seasonNarrative, /Moon/);
  aggregate.isDisabled = true;
  assert.match(hook({ ...props, entries: [keep], filteredEntries: [keep] }).seasonNarrative, /Star/);
  assert.equal(Object.keys(read(storage, 'journey_narrative_cache')).some(key => key.startsWith(`${owner}:`)), false,
    'template summaries must not persist stale journal derivations');
});

test('the actual delayed JourneyContent snapshot effect rejects deleted inputs', async t => {
  const owner = 'entry-delayed-coach-effect'; const { storage } = storageFixture(t); const removed = entry('effect-remove'); const keep = entry('effect-keep'); seed(storage, owner, [removed, keep]);
  const source = await readFile(new URL('../src/components/ReadingJourney/JourneyContent.jsx', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] }); let callback;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee?.name === 'useEffect' && node.arguments[0]?.body?.body?.some(statement => statement.expression?.callee?.name === 'persistCoachStatsSnapshot')) callback = node.arguments[0];
    for (const value of Object.values(node)) { if (Array.isArray(value)) value.forEach(visit); else if (value?.type) visit(value); }
  }
  visit(ast); assert.ok(callback, 'actual coach snapshot effect exists');
  const h = await helpers(); purge(h, { namespace: visualStorageNamespace(owner), entryId: removed.id, entries: [removed, keep], storage });
  for (const sourceInputs of [{ _dataSource: 'client', scopedEntries: [removed, keep] }, { _dataSource: 'server', scopedEntries: [keep] }]) {
    const dependencies = { historyComplete: true, scopeError: '', persistCoachStatsSnapshot, entries: [keep], exportStats: { frequentCards: [{ name: 'The Moon', count: 1 }] },
      journeyFiltersActive: false, scopeLabel: null, coachSuggestionSnapshot: { question: 'Old Moon guidance' }, coachSuggestionIndex: 0, coachSuggestionKey: 'old-moon', userId: owner, ...sourceInputs };
    const effect = new Function(...Object.keys(dependencies), `return (${source.slice(callback.start, callback.end)});`)(...Object.values(dependencies));
    effect();
    assert.equal(storage.getItem(`tarot_coach_stats_snapshot_${owner}`), null, `retained ${sourceInputs._dataSource} inputs must not restore deleted prose`);
  }
});

async function filterDriver(owner, loadedEntries, fetchImpl) {
  const source = await readFile(new URL('../src/hooks/useJournalFilters.js', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module' }); const removed = []; const states = []; const refs = []; const queues = []; const effects = []; const layouts = []; const cleanups = [];
  let stateIndex = 0; let refIndex = 0; let activeOwner = owner;
  const dependencies = { useMemo: callback => callback(), useCallback: callback => callback, useDeferredValue: value => value,
    useRef: initial => { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useState: initial => { const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], update => queues.push(() => { states[index] = typeof update === 'function' ? update(states[index]) : update; })]; },
    useEffect: effect => effects.push(effect), useLayoutEffect: effect => layouts.push(effect), fetch: fetchImpl };
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      removed.push([node.start, node.end]); if (node.source.value === 'react') continue;
      let target = node.source.value; if (!target.endsWith('.js')) target += '.js';
      let imported;
      if (target.endsWith('/journal/constants.js')) {
        // Filter defaults stay real; spread/deck preview labels are UI assets,
        // outside the query/owner/deletion boundary exercised here.
        const constantSource = await readFile(new URL(target, new URL('../src/hooks/useJournalFilters.js', import.meta.url)), 'utf8');
        const constantAst = parse(constantSource, { sourceType: 'module' }); let constantProgram = constantSource; const ranges = [];
        for (const statement of constantAst.program.body) {
          if (statement.type === 'ImportDeclaration') ranges.push([statement.start, statement.end]);
          else if (statement.type === 'ExportNamedDeclaration') ranges.push([statement.start, statement.declaration.start]);
        }
        for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) constantProgram = constantProgram.slice(0, start) + constantProgram.slice(end);
        imported = new Function('SPREADS', 'DECK_OPTIONS', `${constantProgram}; return { ${node.specifiers.map(specifier => specifier.imported.name).join(',')} };`)({}, []);
      } else imported = await import(new URL(target, new URL('../src/hooks/useJournalFilters.js', import.meta.url)));
      for (const specifier of node.specifiers) dependencies[specifier.local.name] = imported[specifier.imported.name];
    } else if (node.type === 'ExportNamedDeclaration') removed.push([node.start, node.declaration.start]);
    else if (node.type === 'ExportDefaultDeclaration') removed.push([node.start, node.end]);
  }
  let program = source; for (const [start, end] of removed.sort((a, b) => b[0] - a[0])) program = program.slice(0, start) + program.slice(end);
  const hook = new Function(...Object.keys(dependencies), `${program}; return useJournalFilters;`)(...Object.values(dependencies));
  const render = (runEffects = false) => { stateIndex = 0; refIndex = 0; const result = hook(loadedEntries, { isAuthenticated: true, canUseCloudJournal: true, userId: activeOwner });
    if (runEffects) { for (const effect of [...layouts.splice(0), ...effects.splice(0)]) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } }
    else { layouts.length = 0; effects.length = 0; } return result; };
  const flush = () => { while (queues.length) queues.shift()(); };
  const initial = render(); initial.setFilters(previous => ({ ...previous, query: 'Private' })); flush();
  return { render, flush, setOwner: next => { activeOwner = next; }, close: () => cleanups.reverse().forEach(cleanup => cleanup()) };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('a late full-history search response cannot restore a deleted entry outside the loaded journal', async t => {
  const owner = 'entry-server-search'; const { storage } = storageFixture(t); const removed = entry('search-outside-page'); const keep = entry('search-keep');
  let release; const driver = await filterDriver(owner, Array.from({ length: 201 }, (_, i) => entry(`search-loaded-${i}`)), () => new Promise(resolve => { release = resolve; }));
  t.after(() => driver.close()); driver.render(true); const h = await helpers(); purge(h, { namespace: visualStorageNamespace(owner), entryId: removed.id, entries: [removed], storage });
  release(Response.json({ entries: [removed, keep] })); await settle(); driver.flush();
  assert.deepEqual(driver.render().filteredEntries, [keep]);
});

test('native cross-tab entry deletion removes already displayed full-history search prose', async t => {
  const owner = 'entry-search-native'; const { storage, window } = storageFixture(t); const removed = entry('search-native-remove'); const keep = entry('search-native-keep');
  const driver = await filterDriver(owner, Array.from({ length: 201 }, (_, i) => entry(`native-loaded-${i}`)), async () => Response.json({ entries: [removed, keep] }));
  t.after(() => driver.close()); driver.render(true); await settle(); driver.flush(); assert.equal(driver.render().filteredEntries.length, 2);
  const key = `tarot_deleted_journal_entry:user:${owner}:${removed.id}`; storage.setItem(key, '{}');
  const event = new Event('storage'); Object.assign(event, { key, newValue: '{}' }); window.dispatchEvent(event); driver.flush();
  assert.deepEqual(driver.render().filteredEntries, [keep]);
});

test('full-history search identity includes owner and rejects an old queued response after switching', async t => {
  const owner = 'entry-search-old'; const other = 'entry-search-new'; storageFixture(t); const old = entry('search-old-prose'); const current = entry('search-current-prose');
  const releases = []; const driver = await filterDriver(owner, Array.from({ length: 201 }, (_, i) => entry(`switch-loaded-${i}`)), () => new Promise(resolve => releases.push(resolve)));
  t.after(() => driver.close()); driver.render(true); releases[0](Response.json({ entries: [old] })); await settle();
  driver.setOwner(other); const switched = driver.render(true);
  assert.equal(switched.filters.query, '', 'private search text resets before exposing a new owner');
  assert.equal(switched.filteredEntries.some(item => item.id === old.id), false, 'old queued result must not surface');
  driver.flush();
  const next = driver.render();
  assert.equal(next.filteredEntries.some(item => item.id === old.id), false);
  next.setFilters(previous => ({ ...previous, query: 'Private current' })); driver.flush(); driver.render(true);
  releases[1](Response.json({ entries: [current] })); await settle(); driver.flush(); assert.deepEqual(driver.render().filteredEntries, [current]);
});

test('actual Journal search-result deletion carries its result identity and purges an orphan original handle', async t => {
  const owner = 'entry-orphan-search'; const { storage } = storageFixture(t); const removed = entry('orphan-search'); const b = binding(removed.readingResultId);
  writeVisualResume({ namespace: visualStorageNamespace(owner), binding: b, resumeHandle: { visualBinding: b, visualJobToken: 'orphan-secret' }, storage });
  const driver = await journalDriver(owner, async (_url, options) => { assert.equal(options?.method, 'DELETE'); return Response.json({ success: true, retiredReadingResultIds: [removed.readingResultId] }); }); t.after(() => driver.close()); const hook = driver.render();
  const source = await readFile(new URL('../src/components/Journal.jsx', import.meta.url), 'utf8'); const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] }); const callbacks = {};
  function visit(node) { if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && ['handleDeleteRequest', 'handleDeleteConfirm'].includes(node.id?.name)) callbacks[node.id.name] = node.init;
    for (const value of Object.values(node)) { if (Array.isArray(value)) value.forEach(visit); else if (value?.type) visit(value); } }
  visit(ast); let modal; const notices = []; const common = { filteredEntries: [removed], entries: [], user: { id: owner }, isAuthenticated: true,
    setDeleteConfirmModal: next => { modal = next; }, deleteEntry: hook.deleteEntry, showToast: notice => notices.push(notice), serverSearchEnabled: false, refreshServerSearch() {} };
  const compile = (node, dependencies) => new Function(...Object.keys(dependencies), `return (${source.slice(node.start, node.end)});`)(...Object.values(dependencies));
  compile(callbacks.handleDeleteRequest, common)(removed.id); await compile(callbacks.handleDeleteConfirm, { ...common, deleteConfirmModal: modal })(); driver.flush();
  assert.equal(storage.getItem(`tarot_visual_resume:user:${owner}:${removed.readingResultId}`), null);
  assert.equal(notices[0].type, 'success');
});


test('an explicit empty server retirement receipt preserves a shared original handle outside loaded buckets', async t => {
  const owner = 'entry-unobserved-alias'; const { storage } = storageFixture(t); const removed = entry('unobserved-alias-remove', 'unobserved-shared-result'); const b = binding(removed.readingResultId);
  writeVisualResume({ namespace: visualStorageNamespace(owner), binding: b, resumeHandle: { visualBinding: b, visualJobToken: 'surviving-alias-secret' }, storage });
  const driver = await journalDriver(owner, async () => Response.json({ success: true, retiredReadingResultIds: [] })); t.after(() => driver.close());
  assert.equal((await driver.render().deleteEntry(removed.id, { readingResultId: removed.readingResultId })).success, true); driver.flush();
  assert.equal(readVisualResume({ namespace: visualStorageNamespace(owner), readingResultId: removed.readingResultId, binding: b, storage }).visualJobToken, 'surviving-alias-secret');
  assert.equal(writeVisualResume({ namespace: visualStorageNamespace(owner), entryId: removed.id, binding: b,
    resumeHandle: { visualBinding: b, visualJobToken: 'deleted-alias-secret' }, storage }), false);
  assert.equal(writeVisualResume({ namespace: visualStorageNamespace(owner), entryId: 'still-live-unobserved-alias', binding: b,
    resumeHandle: { visualBinding: b, visualJobToken: 'surviving-alias-next-secret' }, storage }), true);
});

test('entry-associated original metadata lets local erasure retire an orphan handle without stored prose', async t => {
  const owner = 'entry-associated-orphan'; const { storage } = storageFixture(t); const removed = entry('associated-orphan'); const b = binding(removed.readingResultId);
  writeVisualResume({ namespace: visualStorageNamespace(owner), entryId: removed.id, binding: b, resumeHandle: { visualBinding: b, visualJobToken: 'orphan-local-secret' }, storage });
  const h = await helpers(); assert.equal(purge(h, { namespace: visualStorageNamespace(owner), entryId: removed.id, storage }).purged, true);
  assert.equal(storage.getItem(`tarot_visual_resume:user:${owner}:${removed.readingResultId}`), null);
});

test('confirmed cloud deletion with an unreadable retirement receipt reports cleanup uncertainty and preserves unknown aliases', async t => {
  const owner = 'entry-missing-retirement-receipt'; const { storage } = storageFixture(t); const removed = entry('missing-retirement-receipt'); const b = binding(removed.readingResultId);
  writeVisualResume({ namespace: visualStorageNamespace(owner), binding: b, resumeHandle: { visualBinding: b, visualJobToken: 'unknown-alias-secret' }, storage });
  const driver = await journalDriver(owner, async () => new Response('invalid JSON', { status: 200 })); t.after(() => driver.close());
  const result = await driver.render().deleteEntry(removed.id, { readingResultId: removed.readingResultId }); driver.flush();
  assert.equal(result.success, true); assert.equal(result.purged, false); assert.match(result.error, /could not finish/);
  assert.equal(storage.getItem(`tarot_deleted_journal_entry:user:${owner}:${removed.id}`) != null, true);
  assert.ok(readVisualResume({ namespace: visualStorageNamespace(owner), readingResultId: removed.readingResultId, binding: b, storage }));
});
